# Verification record — 2 November 2026

## Result

The local application was verified against the supplied **real Neon database and real OpenRouter API**. Application responses were not mocked. Browser checks used a disposable verification account and the user's actual project requirements as source material, rather than a pre-populated demo dataset. Verification records were removed after checking the workflows; new accounts start empty.

## Automated checks

| Check | Result |
| --- | --- |
| Frontend TypeScript + production Vite build | Passed |
| Frontend streamed-event parser tests | 3 passed |
| Frontend npm dependency audit, including development dependencies | 0 reported vulnerabilities |
| Backend unit + real local PostgreSQL integration tests | 14 passed |
| Backend Ruff code checks and formatting | Passed |
| Python dependency consistency | Passed |
| Git-visible source scan for supplied database/provider credentials | No matches; private `.env` excluded |

Database integration tests ran on an isolated, disposable local PostgreSQL database. Their fixtures refuse remote database URLs and do not reset Neon. Test coverage includes session hashing/revocation, account isolation across resource routes, origin/header enforcement, input-value redaction, explicit missing-AI errors, lease claiming, stale-worker fencing, bounded crash recovery, quote validation, graph retrieval, deletion cascades and isolated upload parsing.

## Live service and browser evidence

| Boundary | Observed result |
| --- | --- |
| Migration → Neon | Dedicated `knowsphere` schema created and migration applied successfully |
| API → OpenRouter | Key access check returned HTTP 200; account identified as free tier |
| Registration → database | Real account, initial space and hashed session persisted |
| Login → interface | Browser signed in and displayed the real space |
| Text ingestion → worker | Actual project-requirements passage reached `ready`, 100%, on its first attempt |
| AI extraction → graph | Initial source produced 14 evidenced entities and 13 relationships |
| Multipart TXT upload → parser | File passed through the isolated subprocess into the durable queue |
| Automatic retry → recovery | Uploaded TXT job recovered from an incomplete/invalid provider response and reached `ready` on attempt 2 |
| Combined sources → graph | 16 entities and 24 source-backed relationship records after both documents were indexed |
| Live updates → interface | Source/graph changes appeared through the event stream, with a visible live-connection indicator |
| Graph → entity → original source | Browser opened Neon PostgreSQL's evidence and the original extracted document text |
| Retrieval → OpenRouter → stream | Real provider answer completed and was saved with citations |
| Chat UI → citation | Browser question about frontend technologies returned React, TypeScript, Tailwind CSS, Three.js and Framer Motion with source `[1]`; citation dialog showed the actual matching passage |
| Reload → conversation history | Saved answer and citation remained after a full page reload |
| Desktop UI | Graph, list, evidence panel, library and conversation views inspected |
| Mobile UI | 390px layout inspected; no horizontal document overflow; navigation opens/closes and hidden navigation is inert |

The supplied credentials are stored only in the ignored local backend environment file. Archives do not include them.

## Hosted verification — completed after the initial local build

The public Vercel frontend, both Railway services, and the real Neon/OpenRouter integrations have now been deployed and tested. The application code deployment is based on commit `463ae46` in `PraneethPW/KnowSphere`; subsequent documentation commits retain that application behavior.

Live application: <https://knowsphere-ai-praneethpw.vercel.app>. API readiness: <https://knowsphere-api-production.up.railway.app/api/health/ready>.

The hosted checks passed for first-party Secure/HttpOnly cookies, registration, session persistence, an initially empty space, worker heartbeat, multipart upload, resource-isolated Linux parsing, live SSE propagation through Vercel, real Railway-worker extraction, Neon graph persistence, graph export, actual provider token streaming, saved citations, and logout revocation. The cloud test source produced **17 entities and 16 relationships** on its first ingestion attempt. The answer streamed 10 provider token events using `dots-studio/dots-3-note-preview:free` and retained a valid source citation.

The local worker was stopped during this check so it could not satisfy the cloud job. The hosted application was also checked in the browser: sign-in, 3D graph rendering, stored conversation reload, and source evidence. No browser console errors were observed during those checks. The GitHub Actions workflow passed for the deployment commit, including the new Railway IaC type check.

