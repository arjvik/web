import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dayMs = 24 * 60 * 60 * 1000;
const outputPath = readArgument("--output") ?? "activities.json";
const tokenPath =
  readArgument("--refresh-token-output") ??
  path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "next-strava-refresh-token");

const clientId = requiredEnv("STRAVA_CLIENT_ID");
const clientSecret = requiredEnv("STRAVA_CLIENT_SECRET");
const refreshToken = requiredEnv("STRAVA_REFRESH_TOKEN");

const token = await refreshAccessToken({ clientId, clientSecret, refreshToken });
const athlete = await fetchAthlete(token.access_token);
const activities = await fetchActivities(token.access_token);
const enrichedActivities = await enrichActivitiesWithPhotos(token.access_token, activities);
const payload = {
  asOf: isoDate(new Date()),
  profileUrl: `https://www.strava.com/athletes/${athlete.id}`,
  activities: enrichedActivities.map(normalizeActivity),
};

await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(tokenPath, token.refresh_token, { mode: 0o600 });

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

function isoDate(date) {
  return date.toISOString().slice(0, 10);
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

async function fetchActivities(accessToken) {
  const after = Math.floor((Date.now() - 365 * dayMs) / 1000);
  const allActivities = [];

  for (let page = 1; ; page += 1) {
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    url.searchParams.set("after", String(after));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "200");

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          "Strava activity fetch failed with HTTP 403. Reauthorize the app with activity:read or activity:read_all scope.",
        );
      }
      throw new Error(`Strava activity fetch failed: HTTP ${response.status}`);
    }

    const pageActivities = await response.json();
    allActivities.push(...pageActivities);

    if (pageActivities.length < 200) {
      return allActivities;
    }
  }
}

async function fetchAthlete(accessToken) {
  const response = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Strava athlete fetch failed: HTTP ${response.status}`);
  }

  return response.json();
}

async function enrichActivitiesWithPhotos(accessToken, activities) {
  return Promise.all(
    activities.map(async (activity) => {
      if (!activity.total_photo_count) {
        return activity;
      }

      const detail = await fetchActivityDetail(accessToken, activity.id);
      return {
        ...activity,
        photos: extractPhotoUrls(detail.photos),
      };
    }),
  );
}

async function fetchActivityDetail(accessToken, activityId) {
  const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Strava activity detail fetch failed for ${activityId}: HTTP ${response.status}`);
  }

  return response.json();
}

function extractPhotoUrls(photos) {
  return Object.values(photos?.primary?.urls ?? {}).filter(Boolean);
}

function normalizeActivity(activity) {
  return {
    id: String(activity.id),
    date: activity.start_date_local.slice(0, 10),
    name: activity.name,
    type: activity.type,
    sport: activity.sport_type ?? activity.type,
    category: activity.commute ? "commute" : "training",
    distance_km: round(activity.distance / 1000, 1),
    moving_time_min: Math.round(activity.moving_time / 60),
    elevation_m: Math.round(activity.total_elevation_gain ?? 0),
    photos: activity.photos ?? [],
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
