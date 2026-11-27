"""Reproduce retrieval metrics on all labeled BEIR SciFact test queries in local PostgreSQL."""

import argparse
import asyncio
import csv
import hashlib
import io
import json
import os
import platform
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import NAMESPACE_URL, uuid4, uuid5

import httpx
import numpy as np
import onnxruntime
import psycopg

from . import db, discovery
from .config import settings
from .migrate import migrate
from .ml import ranker
from .text import chunk_text

EVALUATION = Path(__file__).resolve().parent.parent / "evaluation"


def peak_rss_mb():
    try:
        import resource

        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return round(value / (1024**2 if platform.system() == "Darwin" else 1024), 2)
    except ImportError:
        return None


def load_data():
    import pyarrow.parquet as parquet

    manifest = json.loads((EVALUATION / "scifact_manifest.json").read_text())
    directory = EVALUATION / "data"
    directory.mkdir(parents=True, exist_ok=True)
    for name, metadata in manifest["files"].items():
        path = directory / name

        def valid():
            return (
                path.is_file()
                and path.stat().st_size == metadata["bytes"]
                and hashlib.sha256(path.read_bytes()).hexdigest() == metadata["sha256"]
            )

        if not valid():
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=directory, delete=False) as handle:
                    temporary = Path(handle.name)
                    with httpx.stream("GET", metadata["url"], follow_redirects=True, timeout=120) as response:
                        response.raise_for_status()
                        total = 0
                        for block in response.iter_bytes():
                            total += len(block)
                            if total > metadata["bytes"]:
                                raise ValueError("Dataset exceeds pinned size")
                            handle.write(block)
                if hashlib.sha256(temporary.read_bytes()).hexdigest() != metadata["sha256"]:
                    raise ValueError("Dataset checksum mismatch")
                os.replace(temporary, path)
            finally:
                if temporary:
                    temporary.unlink(missing_ok=True)
        if not valid():
            raise ValueError("Dataset integrity check failed")
    corpus = parquet.read_table(directory / "corpus.parquet").to_pylist()
    queries = {
        str(row["_id"]): row["text"] for row in parquet.read_table(directory / "queries.parquet").to_pylist()
    }
    qrels = {}
    for row in csv.DictReader(io.StringIO((directory / "test.tsv").read_text()), delimiter="\t"):
        if int(row["score"]) > 0:
            qrels.setdefault(str(row["query-id"]), set()).add(str(row["corpus-id"]))
    return manifest, corpus, queries, qrels


def metrics(ranking, relevant, k=8):
    unique = list(dict.fromkeys(ranking))[:k]
    found = set(unique) & relevant
    first = next((i + 1 for i, doc in enumerate(unique) if doc in relevant), None)
    return {
        "hit_at_1": float(bool(unique and unique[0] in relevant)),
        "recall_at_8": len(found) / len(relevant),
        "mrr_at_8": 1 / first if first else 0.0,
    }


def local_test_url(value: str):
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"postgresql", "postgres"}
        or parsed.hostname not in {"127.0.0.1", "localhost"}
        or not parsed.path.endswith("_test")
        or {"host", "hostaddr", "dbname", "service", "servicefile"} & parse_qs(parsed.query).keys()
    ):
        raise ValueError("ML_EVAL_DATABASE_URL must name an explicitly disposable LOCAL *_test database")
    return value


