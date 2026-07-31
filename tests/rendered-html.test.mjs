import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("dashboard ships the required static assets and data hooks", async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL("public/tracker.html", root), "utf8"),
    readFile(new URL("public/tracker.css", root), "utf8"),
    readFile(new URL("public/tracker.js", root), "utf8"),
  ]);
  assert.match(html, /AIL Social Media Monitoring/);
  assert.match(html, /id="trend-chart"/);
  assert.match(html, /id="post-table"/);
  assert.match(html, /id="mention-list"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="status-view"/);
  assert.match(html, /aria-controls="status-view"/);
  assert.match(html, /id="download-data"[^>]*>Export audience data</);
  assert.match(html, /id="download-mentions"[^>]*>Export mentions</);
  assert.doesNotMatch(html, />Download archive</);
  assert.match(html, />Tracked audience total</);
  assert.match(html, />Visible engagements</);
  assert.doesNotMatch(html, />Known cross-channel count</);
  assert.doesNotMatch(html, /Posts tracked is the number of recent posts/);
  assert.match(html, /data-range="1">1D</);
  assert.match(html, /data-range="7">7D</);
  assert.match(html, /data-range="30" class="active"/);
  assert.match(html, /data-range="0">All</);
  assert.doesNotMatch(html, /data-range="90"/);
  assert.match(html, /Mentions &amp; guest appearances/);
  assert.match(html, /Reach coverage:/);
  assert.doesNotMatch(html, />Posts captured</);
  assert.match(html, /ail-mark\.png/);
  assert.match(html, /rrossactivate\.github\.io\/social-media-monitor\/og\.png/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /font-family: "Geist"/);
  assert.match(css, /#004fa6/i);
  assert.match(script, /data\/snapshots\.json/);
  assert.match(script, /data\/mentions\.json/);
  assert.match(script, /fullNumber\.format\(Math\.round\(label\)\)/);
  assert.match(script, /includeComparison/);
  assert.match(script, /all-time change/);
  assert.match(script, /\$\{state\.days\}D change/);
  assert.match(script, /Compared with the previous daily snapshot/);
  assert.match(script, /mention-reach-summary"\)\.hidden = !hasVisibleReach/);
  assert.doesNotMatch(script, /channel-activity/);
  assert.doesNotMatch(script, /compactNumber/);
  assert.match(css, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.doesNotMatch(html, /react-loading-skeleton|Codex is working/);
});

test("earned mentions are verified, deduplicated, and explicit about unavailable reach", async () => {
  const mentions = await readFile(new URL("public/data/mentions.json", root), "utf8").then(JSON.parse);
  assert.ok(mentions.length >= 8);
  assert.equal(new Set(mentions.map((mention) => mention.id)).size, mentions.length);
  assert.equal(new Set(mentions.map((mention) => mention.url)).size, mentions.length);
  assert.ok(mentions.every((mention) => mention.source === "web-verified"));
  assert.ok(
    mentions.every((mention) =>
      ["day", "relative-hour", "relative-day"].includes(mention.datePrecision),
    ),
  );
  assert.ok(mentions.every((mention) => ["podcast-guest", "social-mention", "book-mention"].includes(mention.type)));
  assert.ok(mentions.every((mention) => Array.isArray(mention.platforms) && mention.platforms.length));
  assert.ok(mentions.every((mention) => mention.reachStatus === "not-visible" && mention.views === null));
  assert.ok(
    mentions.every(
      (mention) =>
        mention.engagements === null ||
        (Number.isFinite(mention.engagements) && ["exact-visible", "visible-minimum"].includes(mention.engagementsPrecision)),
    ),
  );
});

test("archive data has unique date and channel pairs", async () => {
  const [channels, snapshots, status] = await Promise.all([
    readFile(new URL("public/data/channels.json", root), "utf8").then(JSON.parse),
    readFile(new URL("public/data/snapshots.json", root), "utf8").then(JSON.parse),
    readFile(new URL("public/data/status.json", root), "utf8").then(JSON.parse),
  ]);
  const ids = new Set(channels.map((channel) => channel.id));
  const keys = snapshots.map((snapshot) => `${snapshot.date}:${snapshot.channelId}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(snapshots.every((snapshot) => ids.has(snapshot.channelId) && Number.isFinite(snapshot.audience)));
  assert.ok(Array.isArray(status.providers));

  const latestDate = snapshots.reduce((latest, snapshot) => (snapshot.date > latest ? snapshot.date : latest), "");
  const latestVerified = snapshots.filter((snapshot) => snapshot.date === latestDate);
  assert.deepEqual(
    new Set(latestVerified.map((snapshot) => snapshot.channelId)),
    new Set([
      "instagram-geoff",
      "linkedin-ai-leadership",
      "linkedin-geoff",
      "tiktok-geoff",
      "x-geoff",
      "youtube-ai-driven-leader",
    ]),
  );
  assert.ok(latestVerified.every((snapshot) => ["browser-verified", "youtube-api", "carry-forward"].includes(snapshot.source)));
  assert.ok(latestVerified.filter((snapshot) => snapshot.source === "carry-forward").every((snapshot) => snapshot.precision === "stale"));

  const july24Verified = Object.fromEntries(
    snapshots
      .filter((snapshot) => snapshot.date === "2026-07-24" && snapshot.source === "browser-verified")
      .map((snapshot) => [snapshot.channelId, snapshot.audience]),
  );
  assert.deepEqual(july24Verified, {
    "instagram-geoff": 5628,
    "linkedin-geoff": 18474,
    "x-geoff": 4101,
    "youtube-ai-driven-leader": 1600,
  });

  const july23Verified = Object.fromEntries(
    snapshots
      .filter((snapshot) => snapshot.date === "2026-07-23" && snapshot.source === "browser-verified")
      .map((snapshot) => [snapshot.channelId, snapshot.audience]),
  );
  assert.deepEqual(july23Verified, {
    "instagram-geoff": 5592,
    "linkedin-geoff": 18415,
    "x-geoff": 4096,
    "youtube-ai-driven-leader": 1570,
  });

  const youtubeSnapshot = snapshots.find((snapshot) => snapshot.date === "2026-07-27" && snapshot.channelId === "youtube-ai-driven-leader");
  assert.ok(["rounded", "api-rounded"].includes(youtubeSnapshot.precision));
});

test("verified cross-channel activity is archived without inventing unavailable metrics", async () => {
  const posts = await readFile(new URL("public/data/posts.json", root), "utf8").then(JSON.parse);
  assert.ok(posts.length >= 18);
  const postCounts = Object.fromEntries(
    ["linkedin-geoff", "instagram-geoff", "tiktok-geoff", "youtube-ai-driven-leader"].map((id) => [
      id,
      posts.filter((post) => post.channelId === id).length,
    ]),
  );
  assert.ok(postCounts["linkedin-geoff"] >= 6);
  assert.ok(postCounts["instagram-geoff"] >= 5);
  assert.ok(postCounts["tiktok-geoff"] >= 2);
  assert.ok(postCounts["youtube-ai-driven-leader"] >= 5);
  assert.ok(posts.every((post) => ["browser-verified", "youtube-api"].includes(post.source)));
  assert.ok(posts.filter((post) => post.channelId === "youtube-ai-driven-leader").every((post) => Number.isFinite(post.views) && (post.engagements === null || Number.isFinite(post.engagements))));
  assert.ok(posts.filter((post) => post.channelId === "tiktok-geoff").every((post) => Number.isFinite(post.views) && Number.isFinite(post.engagements) && ["exact-visible", "visible-minimum"].includes(post.engagementsPrecision)));
  assert.ok(posts.filter((post) => post.engagementsPrecision === "visible-minimum").every((post) => Number.isFinite(post.engagements)));
  assert.ok(posts.filter((post) => ["linkedin-geoff", "instagram-geoff"].includes(post.channelId)).every((post) => post.reachStatus === "not-visible" && !("views" in post) && !("impressions" in post)));
});

test("activity coverage remains verified while audience rows stay focused", async () => {
  const [channels, script] = await Promise.all([
    readFile(new URL("public/data/channels.json", root), "utf8").then(JSON.parse),
    readFile(new URL("public/tracker.js", root), "utf8"),
  ]);
  assert.ok(channels.every((channel) => channel.activityTracking?.status === "verified"));
  assert.doesNotMatch(script, /channel-activity/);
  assert.match(script, /visible-minimum/);
  assert.match(script, /metric-unavailable/);
  assert.match(script, /const exposurePosts/);
  assert.match(script, /Number\.isFinite\(exposure\)/);
});

test("static packaging includes a Pages-ready index", async () => {
  await Promise.all([
    access(new URL("_site/index.html", root)),
    access(new URL("_site/tracker.js", root)),
    access(new URL("_site/data/snapshots.json", root)),
    access(new URL("_site/data/mentions.json", root)),
    access(new URL("_site/fonts/geist-latin.woff2", root)),
    access(new URL("_site/ail-mark.png", root)),
    access(new URL("_site/og.png", root)),
    access(new URL("_site/.nojekyll", root)),
  ]);
});
