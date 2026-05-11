import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tokenPath =
  readArgument("--refresh-token-output") ??
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "next-strava-refresh-token");

const token = await refreshAccessToken({
  clientId: requiredEnv("STRAVA_CLIENT_ID"),
  clientSecret: requiredEnv("STRAVA_CLIENT_SECRET"),
  refreshToken: requiredEnv("STRAVA_REFRESH_TOKEN"),
});

mask(token.access_token);
mask(token.refresh_token);

await writeFile(tokenPath, token.refresh_token, { mode: 0o600 });

if (process.env.GITHUB_ENV) {
  await writeFile(process.env.GITHUB_ENV, `STRAVA_ACCESS_TOKEN=${token.access_token}\n`, { flag: "a" });
}

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `refresh_token_path=${tokenPath}\n`, { flag: "a" });
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function mask(value) {
  if (value) {
    process.stdout.write(`::add-mask::${value}\n`);
  }
}

async function refreshAccessToken(credentials) {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: HTTP ${response.status}`);
  }

  return response.json();
}
