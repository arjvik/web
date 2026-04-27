import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const staticEntries = ["index.html", "main.js", "activities.json", "assets", "components"];

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

for (const entry of staticEntries) {
  await cp(path.join(repoRoot, entry), path.join(distDir, entry), { recursive: true });
}
