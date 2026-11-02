import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile("vercel.json", "utf8"));
const proxy = config.rewrites?.find((route) => route.source === "/api/:path*");
if (!proxy?.destination?.startsWith("https://")) {
  throw new Error(
    "Configure the API proxy BEFORE deploying: RAILWAY_API_URL=https://your-actual-api-origin npm run configure:vercel. Commit the resulting vercel.json. See frontend/README.md.",
  );
}
console.log("Deployment routing verified.");
