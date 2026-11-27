# Neural retrieval evaluation

KnowSphere integrates the pretrained **Xenova/ms-marco-MiniLM-L-6-v2** cross-encoder as a local ONNX INT8 passage reranker. It predicts relative query–passage relevance. It does not generate answers, verify facts, or train on private documents. The existing OpenRouter model still extracts graph records and generates cited answers.

## Prepare and run the model

From `backend`, after installing the hashed runtime/development requirements:

```bash
python -m knowsphere.prepare_ml
```

The preparer downloads about 24 MB from a pinned Hugging Face commit and verifies exact file sizes and SHA-256 hashes recorded in `knowsphere/ml_manifest.json`. Inference uses ONNX Runtime's CPU provider. There is no GPU, model server, Hugging Face account or provider key requirement for reranking. Once prepared, ranking itself requires no network. The Docker build prepares the same model. The API rejects missing/corrupt model files instead of silently substituting lexical results.

The selected model is Apache-2.0 licensed. Sources: [converted ONNX model](https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2), [original model](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2), [cross-encoder reranking](https://sbert.net/examples/cross_encoder/applications/README.html).

## What changes at runtime

1. PostgreSQL retrieves exact, broadened lexical and graph-neighborhood candidates inside the authenticated owner's space. Default budget: 32 chunks.
2. The local model scores overlapping windows of 256 document tokens with up to 96 query tokens. Long chunk tails are included rather than silently discarded by the transformer's input limit.
3. Up to eight original-source windows are returned in neural relevance order. Chunk/document IDs and exact original string offsets are retained. Chat citations preserve the whole selected window so relevant tail evidence remains inspectable.
4. Existing extraction quote checks and answer citation validation remain in place.

Raw logits are relative relevance scores, **not calibrated probabilities or truth confidence**. With no lexical/entity overlap, the relevant chunk may never enter the candidate pool. This implementation does not add a vector index or claim exhaustive semantic search. English-language MS MARCO training does not establish multilingual accuracy.

Configuration in `backend/.env`:

```dotenv
ML_ENABLED=true
ML_CANDIDATES=32
ML_THREADS=2
```

`ML_CANDIDATES` supports 12–64; `ML_THREADS` supports 1–4. More candidates can increase recall and latency. Defaults are fixed before evaluation. `ML_MODEL_DIR` optionally selects an already-prepared directory. `ML_ENABLED=false` explicitly selects the legacy lexical/graph mode; the system status reports it as disabled. A runtime model failure while enabled returns an explicit 503. Settings shows the actual loaded model, CPU provider and quantization.

## Reproduce the public evaluation

Use Python 3.12 and a **disposable local PostgreSQL database whose name ends in `_test`**. Never point this command at Neon or your application database.

```bash
# From backend, with the virtual environment active:
python -m pip install --require-hashes -r requirements-evaluation.lock
python -m knowsphere.prepare_ml
# First create a disposable database, e.g. with local PostgreSQL:
createdb knowsphere_ml_eval_test
export ML_EVAL_DATABASE_URL='postgresql://YOUR_LOCAL_ROLE@127.0.0.1:5432/knowsphere_ml_eval_test'
python -m knowsphere.evaluate_ml
```

PowerShell environment syntax: `$env:ML_EVAL_DATABASE_URL='postgresql://YOUR_LOCAL_ROLE@127.0.0.1:5432/knowsphere_ml_eval_test'`. For full application setup on Windows, use WSL2 as described in `INSTALL.md`; model preparation itself supports Windows x64. Native macOS ONNX wheels require macOS 14+ on Apple Silicon; Linux Docker is an alternative on other Macs.

The evaluator downloads checksum-pinned public SciFact files listed in `scifact_manifest.json`, inserts an isolated evaluation workspace, executes the application's actual candidate retrieval and reranker, and deletes only that evaluation account and its cascaded data afterward. It refuses remote database hosts and prevents concurrent evaluations in the same database. Public corpus fixtures exceed the normal application upload quota for benchmark coverage only; no runtime quota changes or production records are introduced.

The complete benchmark uses all 300 labeled SciFact test queries against the entire 5,183-abstract corpus. No fitting, fine-tuning or threshold selection is performed on this test set. SciFact has no extracted knowledge graph in this experiment, so it evaluates lexical retrieval and passage reranking, not graph-extraction quality.

Three methods are scored at a cutoff of eight unique documents. The application returns up to eight chunks; duplicate chunks from the same document can leave fewer unique documents. Four long corpus abstracts produce multiple chunks. The same-candidate lexical comparison can inspect the larger pool until it reaches eight unique documents; this gives that comparison a small context-budget advantage, rather than favoring the neural method.

- **Baseline:** the previous exact-query / fallback-OR PostgreSQL pipeline.
- **Same-candidate lexical:** the enlarged candidate pool before neural scoring, separating candidate expansion from reranking gains.
- **Neural:** the same pool reordered by the pinned MiniLM model.

`scifact-results.json` records Hit@1, Recall@8, MRR@8, candidate recall, reranking latency, environment, model/dataset checksums, and per-query document IDs. Candidate recall measures how much relevant evidence reached the model at all. `--queries 10` is available for a diagnostic subset and is explicitly labeled as such; it must not be represented as the full benchmark.

## Measured results — 27 November 2026

All **300 test queries**, **5,183 abstracts**, default 32 candidates, CPU INT8, two inference threads. Full provenance and per-query results: [scifact-results.json](scifact-results.json).

| Method | Relevant source first (Hit@1) | Recall@8 | MRR@8 |
| --- | ---: | ---: | ---: |
| Previous PostgreSQL pipeline | 23.00% | 47.89% | 0.3190 |
| Expanded candidates, lexical order | 23.00% | 48.56% | 0.3213 |
| Expanded candidates + MiniLM | **51.67%** | **62.64%** | **0.5661** |

Neural ranking increases Hit@1 by **28.67 percentage points** over both lexical comparisons on this benchmark. Candidate recall is **64.48%**, so the candidate stage remains the main coverage limit. Relevance labels establish which abstracts address the claim; they do not establish that a claim is true.

Measured reranking latency was **1,421 ms p50 / 1,985 ms p95** on the recorded Apple Silicon/macOS environment. The complete evaluation took 456 seconds; peak process RSS was 1,197 MiB, including the full corpus, Parquet reader and benchmark bookkeeping. These are local benchmark measurements, not hosted-service latency or memory guarantees. CPU/architecture, passage length, concurrency and candidate budget affect cost. Inference is serialized with a bounded admission limit; overload returns an explicit retryable 503 rather than growing an unbounded inference queue.

These are relevance metrics on a public scientific corpus. They are **not** answer-factuality percentages, medical validation, model extraction accuracy, or guaranteed accuracy on a user's documents. No benchmark records are seeded into the application.

Dataset sources: [BEIR](https://github.com/beir-cellar/beir), [SciFact](https://github.com/allenai/scifact), [corpus mirror](https://huggingface.co/datasets/BeIR/scifact), [test relevance labels](https://huggingface.co/datasets/BeIR/scifact-qrels). Consult the source dataset's terms before other uses.
