# KnowSphere contributor instructions

- Keep all application code in `frontend/` or `backend/`.
- No demo records, sample dashboards, fabricated answers, mock API clients, or production fallbacks. Tests may use explicitly isolated fixtures.
- Never read secrets into logs, commit `.env`, or put a database URL / OpenRouter key in frontend code.
- All application tables live in the `knowsphere` PostgreSQL schema. Qualify every SQL table reference.
- Every workspace resource must be checked against the authenticated owner before reading or writing it. Add access-isolation coverage for new routes.
- Durable work belongs in the PostgreSQL worker. Preserve lease fencing, checkpoint transactions, cancellation, and evidence checks.
- Verify AI quotes against source text and validate all external model JSON. Never trust model output as SQL, code, or instructions.
- Use OpenRouter free models only, unless the owner explicitly changes that constraint.
- The browser calls `/api` on its own origin. Preserve the Vite development proxy and Vercel production rewrite so cookies remain first-party.
- Respect reduced motion, mobile layouts, keyboard access, source citations, loading states, and explicit failures.
- Before handoff: run frontend typecheck/build/test and backend tests against an explicitly disposable local test database. Do not run destructive tests on Neon.
- Changes must pass the repository CI. Update setup and operational docs with behavioral changes.
