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

## Remaining external verification

- Railway and Vercel have **not** been deployed. The selected Railway connection is **Praneeth**. A new connected GitHub repository / source URL is still required for the Railway source deployment.
- The Vercel proxy must be generated from the actual deployed Railway API origin before deployment. Its build preflight rejects an unconfigured rewrite.
- Hosted first-party cookies, hosted streaming/reconnects, proxy upload limits, and the complete production URL flow still require verification after deployment.
- Docker configuration is included, but no local container image build was performed because the local Docker daemon was unavailable.
- No load-test capacity, penetration-test certification, enterprise compliance or provider uptime guarantee is claimed. OpenRouter free-model quotas and availability remain external constraints.
- A Three.js core chunk remains large (~704 kB uncompressed, ~181 kB gzip). It is loaded lazily; browser bundle-size optimization can be expanded if required for a specific mobile performance target.

## Local handoff

Project: `/Users/praneethreddy/Freelance Projects /KnowSphere-AI` (the existing parent folder contains a trailing space).

Frontend: <http://127.0.0.1:5173>. API readiness: <http://127.0.0.1:8000/api/health/ready>.

Separate setup, operation and deployment guides are in `frontend/README.md` and `backend/README.md`. Git is initialized on `main`; no remote repository has been guessed or configured.
