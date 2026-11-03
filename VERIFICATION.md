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
