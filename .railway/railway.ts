import { defineRailway, github, preserve, project, service } from "railway/iac";

// Keep credentials on Railway. They must never be exported into this repository.
const env = {
  DATABASE_URL: preserve(),
  OPENROUTER_API_KEY: preserve(),
  OPENROUTER_MODEL: "openrouter/free",
  APP_ENV: "production",
  COOKIE_SECURE: "true",
  ALLOWED_ORIGINS: "https://knowsphere-ai-praneethpw.vercel.app",
  PORT: "8000",
  REGISTRATION_ENABLED: "true",
  WORKER_POLL_SECONDS: "2",
  LOG_LEVEL: "INFO",
};

export default defineRailway(() => {
  const source = github("PraneethPW/KnowSphere", {
    branch: "main",
    rootDirectory: "/backend",
  });
  const build = { builder: "DOCKERFILE" as const, dockerfilePath: "Dockerfile" };
  const deploy = {
    preDeployCommand: ["python -m knowsphere.migrate"],
    restartPolicyType: "ON_FAILURE" as const,
    restartPolicyMaxRetries: 10,
    sleepApplication: false,
    drainingSeconds: 170,
  };
  const api = service("knowsphere-api", {
    source, build, env,
    deploy: {
      ...deploy,
      startCommand: "sh -c 'exec uvicorn knowsphere.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log --timeout-graceful-shutdown 160'",
      healthcheckPath: "/api/health/ready",
      healthcheckTimeout: 60,
    },
  });
  const worker = service("knowsphere-worker", {
    source, build, env,
    deploy: { ...deploy, startCommand: "python -m knowsphere.worker" },
  });
  return project("KnowSphere-AI", { resources: [api, worker] });
});