Vercel and both Railway services are connected to the repository for future pushes. The obsolete `railway.json` files were replaced by type-checked `.railway/railway.ts`; new Railway services no longer accept Config as Code. Infrastructure changes require a separate reviewed plan/apply. See `DEPLOYMENT.md` for the service URLs and operating details.

## Remaining verification limits

- Uploads were verified with a small TXT document. The maximum advertised file size, large PDFs and provider saturation still need workload-specific hosted testing.
- The Docker image built and ran successfully on Railway. A local container build was not performed because the local Docker daemon was unavailable.
- No load-test capacity, penetration-test certification, enterprise compliance or provider uptime guarantee is claimed. OpenRouter free-model quotas and availability remain external constraints.
- A Three.js core chunk remains large (~704 kB uncompressed, ~181 kB gzip). It is loaded lazily; browser bundle-size optimization can be expanded if required for a specific mobile performance target.

## Local handoff

Project: `/Users/praneethreddy/Freelance Projects /KnowSphere-AI` (the existing parent folder contains a trailing space).

Local frontend: <http://127.0.0.1:5173>. Local API readiness: <http://127.0.0.1:8000/api/health/ready>. These are separate from the public production URLs above.

Separate setup, operation and deployment guides are in `frontend/README.md` and `backend/README.md`. Git is connected to the user-supplied repository `PraneethPW/KnowSphere` on `main`.

## Cockpit release — implementation verification

The second interface release replaces the original palette/layout with a navy, cyan and signal-orange cockpit. It adds a command-center radar using real graph records, an operations console with durable chunk telemetry and retained activity, named event heartbeats, source/entity search, neighborhood isolation, community filtering, shortest visible graph paths with source evidence, and a measured chat research trace.

Local checks: 15 backend tests passed against a newly initialized disposable local `knowsphere_test` database; 5 frontend tests passed; TypeScript and production Vite build passed; Ruff checks/format passed. New integration coverage checks telemetry counts, event cursor pagination, bounded limits and cross-owner denial. New graph tests cover shortest paths, parallel relations, cycles, disconnected endpoints and empty input.

Browser inspection confirmed the new landing reactor, operator login, a genuinely empty command center, a connected heartbeat/worker monitor and phone-width operations without horizontal overflow. Hosted feature verification follows deployment and is recorded separately below.

## Cockpit release — hosted result

The real production flow passed after the cockpit changes (functional release `cd0b5eb`). A 7,005-character project architecture document was processed as two passages by the Railway worker. Its first checkpoint survived failed provider responses and retries; strict JSON Schema output then allowed the remaining passage to complete. Final persisted telemetry: **26 evidenced mentions, 21 entities, 20 relationships, 2/2 passages complete**. The graph remained unpublished until the document was ready.

Verified through the public Vercel origin: owner-scoped operation snapshots, named SSE heartbeat/extraction/checkpoint/publication events, retained activity, cursor pagination, `Last-Event-ID` replay, matching graph/provenance counts and source search. A natural question that previously returned no context now retrieves both source passages. The answer stream emitted **244 actual provider token events**, completed in **14,917 ms** (including retrieval and persistence), used `dots-studio/dots-3-note-preview:free`, and saved two valid citation references in Neon. Timing is one measured request, not an SLA.

Browser checks confirmed a graph update in a second tab without refreshing, a two-hop KnowSphere AI → FastAPI → Neon PostgreSQL investigation path with quoted relationship evidence, neighborhood isolation from 21 to 11 visible entities, two Neon entity matches and two retrieved passages, and navigation to the original 7,005-character source. Mobile navigation and a 390px operations view were checked without document overflow. A stale lazy module from an older deployment showed the explicit update notice; its reload action loaded the current 3D graph successfully.

Provider issues found during this verification were corrected, not hidden: extraction now has bounded output, required JSON Schema, optional reasoning controls, a total deadline and free-only model failover; answers use explicit free models and reasoning controls; natural questions can broaden indexed search terms. Incomplete/uncited answers and malformed extractions remain explicit failures.

Final automated checks: **19 backend tests and 5 frontend tests pass**, including access isolation, durable telemetry/history, natural-question retrieval, required relationship fields and graph paths. TypeScript/Vite, Ruff and Railway IaC checks pass. The GitHub Actions run for the functional release is <https://github.com/PraneethPW/KnowSphere/actions/runs/41608108856>.