async def evaluate(output: Path, count: int):
    url = local_test_url(os.getenv("ML_EVAL_DATABASE_URL", ""))
    os.environ["DATABASE_URL"] = url
    os.environ["APP_ENV"] = "development"
    os.environ["ML_ENABLED"] = "true"
    settings.cache_clear()
    manifest, corpus, queries, qrels = await asyncio.to_thread(load_data)
    await migrate()
    await db.open_pool()
    await asyncio.to_thread(ranker.load)
    owner, space = uuid4(), uuid4()
    namespace = uuid5(NAMESPACE_URL, "knowsphere-beir-scifact-evaluation-v1")
    ids = {str(uuid5(namespace, str(row["_id"]))): str(row["_id"]) for row in corpus}
    records, latencies = [], []
    started = time.perf_counter()
    async with await psycopg.AsyncConnection.connect(url, autocommit=True) as guard:
        locked = await (await guard.execute("SELECT pg_try_advisory_lock(872903)")).fetchone()
        if not locked[0]:
            await db.close_pool()
            raise RuntimeError("An evaluation is already running in this test database")
        try:
            async with db.database().connection() as conn, conn.transaction():
                await conn.execute(
                    "INSERT INTO knowsphere.users(id,email,name,password_hash) VALUES (%s,%s,%s,%s)",
                    (
                        owner,
                        f"evaluation-{owner}@example.com",
                        "Isolated SciFact evaluation",
                        "no-login-fixture",
                    ),
                )
                await conn.execute(
                    "INSERT INTO knowsphere.spaces(id,owner_id,name) VALUES (%s,%s,%s)",
                    (space, owner, "SciFact evaluation only"),
                )
                documents, chunks = [], []
                for row in corpus:
                    doc = uuid5(namespace, str(row["_id"]))
                    content = f"{row['title']}\n\n{row['text']}".strip()
                    documents.append(
                        (
                            doc,
                            space,
                            row["title"] or "Untitled",
                            content,
                            hashlib.sha256(content.encode()).hexdigest(),
                            "text",
                            "ready",
                            100,
                        )
                    )
                    chunks += [
                        (uuid5(doc, str(ordinal)), doc, ordinal, text, True)
                        for ordinal, text in enumerate(chunk_text(content))
                    ]
                async with conn.cursor() as cursor:
                    await cursor.executemany(
                        "INSERT INTO knowsphere.documents(id,space_id,title,content,content_hash,format,status,progress) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        documents,
                    )
                    await cursor.executemany(
                        "INSERT INTO knowsphere.chunks(id,document_id,ordinal,content,processed) VALUES (%s,%s,%s,%s,%s)",
                        chunks,
                    )
            query_ids = sorted(qrels, key=lambda q: int(q) if q.isdigit() else q)
            if count:
                query_ids = query_ids[:count]
            for n, qid in enumerate(query_ids, 1):
                query = queries[qid]
                baseline = await discovery.lexical_candidates(space, query)
                candidates = await discovery.lexical_candidates(
                    space, query, settings().ml_candidates, broaden=True
                )
                tick = time.perf_counter()
                neural = await ranker.rerank(query, candidates)
                latencies.append((time.perf_counter() - tick) * 1000)

                def doc_ids(rows):
                    return [ids[str(row["document_id"])] for row in rows]

                relevant = qrels[qid]
                record = {
                    "query_id": qid,
                    "relevant_document_ids": sorted(relevant),
                    "baseline_document_ids": list(dict.fromkeys(doc_ids(baseline))),
                    "candidate_document_ids": list(dict.fromkeys(doc_ids(candidates))),
                    "neural_document_ids": list(dict.fromkeys(doc_ids(neural))),
                }
                for key, rows in [
                    ("baseline", baseline),
                    ("same_candidate_lexical", candidates),
                    ("neural", neural),
                ]:
                    record[key] = metrics(doc_ids(rows), relevant)
                record["candidate_recall"] = len(set(doc_ids(candidates)) & relevant) / len(relevant)
                records.append(record)
                if n % 25 == 0 or n == len(query_ids):
                    print(f"Scored {n}/{len(query_ids)} held-out queries", flush=True)
            aggregate = {
                label: {
                    metric: round(float(np.mean([row[label][metric] for row in records])), 6)
                    for metric in ["hit_at_1", "recall_at_8", "mrr_at_8"]
                }
                for label in ["baseline", "same_candidate_lexical", "neural"]
            }
            report = {
                "evaluated_at": datetime.now(UTC).isoformat(),
                "dataset": manifest,
                "test_queries": len(records),
                "available_test_queries": len(qrels),
                "corpus_documents": len(corpus),
                "selection": "all labeled test queries"
                if not count
                else "first queries sorted by ID; diagnostic subset",
                "training": "No fitting, fine-tuning or threshold selection on this test set.",
                "model": ranker.status(),
                "runtime": {
                    "onnxruntime": onnxruntime.__version__,
                    "platform": platform.platform(),
                    "python": platform.python_version(),
                },
                "metrics": aggregate,
                "candidate_recall": round(float(np.mean([row["candidate_recall"] for row in records])), 6),
                "rerank_latency_ms": {
                    "p50": round(float(np.percentile(latencies, 50)), 2),
                    "p95": round(float(np.percentile(latencies, 95)), 2),
                },
                "elapsed_seconds": round(time.perf_counter() - started, 2),
                "process_peak_rss_mb": peak_rss_mb(),
                "scope": "Passage/document relevance on public SciFact abstracts. Not answer factuality, extraction accuracy or a guarantee on private documents.",
                "queries": records,
            }
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, indent=2) + "\n")
            print(json.dumps(aggregate, indent=2), flush=True)
            print(f"Saved {output}")
        finally:
            await db.execute("DELETE FROM knowsphere.users WHERE id=%s", (owner,))
            await db.close_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=EVALUATION / "scifact-results.json")
    parser.add_argument("--queries", type=int, default=0, help="0 evaluates the complete test split")
    args = parser.parse_args()
    if args.queries < 0:
        parser.error("--queries must be nonnegative")
    asyncio.run(evaluate(args.output, args.queries))
