import { readFile, writeFile } from "node:fs/promises";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const value = process.env.RAILWAY_API_URL || process.argv[2];
if (!value)
  throw new Error(
    "Set RAILWAY_API_URL to the public HTTPS origin of your Railway API, or pass it as an argument.",
  );
const origin = new URL(value);
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw new Error(
    "RAILWAY_API_URL must be an HTTPS origin without credentials, query, or path.",
  );
const config = JSON.parse(await readFile("vercel.json", "utf8"));
config.rewrites = [
  { source: "/api/:path*", destination: `${origin.origin}/api/:path*` },
  { source: "/((?!api/).*)", destination: "/index.html" },
];
await writeFile("vercel.json", JSON.stringify(config, null, 2) + "\n");
console.log("Vercel same-origin API proxy configured for", origin.origin);