Citation quality hardening: a later browser request exposed a model answer without inline reference markers. Such drafts remain unsaved. The request now permits one genuine AI revision against the same source context, with explicit repair/reset events; both passes share a 150-second deadline. Isolated database tests cover successful repair (only the valid final answer persists), repeated invalid output (no assistant answer persists), stream reset framing and release of the generation lease.

Final hosted recheck (`d97fabe`): the production API streamed 94 actual token events with two citations in 10,959 ms. The final browser question independently committed its cited answer, showed 83 stream events and 13.4 seconds in the research trace, opened both source citations and retained the answer after a full reload. Search opened with keyboard focus in its input. The temporary verification account and all of its cascading source/graph/conversation/session data were then removed; the screenshot data came from this real verification workflow. No demonstration records remain in the application.

## Orbital cockpit verification — 21 November 2026

Fresh-clone checks were run from this repository using Node 24, Python 3.12 and a separate local PostgreSQL cluster. No production database was used by destructive integration tests.

- Frontend: 9 tests passed; TypeScript and Vite production build passed; npm audit reported zero vulnerabilities. Three.js remains lazy loaded and produces the existing large-chunk advisory.
- Backend: 21 tests passed against a disposable local `knowsphere_test` database. Ruff lint and formatting passed. Added coverage for owner-only space renaming, invalid names, database pool exhaustion, split CRLF stream packets, expired streamed sessions and safe sign-in destinations.
- Infrastructure: `.railway` TypeScript check passed. Compose configuration validated; actual local runtime used native PostgreSQL rather than Docker.
- Local runtime: migrated a separate development database; ran the API, worker and Vite server; all 14 read-only smoke checks passed on dev port 5173 and production-preview port 4173.
- Browser: inspected landing, sign-in, registration, command center, operations, graph, source library, chat, analysis and settings at desktop and mobile sizes. Verified protected upload deep-link restoration, space renaming, mobile navigation/search/sign-out, persistent focus mode, 16px auth inputs, no horizontal overflow on checked pages and no browser console errors during workspace navigation.

The initial public API readiness check returned 503. Railway runtime logs identified Neon quota exhaustion. The owner supplied a replacement database URL, which was applied to both Railway services without writing it into the repository. Both services redeployed, migrations completed and public readiness returned 200. This changes the active database; it does not migrate historical records from the previous database.

A disposable account then exercised the actual public Vercel → Railway → Neon → OpenRouter path:

1. Registered with a Secure, HttpOnly first-party session; the new graph was empty.
2. Confirmed the hosted worker was online and AI was configured.
3. Uploaded a factual UTF-8 architecture description through the hosted file parser.
4. The cloud worker completed real inference and persisted **8 entities and 7 relationships**.
5. Retrieved its original passage, exported the graph and received SSE ready/heartbeat frames.
6. Streamed a real answer from `dots-studio/dots-3-note-preview:free`, with **1 source citation and 2 provider token events**, then reloaded the persisted two-message conversation.
7. Revoked sessions and confirmed HTTP 401. Removed the disposable verification account and cascaded records using its exact generated ID and email.

This records functional verification, not a claim that every possible input, traffic level or upstream failure has been exhaustively tested. Email password reset/verification, OAuth, OCR and team sharing remain outside the implemented application. No simulated AI or demo records were added.

Repeat public release smoke checks from `frontend` with `npm run smoke -- https://knowsphere-ai-praneethpw.vercel.app`. Follow [INSTALL.md](INSTALL.md) for reproducible installation and the full environment-variable table.

A subsequent release check completed ingestion without satisfying the verifier's requirement for a populated graph. That requirement was too strict: valid extraction may produce no supported entities or no edges. The verifier now checks the returned schema and every published relationship quote against the actual source instead of demanding invented connections. Indexed-source empty states in command center, graph, analysis and chat now explain that source text remains searchable when no graph entities were extracted.

The final browser pass found a DOM removal error when unmounting Drei HTML labels during a 3D-to-list switch. Labels now render into a dedicated empty portal container, separating library-managed children from React's canvas container. An isolated local render regression used the real validated 8-entity/7-relationship provider result in a separate `knowsphere_render_test` database. Repeated 3D → list → 3D → list transitions completed with no console errors. This fixture is not shipped or seeded by the application.

