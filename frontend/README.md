# KnowSphere frontend

React + TypeScript with a focused landing → authentication → dashboard flow. The dashboard brings together source upload, ML passage search, AI questions, recent documents, and actual service status. All workspace data comes from the backend.

## Install and run

Use Node.js 22.12+ (24 recommended).

```bash
npm ci
cp -n .env.example .env
npm run dev
```

Open <http://localhost:5173>. Start the API on port 8000 and the Python worker separately. The Vite proxy handles `/api`; the browser always uses its own origin. `API_PROXY_TARGET` can change the local upstream. Never expose database or provider credentials through `VITE_*`.

## Build and test

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

`npm run preview -- --port 4173` serves the production build and proxies `/api` using `API_PROXY_TARGET`, just like the dev server. Add the preview origin to backend `ALLOWED_ORIGINS` before testing authenticated mutations. Run `npm run smoke -- http://127.0.0.1:4173` for read-only routing and health checks.

Three.js is intentionally lazy loaded. The graph's force layout runs in a Web Worker. The desktop sidebar collapses to an off-canvas navigation on mobile. The keyboard-accessible entity list is the default graph view. Optional 3D renders on demand without ambient rotation; reduced-motion preferences are respected.

## Source map

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Routes, protected entry, notifications |
| `src/Landing.tsx` | Concise product introduction and authentication links |
| `src/Auth.tsx` | Registration and login |
| `src/Workspace.tsx` | Space selection, navigation, real-time events, service warnings |
| `src/pages/DashboardHome.tsx` | AI question entry, ML search handoff, recent sources and live counts |
| `src/pages/Dashboard.tsx` | Shared queries, graph analysis and settings |
| `src/pages/Library.tsx` | Upload/paste, source inspection, retry/cancel/delete |
| `src/pages/Graph.tsx`, `src/components/GraphScene.tsx` | Filtering, live graph rendering and evidence inspection |
| `src/layout.worker.ts` | Force layout derived from actual entity/relationship IDs |
| `src/pages/Chat.tsx` | True streamed answers, saved history and citations |
| `src/api.ts` | Typed request wrapper, streaming parser and exports |
| `src/styles.css`, `src/product.css`, `src/immersive.css` | Shared controls, responsive product layouts and the immersive visual theme |
| `src/components/Atmosphere.tsx`, `src/components/Orb.tsx` | Shared background/scroll progress and the lazy decorative landing reactor |

## Deploy to Vercel

1. Deploy and verify the Railway API and worker first. Obtain the API's actual HTTPS origin.
2. Configure the rewrite **before creating a Vercel deployment**:

   ```bash
   RAILWAY_API_URL='https://YOUR-ACTUAL-RAILWAY-API-ORIGIN' npm run configure:vercel
   ```

   This modifies `vercel.json`; commit that file. Vercel reads routing configuration before the build, so setting this variable only during the Vercel build is insufficient.
3. Import the Git repository into Vercel. Set Root Directory to `frontend`, Framework to Vite, Node to 24.x. Keep the included build/install/output settings.
4. Configure `ALLOWED_ORIGINS` on both Railway services to the exact HTTPS frontend origin; set `APP_ENV=production` and `COOKIE_SECURE=true`.
5. Verify register/login, file upload, ingestion SSE reconnects, graph inspection, token streaming, history persistence, export and logout through the deployed frontend URL.

Keep API responses uncached. Security headers and a same-origin CSP are included. Cookies stay HttpOnly and first-party because the browser talks to `/api` on Vercel, which proxies to Railway. Do not substitute a direct cross-site API URL in the React client. Each preview domain must be explicitly allowed by the backend or assigned a stable preview alias; do not use a wildcard credentialed origin.

The deployment preflight fails clearly when the rewrite has not been configured. A successful static build alone does not verify live Railway connectivity.

## Real-time features

`src/live.tsx` owns one reconnectable event subscription per active space. Worker events refresh source lists, dashboard counts and processing progress. Graph publications and source deletion also refresh an open search. History is merged after the server cursor is established, and periodic snapshot recovery handles missed events.

The header search and Cmd/Ctrl+K open actual entity/passage search. The dashboard can pass its current question into ML search or AI chat. Chat renders genuine provider tokens and a compact status for retrieval, generation, citation validation and persistence. Citation-repair reset frames replace the provisional draft; an answer is shown as saved only after the persistence event. Source evidence, errors and retry controls remain accessible.

Detailed processing checkpoints and event history live in Activity. Graph analytics are linked from the graph toolbar. Model identifiers and configuration details live in Settings. The concise workflow preserves the original navy/cyan/orange visual theme across every page. `src/immersive.css` supplies background artwork, local typography, panel glow, input focus, control shimmer and shared surfaces. Landing features reveal on scroll, the 3D artwork has scroll parallax, and a thin progress line follows document scrolling. The decorative reactor mounts near the viewport, unmounts offscreen, and pauses WebGL rendering in hidden tabs. Reduced-motion preferences select a static illustration and disable shimmer/parallax/ambient animation. The scene boundary handles unavailable decorative graphics without hiding page content. No extra appearance controls or operational panels are added.

A module boundary offers an explicit reload notice when a tab outlives its deployment. It does not automatically discard text being edited. See [../INSTALL.md](../INSTALL.md) for environment variables and setup.
