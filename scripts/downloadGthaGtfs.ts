import "dotenv/config";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

type FeedConfig = {
  id: string;
  name?: string;
  url: string;
  enabled?: boolean;
  filename?: string;
};

const feedsFile = process.env.GTHA_GTFS_FEEDS_FILE ?? "./config/gtha-gtfs-feeds.json";
const outputDir = process.env.GTHA_GTFS_OUTPUT_DIR ?? "./data/otp";
const dryRun = process.env.GTHA_GTFS_DRY_RUN === "true";

const ensureDir = (dir: string) => mkdirSync(dir, { recursive: true });

const sanitizeId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseInlineFeeds = (value: string): FeedConfig[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) {
        throw new Error(`Invalid GTHA_GTFS_FEEDS entry: ${entry}. Use id=https://feed.zip`);
      }

      const id = sanitizeId(entry.slice(0, separatorIndex));
      const url = entry.slice(separatorIndex + 1).trim();
      return { id, url };
    });

const readFeeds = (): FeedConfig[] => {
  const inlineFeeds = process.env.GTHA_GTFS_FEEDS?.trim();
  if (inlineFeeds) return parseInlineFeeds(inlineFeeds);

  if (!existsSync(feedsFile)) {
    throw new Error(
      [
        `GTHA GTFS feed config is missing: ${feedsFile}`,
        "Create it from config/gtha-gtfs-feeds.example.json, or set GTHA_GTFS_FEEDS=id=https://feed.zip,...",
      ].join("\n"),
    );
  }

  const parsed = JSON.parse(readFileSync(feedsFile, "utf8")) as unknown;
  const feeds = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && "feeds" in parsed && Array.isArray((parsed as { feeds?: unknown }).feeds)
      ? (parsed as { feeds: unknown[] }).feeds
      : null;

  if (!feeds) {
    throw new Error(`${feedsFile} must be a JSON array or an object with a feeds array.`);
  }

  return feeds.map((feed) => {
    if (typeof feed !== "object" || feed === null) {
      throw new Error("Each GTHA GTFS feed entry must be an object.");
    }

    const candidate = feed as Partial<FeedConfig>;
    if (!candidate.id || !candidate.url) {
      throw new Error("Each GTHA GTFS feed entry needs id and url.");
    }

    return {
      ...candidate,
      id: sanitizeId(candidate.id),
      url: candidate.url.trim(),
    };
  });
};

const downloadFile = async (feed: FeedConfig) => {
  const filename = feed.filename ?? `${feed.id}.gtfs.zip`;
  const destination = path.join(outputDir, filename);

  ensureDir(outputDir);
  console.log(`Downloading ${feed.name ?? feed.id}`);
  console.log(`  ${feed.url}`);
  console.log(`  -> ${destination}`);

  const response = await fetch(feed.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${feed.id}: HTTP ${response.status}`);
  }

  const fileStream = createWriteStream(destination);
  await finished(Readable.fromWeb(response.body).pipe(fileStream));
};

const feeds = readFeeds().filter((feed) => feed.enabled !== false);

if (feeds.length === 0) {
  throw new Error("No enabled GTHA GTFS feeds are configured.");
}

console.log(`Writing GTFS feeds to ${outputDir}`);
for (const feed of feeds) {
  if (dryRun) {
    console.log(`Would download ${feed.name ?? feed.id}: ${feed.url}`);
  } else {
    await downloadFile(feed);
  }
}

console.log(dryRun ? "GTHA GTFS dry run complete." : "GTHA GTFS downloads complete.");
if (!dryRun) {
  console.log("Rebuild OTP with: npm run otp:build:gtha");
}
