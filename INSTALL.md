# Run KnowSphere locally

Use Node.js **22.12+** (24 recommended), Python **3.12**, Git, and PostgreSQL **17**. Docker Desktop is optional and provides the easiest local PostgreSQL setup. The API, worker, and frontend are three separate processes. No production credentials are included in this repository.

## 1. Clone and start a local database

```bash
git clone https://github.com/PraneethPW/KnowSphere.git
cd KnowSphere
cp .env.example .env
docker compose up -d --wait
```

Compose binds PostgreSQL to `127.0.0.1:54329`, creates the `knowsphere` database, and stores data in a named volume. The default password is exclusively for this loopback development database. If you change `POSTGRES_PASSWORD` in root `.env`, also change the password in `backend/.env`'s `DATABASE_URL`. Updating the variable after the volume has been initialized does not change an existing database role password.

Without Docker, create a PostgreSQL database yourself and set `DATABASE_URL` accordingly. Neon also works: use its pooled connection string with `sslmode=require` or stronger. Do not use the production database for development or tests.

## 2. Install and configure the API

From the repository root:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r requirements-dev.lock
cp .env.example .env
chmod 600 .env
```

On Windows, use `py -3.12 -m venv .venv` and `.venv\Scripts\Activate.ps1`. File upload isolation currently uses Unix resource limits; use WSL2 or the Linux backend container for uploads on Windows.

The template already points to the Compose database. Set `OPENROUTER_API_KEY` privately in `backend/.env` to enable real ingestion and answers. Without a key, account creation, navigation and empty workspaces work; AI actions return an explicit configuration error. There is no demo data or simulated AI.

```bash
python -m knowsphere.prepare_ml
python -m knowsphere.migrate
python -m uvicorn knowsphere.main:app --host 127.0.0.1 --port 8000
```

Keep this terminal open. API documentation: <http://127.0.0.1:8000/api/docs>. Readiness: <http://127.0.0.1:8000/api/health/ready>.

The model preparer downloads and verifies the pinned local MiniLM reranker (about 24 MB). Reranking runs on CPU; no GPU, training, or separate model server is needed. Existing OpenRouter configuration is still required for extraction and generated answers. Model weights are excluded from source archives and must be prepared once after installation. See [ML evaluation and limits](backend/evaluation/README.md).

## 3. Start the worker

In a second terminal, from the repository root:

```bash
cd backend
source .venv/bin/activate
python -m knowsphere.worker
```

The worker must use the **same database and AI configuration** as the API. It claims durable jobs and checkpoints progress. Without it, uploads remain queued.

## 4. Start the frontend

In a third terminal, from the repository root:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Use one hostname consistently so your session cookie stays on the same origin. Create an account, add a source, follow Activity until Ready, inspect the Knowledge graph and original quotes, then ask a question in AI chat.

`npm run build && npm run preview -- --port 4173` also proxies `/api` to the local API. If using preview, add `http://127.0.0.1:4173` to backend `ALLOWED_ORIGINS` and restart the API. The frontend never connects directly to Neon or OpenRouter.

## Environment files

`.env.example` is a **file**, not a folder. Copy the appropriate template to `.env` in the **same directory**. Actual `.env` files are Git-ignored.

| File | Setting | Purpose |
| --- | --- | --- |
| Root `.env` | `POSTGRES_PASSWORD` | Compose's local PostgreSQL password only |
| `frontend/.env` | `API_PROXY_TARGET` | Local API origin; defaults to `http://127.0.0.1:8000` |
| `frontend/.env` | `RAILWAY_API_URL` | HTTPS API origin used only by `npm run configure:vercel` |
| `backend/.env` | `DATABASE_URL` | PostgreSQL connection; local template matches Compose |
| `backend/.env` | `OPENROUTER_API_KEY` | Server-only key, required for ingestion/chat |
| `backend/.env` | `OPENROUTER_MODEL`, `OPENROUTER_EXTRACTION_MODEL` | Answer and extraction models; `:free` IDs or `openrouter/free` only |
| `backend/.env` | `OPENROUTER_FALLBACKS`, `OPENROUTER_EXTRACTION_FALLBACKS` | Up to three comma-separated free-model fallbacks per operation |
| `backend/.env` | `OPENROUTER_REASONING`, `OPENROUTER_EXTRACTION_REASONING` | Provider reasoning controls; default `false` |
| `backend/.env` | `APP_ENV` | `development` locally, `production` on Railway |
| `backend/.env` | `ALLOWED_ORIGINS` | Exact comma-separated frontend origins, including scheme and port |
| `backend/.env` | `COOKIE_SECURE` | `false` for local HTTP; **true for production HTTPS** |
| `backend/.env` | `REGISTRATION_ENABLED` | Whether new accounts may be created |
| `backend/.env` | `SESSION_DAYS` | Session lifetime, 1–30 days |
| `backend/.env` | `MAX_UPLOAD_BYTES`, `MAX_DOCUMENT_CHARS` | Upload/extracted-text limits; shown in upload UI |
| `backend/.env` | `MAX_DOCUMENTS_PER_SPACE`, `MAX_SPACES_PER_USER` | Account resource quotas |
| `backend/.env` | `WORKER_POLL_SECONDS` | Durable queue poll interval |
| `backend/.env` | `LOG_LEVEL` | Application logging level |
| `backend/.env` | `ML_ENABLED` | Enable local neural relevance ranking (default `true`) |
| `backend/.env` | `ML_CANDIDATES`, `ML_THREADS` | Candidate budget (12–64) and CPU threads (1–4); defaults 32 and 2 |
| `backend/.env` | `ML_MODEL_DIR` | Optional custom directory containing the prepared verified model |

