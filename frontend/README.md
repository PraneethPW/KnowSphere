# KnowSphere frontend

React + TypeScript, Tailwind CSS, Framer Motion and Three.js. The dark editorial design combines a procedural orbital sculpture, scroll-driven transitions, restrained translucent panels and a data-driven 3D graph. All workspace records are fetched from the backend; the landing sphere is decorative geometry.

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

`npm run preview` serves the compiled static assets only. It does not configure a production API proxy; use the development server for local full-stack work or the configured Vercel rewrite for deployed builds.

Three.js is intentionally lazy loaded. The graph's force layout runs in a Web Worker. The desktop sidebar collapses to an off-canvas navigation on mobile. Reduced-motion preferences disable ambient rotation and animation. The entity-list view supplies keyboard navigation and a WebGL fallback.

## Source map

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Routes, protected entry, notifications |
| `src/Landing.tsx`, `src/components/Orb.tsx` | Scroll-driven introduction and procedural 3D artwork |
| `src/Auth.tsx` | Registration and login |
| `src/Workspace.tsx` | Space selection, navigation, real-time events, service warnings |
| `src/pages/Dashboard.tsx` | Actual counters, activity, graph analysis and settings |
| `src/pages/Library.tsx` | Upload/paste, source inspection, retry/cancel/delete |
| `src/pages/Graph.tsx`, `src/components/GraphScene.tsx` | Filtering, live graph rendering and evidence inspection |
| `src/layout.worker.ts` | Force layout derived from actual entity/relationship IDs |
| `src/pages/Chat.tsx` | True streamed answers, saved history and citations |
| `src/api.ts` | Typed request wrapper, streaming parser and exports |
| `src/styles.css` | Design tokens, responsive layouts, motion and focus states |

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

## Cockpit UI

`src/cockpit.css` defines the navy/cyan/orange instruments, angular panels, responsive layouts and reduced-motion overrides. `public/fonts` contains licensed, self-hosted Latin WOFF2 fonts and their OFL notices. `src/live.tsx` owns one reconnectable event subscription per active space and merges durable history after the server cursor is established.

The command-center radar uses actual graph records. Operations show worker checkpoints and retained events; tactical tools calculate paths on the visible filtered graph; Cmd/Ctrl+K opens entity/passage search. The comms research monitor renders measured request events, not simulated progress. Three.js remains lazy loaded and its rendering/layout resources are cleaned up when unmounted.

If a browser tab outlives a deployment and its lazy bundle is no longer available, the module boundary offers an explicit reload notice. It does not silently reload while the operator is editing text.

The research channel handles `reset` frames during a bounded citation-repair pass, replacing the provisional draft while retaining measured stream-event totals. The trace reports the repair and only marks the answer committed after the server's persistence event.
