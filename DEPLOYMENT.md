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

Answer and extraction models use the explicit free-model configurations below. Free-model quotas and availability apply. A configured key is not an uptime guarantee; failed inference is surfaced to the user and retried by the durable job worker where appropriate.

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

The cockpit release adds `OPENROUTER_EXTRACTION_MODEL=dots-studio/dots-3-note-preview:free` on the API and worker. `OPENROUTER_MODEL=dots-studio/dots-3-note-preview:free` routes research answers. Both settings reject paid IDs. The extraction prompt selects up to 16 entities and 20 relationships per passage, with short quotes and a 120-second total provider deadline. This avoids oversized graphs and separates structured extraction from reasoning-heavy answer routing. Free provider availability can still require retries or a different free model ID.

`OPENROUTER_EXTRACTION_FALLBACKS` supplies an ordered, free-only failover list for upstream quota/availability errors. Defaults: `xingchen-agi/xing4.0-29b-a4b:free,nvidia/nemotron-3.5-super-vl:free`. The actual responding model is recorded on each committed checkpoint event. All extracted quotes still pass the same source check. Model failover never supplies fabricated data.

Structured extraction sends the full required JSON Schema with strict mode and `provider.require_parameters=true`. Default extraction candidates support structured outputs and optional reasoning; reasoning is disabled to preserve the visible output budget. Required relationship confidence fields are never invented by the server.

Answers use `OPENROUTER_REASONING=false` and the free-only `OPENROUTER_FALLBACKS` list (Xing 4, then Nemotron 3.5 Super VL). These controls prevent the default answer budget from being consumed entirely by reasoning before visible tokens are emitted. The actual answer model remains stored with every completed cited answer. `openrouter/free` is still supported as an explicit operator choice, with its routing variability.

## Cockpit hosted acceptance

The cockpit release completed its live two-passage ingestion, persisted checkpoint recovery, 21-entity/20-relationship graph, durable event replay and natural-question retrieval checks. A cited answer streamed 244 real provider token events and persisted its two citations through the Vercel → Railway → Neon path. See the final cockpit section of `VERIFICATION.md` for evidence and the provider fixes identified by live testing.
