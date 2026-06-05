import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchCommutes } from "./fetch-commutes.mjs";
import { fetchStravaActivities } from "./fetch-strava-activities.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const envPath = path.join(repoRoot, ".env");
const staticEntries = ["index.html", "main.js", "assets", "components"];

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

for (const entry of staticEntries) {
  await cp(path.join(repoRoot, entry), path.join(distDir, entry), { recursive: true });
}

const activitiesPath = path.join(distDir, "activities.json");
if (process.env.STRAVA_ACCESS_TOKEN) {
  await fetchStravaActivities({
    accessToken: process.env.STRAVA_ACCESS_TOKEN,
    outputPath: activitiesPath,
  });
} else {
  await cp(path.join(repoRoot, "activities.mock.json"), activitiesPath);
}

const commutesPath = path.join(distDir, "commutes.json");
if (process.env.COMMUTE_LOG_TOKEN) {
  await fetchCommutes({
    token: process.env.COMMUTE_LOG_TOKEN,
    outputPath: commutesPath,
  });
} else {
  await cp(path.join(repoRoot, "commutes.mock.json"), commutesPath);
}
