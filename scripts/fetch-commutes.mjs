import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const defaultOwner = "arjvik";
const defaultRepo = "commute-log";
const defaultIssueNumber = 1;
const githubApiVersion = "2026-03-10";
const dayMs = 24 * 60 * 60 * 1000;
const localTimeZone = "America/Los_Angeles";
const rfc2822TimestampPattern =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s+[+-]\d{4}$/i;

export async function fetchCommutes({
  token,
  outputPath = "commutes.json",
  owner = defaultOwner,
  repo = defaultRepo,
  issueNumber = defaultIssueNumber,
  now = new Date(),
} = {}) {
  if (!token) {
    throw new Error("Missing GitHub token for commute comments");
  }

  const comments = await fetchIssueComments({ token, owner, repo, issueNumber });
  const currentYear = Number(formatYear(now));
  const cutoff = new Date(now.getTime() - 7 * dayMs);
  const seenDates = new Set();
  const commutes = comments
    .flatMap((comment) => commuteLines(comment.body ?? ""))
    .map((timestamp) => normalizeCommute(timestamp, currentYear, cutoff))
    .filter(Boolean)
    .filter((commute) => {
      if (seenDates.has(commute.date)) {
        return false;
      }

      seenDates.add(commute.date);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        asOf: formatLocalDate(now),
        commutes,
      },
      null,
      2,
    )}\n`,
  );
}

async function fetchIssueComments({ token, owner, repo, issueNumber }) {
  const comments = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "arjvik-web-build",
        "x-github-api-version": githubApiVersion,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub issue comments request failed: HTTP ${response.status}`);
    }

    const pageComments = await response.json();
    if (!Array.isArray(pageComments)) {
      throw new Error("GitHub issue comments response was not an array");
    }

    comments.push(...pageComments);
    if (pageComments.length < 100) {
      return comments;
    }
  }
}

function commuteLines(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.match(/^COMMUTE\s+(.+?)\s*$/)?.[1])
    .filter(Boolean);
}

function normalizeCommute(timestamp, currentYear, cutoff) {
  if (!rfc2822TimestampPattern.test(timestamp)) {
    return null;
  }

  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime()) || instant > cutoff) {
    return null;
  }

  const date = formatLocalDate(instant);
  const year = Number(date.slice(0, 4));
  if (year !== currentYear) {
    return null;
  }

  return {
    date,
  };
}

function formatYear(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: localTimeZone,
    year: "numeric",
  }).format(date);
}

function formatLocalDate(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: localTimeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await fetchCommutes({
    token: process.env.COMMUTE_LOG_TOKEN,
    outputPath: readArgument("--output") ?? "commutes.json",
  });
}
