# KnowSphere Railway infrastructure

Railway's former `railway.json` configuration is deprecated and unavailable for new services. This folder uses the current TypeScript Infrastructure as Code SDK.

The production API and worker were configured through the Railway API; `.railway/railway.ts` records the same intended service configuration. Railway does not automatically evaluate this file on Git pushes. Application-source pushes deploy through the connected `PraneethPW/KnowSphere` repository.

The file preserves the existing Neon and OpenRouter secrets already stored on Railway. It does not provision another database or expose the worker publicly. The API's generated Railway domain is managed separately and is intentionally omitted from the desired-state file, as in Railway's imported configuration format.

To check the source:

```bash
cd .railway
npm ci
npm run check
```

To manage infrastructure later, install/authenticate the Railway CLI, link **KnowSphere-AI / production**, and run `railway config plan` from the repository root. Review the plan before `railway config apply`. A whole-project plan can remove resources omitted from this file, so do not apply it to another project or use a destructive confirmation flag without reviewing the exact changes. Never run `config pull --include-variables`; that would copy secret values into source.

The SDK is locked in this folder's `package-lock.json`. See [Railway's IaC documentation](https://docs.railway.com/infrastructure-as-code).
