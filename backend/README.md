# KnowSphere backend

Python 3.12 / FastAPI API and a separate durable PostgreSQL ingestion worker. Neon is the production database; no Redis or Neo4j instance is required. All SQL uses the dedicated `knowsphere` schema to avoid colliding with other applications.

## Installation

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r requirements-dev.lock
cp -n .env.example .env
chmod 600 .env
```

Edit `.env`, then run:

```bash
python -m knowsphere.migrate
python -m uvicorn knowsphere.main:app --host 127.0.0.1 --port 8000
```

In another terminal with this folder and virtual environment active:

```bash
python -m knowsphere.worker
```

Development API documentation: <http://127.0.0.1:8000/api/docs>. Production disables interactive docs. `GET /api/health/live` is process liveness; `GET /api/health/ready` checks the database. Authenticated `GET /api/system` reports worker heartbeat and configured AI settings.

## Environment

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL URI. Use `sslmode=require` or stronger; pooled endpoints are supported. Prepared statements are disabled for transaction pool compatibility. |
| `OPENROUTER_API_KEY` | Backend-only OpenRouter credential |
| `OPENROUTER_MODEL` | `openrouter/free` or a model ending in `:free`; paid IDs are rejected |
| `APP_ENV` | `development` locally; `production` for Railway |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins; production requires HTTPS |
| `COOKIE_SECURE` | `false` only for local HTTP; `true` in production |
| `REGISTRATION_ENABLED` | Close public registration when desired |
| `SESSION_DAYS` | Absolute session duration, default 7 |
| `MAX_UPLOAD_BYTES` | Default 10,000,000 |
| `MAX_DOCUMENT_CHARS` | Default 120,000 |
| `MAX_DOCUMENTS_PER_SPACE` | Default 200 |
| `MAX_SPACES_PER_USER` | Default 10 |
| `WORKER_POLL_SECONDS` | Default 2 |
| `LOG_LEVEL` | Default INFO |

Never log the environment, full database URI, request bodies, document text or provider authorization headers. The checked-in examples contain no secrets. A local `.env` is ignored by Git and excluded from container builds.

## API surface

All mutating requests need `X-KnowSphere-Client: web`. A browser Origin, when present, must be explicitly allowed. The React client supplies the header. Sessions use the `ks_session` HttpOnly cookie scoped to `/api`; only its hash is stored in the database.

| Routes | Function |
| --- | --- |
| `/api/auth/register`, `/login`, `/me`, `/logout`, `/logout-all` | Account and session lifecycle (all paths start with `/api/auth`) |
| `/api/spaces` | List/create private knowledge spaces |
| `/api/spaces/{space}/overview` | Actual counts, recent events, ingestion volume |
| `/api/spaces/{space}/documents` | List sources and job state |
| `/api/spaces/{space}/documents/text`, `/upload` | Queue an actual source |
| `/api/spaces/{space}/documents/{id}` | Inspect/delete a source |
| `/api/spaces/{space}/documents/{id}/retry`, `/cancel` | Job controls |
| `/api/spaces/{space}/graph` | Bounded live graph with analysis |
| `/api/spaces/{space}/entities/{id}` | Entity provenance and supporting relationships |
| `/api/spaces/{space}/search?q=...` | Source retrieval and graph expansion |
| `/api/spaces/{space}/export` | Complete ready graph as JSON |
| `/api/spaces/{space}/conversations` | List saved conversations |
| `/api/spaces/{space}/conversations/{id}` | Read/delete conversation |
| `/api/spaces/{space}/chat` | POST question, stream `context`, `token`, `done` or `error` events |
| `/api/spaces/{space}/events` | SSE changes with durable event IDs and reconnect replay |

## Ingestion lifecycle

```text
queued → processing → ready
            ├── transient failure → queued with backoff (up to 3 attempts)
            ├── terminal failure → failed → manual retry → queued
            └── cancel → cancelled → manual retry → queued
