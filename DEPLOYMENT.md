# Production deployment

Deployed on 2 November 2026.

| Resource | Location |
| --- | --- |
| Live application | https://knowsphere-ai-praneethpw.vercel.app |
| API readiness | https://knowsphere-api-production.up.railway.app/api/health/ready |
| Source | https://github.com/PraneethPW/KnowSphere |
| Vercel project | https://vercel.com/praneeths-projects-85472172/knowsphere-ai-praneethpw |
| Railway project | https://railway.com/project/66b15452-afbf-4ac3-b1e4-302bd366b31f |

The application, API and ingestion worker are deployed. Neon and OpenRouter secrets exist only in Railway service variables and the ignored local development environment. There is no seeded production account or demo graph; create your own account to begin.

## Continuous deployment

- Vercel is connected to `PraneethPW/KnowSphere`, building `frontend` from `main` with Node 24. Production aliases use the URL above. Preview deployments remain protected by Vercel authentication.
- Both Railway services are connected to the same repository and branch, using `/backend` as their service root and its Dockerfile. `knowsphere-api` runs Uvicorn; `knowsphere-worker` runs `python -m knowsphere.worker` without a public domain.
- Both services run `python -m knowsphere.migrate` before deployment. Migrations serialize through a PostgreSQL lock.
- GitHub Actions verifies the frontend, backend and infrastructure source. The backend test job uses a disposable PostgreSQL service; it never resets Neon.
- Git pushes deploy the application code. Changes to `.railway/railway.ts` require a separate reviewed Railway infrastructure plan/apply; Railway does not evaluate IaC during application deploys.

## Production settings

`APP_ENV=production`, `COOKIE_SECURE=true`, and `ALLOWED_ORIGINS=https://knowsphere-ai-praneethpw.vercel.app` are configured on Railway. The frontend's checked-in `vercel.json` proxies `/api` to the actual Railway origin and never caches authenticated API responses. Secure HttpOnly cookies stay first-party.

The OpenRouter model remains `openrouter/free`. Free-model quotas and availability apply. A configured key is not an uptime guarantee; failed inference is surfaced to the user and retried by the durable job worker where appropriate.

## Verified hosted flow

The complete public Vercel path was tested with a disposable verification account and a factual description of the implemented architecture:

1. Register and authenticate through Vercel; validate Secure/HttpOnly session forwarding.
2. Confirm a new space is empty and the cloud worker heartbeat is live.
3. Upload TXT through the hosted proxy and the resource-isolated Linux parser.
4. Receive durable SSE change events through Vercel.
5. Let the Railway worker call the real OpenRouter service and persist its extraction in Neon. The local development worker was stopped to ensure the hosted worker performed this step.
6. Read a graph with 17 evidenced entities and 16 relationship records; export the complete graph.
7. Stream a real cited answer through Vercel, then reload the saved conversation from Neon.
8. Revoke the session via logout. Remove the disposable account and its associated data after browser checks.

See `VERIFICATION.md` for checks and limits. The functional checks do not substitute for capacity planning, uptime alerts, backup/restore rehearsal or a security assessment for a specific public workload.

## Extraction model configuration

The cockpit release adds `OPENROUTER_EXTRACTION_MODEL=google/gemma-4-26b-a4b-it:free` on the API and worker. `OPENROUTER_MODEL=openrouter/free` continues to route research answers. Both settings reject paid IDs. The extraction prompt selects up to 16 entities and 20 relationships per passage, with short quotes and a 120-second total provider deadline. This avoids oversized graphs and separates structured extraction from reasoning-heavy answer routing. Free provider availability can still require retries or a different free model ID.

`OPENROUTER_EXTRACTION_FALLBACKS` supplies an ordered, free-only failover list for upstream quota/availability errors. Defaults: `dots-studio/dots-3-note-preview:free,google/gemma-4-31b-it:free`. The actual responding model is recorded on each committed checkpoint event. All extracted quotes still pass the same source check. Model failover never supplies fabricated data.
