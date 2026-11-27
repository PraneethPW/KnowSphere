"""Local neural relevance scoring. Scores order evidence; they are not factual confidence."""

import asyncio
import threading
from typing import Any

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

from .config import settings
from .prepare_ml import MANIFEST, verified


class MLUnavailable(Exception):
    pass


class PassageRanker:
    def __init__(self):
        self.session = None
        self.tokenizer = None
        self.document_tokenizer = None
        self.signature = None
        self.lock = threading.Lock()
        self.pending = threading.BoundedSemaphore(4)

    def load(self):
        config = settings()
        signature = (str(config.ml_model_dir), config.ml_threads, config.ml_enabled)
        with self.lock:
            if self.signature == signature and (self.session is not None or not config.ml_enabled):
                return
            self.session = self.tokenizer = None
            self.signature = None
            if not config.ml_enabled:
                self.signature = signature
                return
            for name, description in MANIFEST["files"].items():
                if not verified(config.ml_model_dir / name, description):
                    raise MLUnavailable(
                        "Neural reranker is missing or failed SHA-256 verification. Run python -m knowsphere.prepare_ml."
                    )
            options = ort.SessionOptions()
            options.intra_op_num_threads = config.ml_threads
            options.inter_op_num_threads = 1
            options.enable_cpu_mem_arena = False
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            try:
                session = ort.InferenceSession(
                    str(config.ml_model_dir / "model.onnx"),
                    sess_options=options,
                    providers=["CPUExecutionProvider"],
                )
                tokenizer = Tokenizer.from_file(str(config.ml_model_dir / "tokenizer.json"))
                # Pair tokenization uses at most 96 query + 256 passage tokens plus separators.
                # Each long source chunk is scored in overlapping windows, including its tail.
                tokenizer.enable_padding(pad_id=0, pad_token="[PAD]")
                tokenizer.enable_truncation(max_length=512)
                document_tokenizer = Tokenizer.from_file(str(config.ml_model_dir / "tokenizer.json"))
                document_tokenizer.no_truncation()
                document_tokenizer.no_padding()
                self.document_tokenizer = document_tokenizer
                self.session, self.tokenizer, self.signature = session, tokenizer, signature
            except Exception:
                raise MLUnavailable("The verified neural model could not load on this CPU runtime.") from None

    def status(self):
        return {
            "enabled": settings().ml_enabled,
            "ready": self.session is not None,
            "model": MANIFEST["model"],
            "revision": MANIFEST["revision"],
            "sha256": MANIFEST["files"]["model.onnx"]["sha256"],
            "quantization": MANIFEST["quantization"],
            "device": "CPU",
            "candidates": settings().ml_candidates,
        }

    def windows(self, content: str) -> list[tuple[int, int]]:
        # A separate untruncated tokenizer preserves offsets in the original source string.
        offsets = self.document_tokenizer.encode(content, add_special_tokens=False).offsets
        if not offsets:
            return [(0, len(content))]
        windows = []
        for start in range(0, len(offsets), 208):
            end = min(start + 256, len(offsets))
            windows.append((offsets[start][0], offsets[end - 1][1]))
            if end == len(offsets):
                break
        return windows

    def rank(self, query: str, passages: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
        if not self.pending.acquire(blocking=False):
            raise MLUnavailable("The neural retrieval model is busy. Please retry shortly.")
        try:
            return self._rank(query, passages, limit)
        finally:
            self.pending.release()

    def _rank(self, query: str, passages: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
        if not settings().ml_enabled:
            return passages[:limit]
        with self.lock:
            if self.session is None or self.tokenizer is None:
                raise MLUnavailable("Neural retrieval is unavailable. Check the verified model installation.")
            if not passages:
                return []
            try:
                query_ids = self.tokenizer.encode(query, add_special_tokens=False).ids[:96]
                query_text = self.tokenizer.decode(query_ids, skip_special_tokens=True)
                windows = [
                    (i, start, end)
                    for i, row in enumerate(passages)
                    for start, end in self.windows(row["content"])
                ]
                best = {i: (-float("inf"), 0, len(row["content"])) for i, row in enumerate(passages)}
                for offset in range(0, len(windows), 8):
                    batch = windows[offset : offset + 8]
                    pairs = [(query_text, passages[i]["content"][start:end]) for i, start, end in batch]
                    encoded = self.tokenizer.encode_batch(pairs)
                    feeds = {
                        "input_ids": np.asarray([x.ids for x in encoded], dtype=np.int64),
                        "attention_mask": np.asarray([x.attention_mask for x in encoded], dtype=np.int64),
                        "token_type_ids": np.asarray([x.type_ids for x in encoded], dtype=np.int64),
                    }
                    names = {x.name for x in self.session.get_inputs()}
                    scores = self.session.run(None, {k: v for k, v in feeds.items() if k in names})[
                        0
                    ].reshape(-1)
                    if len(scores) != len(batch) or not np.isfinite(scores).all():
                        raise ValueError("Invalid relevance scores")
                    for (i, start, end), score in zip(batch, scores):
                        if float(score) > best[i][0]:
                            best[i] = (float(score), start, end)
                ordered = sorted(range(len(passages)), key=lambda i: (-best[i][0], i))[:limit]
                return [
                    passages[i]
                    | {
                        "content": passages[i]["content"][best[i][1] : best[i][2]],
                        "match_start": best[i][1],
                        "match_end": best[i][2],
                        "relevance_score": best[i][0],
                        "retrieval_model": MANIFEST["model"],
                    }
                    for i in ordered
                ]
            except MLUnavailable:
                raise
            except Exception:
                raise MLUnavailable(
                    "Neural relevance scoring failed. Retry or inspect backend configuration."
                ) from None

    async def rerank(self, query: str, passages: list[dict[str, Any]], limit: int = 8):
        # The thread lock remains held until inference finishes even if the caller disconnects.
        return await asyncio.to_thread(self.rank, query, passages, limit)


ranker = PassageRanker()
