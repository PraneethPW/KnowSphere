// Read-only checks: never creates an account or mutates production data.
const origin = new URL(process.argv[2] || "http://127.0.0.1:5173");
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.username ||
  origin.password
)
  throw new Error("Pass an HTTP(S) application origin without credentials.");
let failures = 0;
async function check(path, expected, kind) {
  try {
    const response = await fetch(new URL(path, origin), {
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
    const body = await response.text();
    const valid =
      response.status === expected &&
      (kind === "html"
        ? body.includes('id="root"')
        : kind === "image"
          ? response.headers.get("content-type")?.startsWith("image/")
          : kind === "ready"
            ? JSON.parse(body).status === "ready"
            : kind === "live"
              ? JSON.parse(body).service === "knowsphere-api"
              : typeof JSON.parse(body).detail === "string");
    console.log(`${valid ? "PASS" : "FAIL"} ${path}: HTTP ${response.status}`);
    if (!valid) failures++;
  } catch (error) {
    failures++;
    console.log(`FAIL ${path}: ${error.name}`);
  }
}
await Promise.all([
  ...[
    "/",
    "/auth",
    "/auth?mode=register",
    "/app/graph",
    "/app/library",
    "/app/chat",
    "/app/operations",
    "/app/insights",
    "/app/settings",
  ].map((path) => check(path, 200, "html")),
  check("/images/orbital-cockpit.jpg", 200, "image"),
  check("/api/health/live", 200, "live"),
  check("/api/health/ready", 200, "ready"),
  check("/api/auth/me", 401, "auth"),
  check("/api/spaces", 401, "auth"),
]);
if (failures) {
  console.error(
    `${failures} check(s) failed. Check the API proxy, database readiness and hosting logs.`,
  );
  process.exitCode = 1;
} else console.log("All 14 deployment smoke checks passed.");
