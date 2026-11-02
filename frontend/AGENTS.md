# Frontend contribution notes

Inherit `../AGENTS.md`. Use React TypeScript and the existing Tailwind/Vite pipeline. Keep rendering-only Three.js modules lazy, dispose GPU resources, and keep layout work off the main thread. Use the server's actual records; never add a demo graph or fallback counters. Mutations need explicit busy/error/success states and must invalidate the relevant space-scoped queries. Preserve first-party `/api` calls, accessible dialogs, keyboard entity navigation, mobile navigation and reduced-motion behavior. Run `npm test` and `npm run build` after changes.