## Neural retrieval — 27 November 2026

Integrated the pretrained `Xenova/ms-marco-MiniLM-L-6-v2` cross-encoder as local CPU ONNX INT8 inference before source search and answer context selection. Artifacts are pinned to a model commit and SHA-256 checksums; both preparation and API startup verify integrity. Long chunks use overlapping windows and return original-source offsets. Missing/corrupt models, inference errors and overload fail explicitly; operator-disabled ML is reported as disabled. The answer validator now requires valid citation coverage in every non-heading paragraph and permits only the existing bounded provider repair.

The complete, checksum-pinned BEIR SciFact test evaluation used 300 queries and 5,183 abstracts in the isolated local `knowsphere_ml_eval_test` database. Relevant-source Hit@1 increased from **23.00% to 51.67%**, Recall@8 from **47.89% to 62.64%**, and MRR@8 from **0.3190 to 0.5661**. Expanded lexical candidates without the model achieved Hit@1 **23.00%**, Recall@8 **48.56%**, MRR@8 **0.3213**. No test-set training, fine-tuning or threshold selection occurred. Candidate recall was 64.48%. The evaluation account and its cascaded records were removed afterward. [Methodology, resource measurements, limitations and per-query results](backend/evaluation/README.md).

Automated local verification: **34 backend tests**, **9 frontend tests**, Ruff lint/format, TypeScript, Vite production build and Railway infrastructure type checking passed. The model tests use actual pinned inference, including relevance versus keyword repetition, long-chunk tails, Unicode offsets, integrity rejection, concurrency separation, admission bounds and explicit failure. Database integration checks used disposable local `knowsphere_test`, including model status/search, cross-owner denial, exact excerpts, retryable model errors and cited/uncited paragraph repair persistence. Shared runtime/development/evaluation locks were resolved for Linux and Windows with platform markers.

Started the real API and frontend locally. All 14 public smoke checks passed through the Vite proxy. A browser used the separate `knowsphere_render_test` fixture to confirm Settings displayed the loaded CPU INT8 model and search returned the original PostgreSQL passage with the neural-ranking label. No browser console errors were recorded. The local fixture reuses previously validated source data; it is never seeded into production. Local OpenRouter was deliberately unconfigured for this UI check, so it does not establish a new provider-generation result.

Benchmark percentages measure source relevance, not generated-answer factuality or guaranteed performance on private documents. This adds no vector candidate index, OCR, multilingual validation or private-document training.

## Focused product interface — 27 November 2026

Replaced the presentation-heavy cockpit with a landing → sign in/register → dashboard flow. The dashboard offers source upload, an AI question form, ML passage search, recent sources and actual AI/ML/worker status. Primary navigation is Dashboard, Sources, AI chat, Knowledge graph and Activity. Graph analysis remains available from the graph toolbar. Authentication, sessions, ownership boundaries, model inference and evidence checks are retained.

Removed the decorative 3D reactor, background artwork, custom cockpit fonts, appearance controls, global telemetry, radar and duplicate idle panels. The graph opens as an accessible list; optional 3D uses demand rendering without ambient rotation. Chat displays concise live answer progress and source access instead of a metrics sidebar. A mobile empty-chat scroll issue was corrected so the welcome content starts at the top.

Local automated checks passed: 34 backend tests against disposable local PostgreSQL, 9 frontend tests, frontend typecheck/build, Railway infrastructure typecheck, deployment routing preflight and all 14 local proxy smoke checks. The production dependency audit reported no vulnerabilities. Compiled CSS decreased from approximately 127 kB to 78 kB before compression; the removed fonts and background image are no longer downloaded.

Browser checks covered the landing page, matching mobile sign-in/registration layouts, protected upload-link return after sign-in, source upload controls, dashboard-to-chat question prefill, real pinned-model search with original excerpts, mobile navigation, actual model status and list/3D graph switching without console errors. A separately isolated local source/event fixture verified the dashboard processing count changing 0 → 1 → 0 and its recent-source row appearing/disappearing without a reload. That fixture was removed; no fixture is shipped or seeded in production. Open-search caches now invalidate on source publication and deletion events.