Never put secrets in `VITE_*` variables: these become public browser code. Free models can be retired or rate-limited; choose currently available free IDs if a provider rejects the configured model.

## Automated verification

```bash
cd frontend
npm test
npm run typecheck
npm run build
npm audit --audit-level=moderate
# Keep the frontend and API running:
npm run smoke -- http://127.0.0.1:5173
```

The smoke command is read-only and verifies SPA deep links, branding, live/ready API health and unauthenticated access isolation. It exits unsuccessfully for API HTML fallbacks, database outages, missing images or broken rewrites.

Backend integration tests **reset their test schema**. Use only a disposable local database with a name ending in `_test`:

```bash
# From the repository root, when using Compose:
docker compose exec postgres createdb -U knowsphere knowsphere_test
cd backend
source .venv/bin/activate
export TEST_DATABASE_URL='postgresql://knowsphere:knowsphere-local-only@127.0.0.1:54329/knowsphere_test'
python -m pytest -q
ruff check knowsphere tests
ruff format --check knowsphere tests
```

The test guard rejects remote hosts and databases without the `_test` suffix. Without the variable, database integration tests are skipped. Tests include isolated extraction/answer fixtures to check evidence and persistence; these are never used by the running application.

## Deploy and verify

Keep Vercel's project root at `frontend`. Keep both Railway services rooted at `backend` and configure their pre-deploy command as `python -m knowsphere.migrate`.

- API start: `uvicorn knowsphere.main:app --host 0.0.0.0 --port $PORT --no-access-log --timeout-graceful-shutdown 160`.
- Worker start: `python -m knowsphere.worker`. Do not add a public worker domain.
- On **both services**, set the real `DATABASE_URL`, `OPENROUTER_API_KEY` and production settings. Use `APP_ENV=production`, `COOKIE_SECURE=true` and the exact HTTPS Vercel origin in `ALLOWED_ORIGINS`.
- A replacement database starts with its own records. Changing a connection string does **not** migrate old users, sources or conversations. Migrate historical data separately if needed.

Before deploying the frontend:

```bash
cd frontend
RAILWAY_API_URL='https://your-actual-api-origin' npm run configure:vercel
node scripts/verify-deployment.mjs
npm run build
# Commit the generated vercel.json alongside your application changes.
```

Then verify the final deployed app:

```bash
npm run smoke -- https://your-actual-frontend-origin
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for project details. A successful Vercel build alone does not prove that the Railway database or AI is working.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Login/API reports database unavailable | `/api/health/ready` and Railway logs; a Neon quota error requires restoring quota or a usable database |
| Registration/login returns 403 | Add the exact browser origin to `ALLOWED_ORIGINS`; restart the API |
| Login repeatedly disappears locally | Keep `COOKIE_SECURE=false` for HTTP and use the same browser hostname |
| Upload stays queued | Start the worker against the same database; inspect Settings |
| AI returns 503 | Configure `OPENROUTER_API_KEY` on the API and worker |
| API startup reports missing/corrupt neural model | Activate the backend virtual environment and run `python -m knowsphere.prepare_ml`; check `ML_MODEL_DIR` if customized |
| Neural ranking returns busy/503 | Retry shortly; check API CPU/memory and concurrency before increasing candidate or thread counts |
| AI fails/retries | Inspect the recorded error, free-model access and provider quota |
| `/api` returns HTML | Repair the Vercel rewrite or local proxy; run the smoke command |
| PDF contains no extractable text | Run OCR separately, then upload the text |

Stop app processes with Ctrl+C. `docker compose stop` preserves local data. Do not remove the database volume unless you intentionally want to erase it.