```

Uploads are parsed in a short-lived subprocess with a 30-second wall deadline, a CPU budget, bounded concurrency, no inherited database/provider secrets, and a 512 MB address-space limit on Linux. Original binary files are not retained.

Workers atomically claim a job using `FOR UPDATE SKIP LOCKED`. Each claim receives a random lease token and a 150-second lease, renewed every 20 seconds. Every checkpoint locks and verifies the current token and unexpired lease before writing. A cancelled or reclaimed worker cannot commit. After three expired worker claims, a document is marked failed with a visible recovery message instead of being reclaimed forever. The source is chunked at approximately 6,000 characters with overlap; each chunk is saved transactionally and marked processed, so retries skip completed chunks.

Entity identity uses Unicode-normalized, punctuation/whitespace-normalized names within one space. AI JSON is validated by Pydantic. Entity and relationship quotes must appear in the chunk; both relation endpoints must be evidenced entities. Only records from **ready** documents enter the discoverable graph. A ready document can legitimately have zero entities if no supported extraction was returned.

The retrieval engine uses a GIN-indexed English full-text vector, explicit entity matches and one-hop relationship evidence. It supplies bounded context to OpenRouter. Token events arrive from the provider, not a simulated timer. Completed cited answers are persisted; missing/invalid citations or interrupted generation produce a failure state. Per-conversation leases prevent concurrent answer writes.

Louvain groups and PageRank operate on the bounded visible graph. Model-provided extraction confidence is separate from graph centrality; neither is a fact-checking score.

## Railway deployment

Use a Git repository connected to the selected Railway account. Current service settings are recorded in `../.railway/railway.ts`; see its README for planning and applying infrastructure changes. New Railway services no longer support the old `railway.json` configuration. Create a private project with **two services pointing to the same source**:

| Setting | API service | Worker service |
| --- | --- | --- |
| Root Directory | `/backend` | `/backend` |
| Infrastructure source | `../.railway/railway.ts` | Same project-level file |
| Build | Included Dockerfile | Included Dockerfile |
| Start | Uvicorn on `$PORT` | `python -m knowsphere.worker` |
| Pre-deploy | `python -m knowsphere.migrate` | `python -m knowsphere.migrate` |
| Health check | `/api/health/ready` | No HTTP health check; use heartbeat monitoring |
| Public domain | Yes | None |
| Sleeping | Disabled | Disabled |

Migrations serialize through a PostgreSQL advisory lock, so both services can safely run the pre-deploy command. The container runs as UID 10001. The API allows time for active streams to finish during graceful shutdown. Claims recover after lease expiry if a worker is killed.

Set `DATABASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `APP_ENV=production`, `COOKIE_SECURE=true`, and the exact `ALLOWED_ORIGINS` on both services. Choose a Railway region near the Neon project. API + worker normally use one database pool each (up to eight connections per process); size Neon capacity before increasing replicas. Do not add a public domain to the worker.

Generate the API's Railway domain, verify readiness, configure the frontend's Vercel rewrite with it, then set the final frontend origin in `ALLOWED_ORIGINS`. Verify via the Vercel URL, since direct-API health does not test first-party cookie forwarding or streaming.

## Testing and dependency updates

```bash
# Use only an explicitly disposable local *_test database.
TEST_DATABASE_URL='postgresql://your_local_role@127.0.0.1:5432/knowsphere_test' python -m pytest -q
ruff check knowsphere tests
ruff format --check knowsphere tests
```

Integration fixtures reset the local test schema, and refuse all remote hosts. They cover session hashing/revocation, cross-owner access denial, CSRF headers/origins, input redaction, absence of fake AI fallbacks, durable job claims, stale-worker fencing, quote rejection, retrieval and source-delete cascades. Provider fixture structures occur only inside tests and do not replace a runtime provider.

Regenerate lockfiles intentionally after changing dependencies:

```bash
uv pip compile pyproject.toml --generate-hashes -o requirements.lock
uv pip compile pyproject.toml --extra dev --generate-hashes -o requirements-dev.lock
```

## Operations and recovery

- **Queued forever:** check the worker process and `/api/system`. The worker must use the same database/schema as the API.
- **AI 429:** inspect the source's error and scheduled retry time. Free quotas are account-wide; changing keys does not create more capacity. Avoid repeated manual retries.
- **Worker crash:** restart the worker. An expired lease allows a new claim; processed chunks remain checkpointed.
- **CSRF/origin error:** match the exact frontend origin, including protocol and port in development. Do not disable origin checking to fix deployment.
- **Session disappears:** confirm the browser uses the Vercel `/api` proxy and production Secure cookies. Direct cross-site calls are not the supported deployment.
- **No graph entities:** verify document readiness and actual extracted evidence. Do not insert seed data as a fix.
- **No answer context:** ask about a named concept in a ready source. Retrieval is lexical plus graph, not embedding-based semantic search.
- **Neon connection errors:** retain TLS and verify database capacity / network access. The driver supports pooled transaction endpoints.
- **Backups:** configure and test Neon restore/PITR appropriate to your plan. Never test recovery by erasing the production schema.

Events, expired sessions, stale worker records, and rate-limit buckets are pruned by worker maintenance. Events retain seven days. Sources, graph records and conversations persist until explicitly deleted. Original uploaded binaries are not stored; their extracted text is. Saved conversation citation snapshots persist separately from a deleted source.

This is a working individual-workspace release. Public launch still needs hosted-path verification, load tests, backup/restore rehearsal, monitoring/alerts, and an edge-wide request/connection abuse policy. Password reset email, account verification, team roles, OCR, crawling, billing and enterprise compliance are outside the implemented scope.

## Cockpit telemetry API

`GET /api/spaces/{space_id}/operations` returns owner-scoped document jobs with durable chunk completion counts and source-validated mention/relationship counts. `GET /api/spaces/{space_id}/activity?limit=50&before=<event_id>` returns newest-first durable events; limits are bounded to 100 and retention remains seven days. Both endpoints enforce space ownership.

The existing events stream now includes named `heartbeat` frames with server time/cursor, plus explicit chunking, extracting and committed-checkpoint events. `change` frames include stable event IDs. Chat streams add `stage` frames (`retrieved`, `generating`, `validating`) and measured `elapsed_ms`/`token_events` in `done`. Existing `context`, `token`, `done`, and `error` frames are preserved. No new environment variables or migrations are required.
