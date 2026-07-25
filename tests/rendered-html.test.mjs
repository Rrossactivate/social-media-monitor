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
  assert.match(html, /Social Audience Tracker/);
  assert.match(html, /id="trend-chart"/);
  assert.match(html, /id="post-table"/);
  assert.match(html, /ail-mark\.png/);
  assert.match(html, /geoff-woods-social-tracker\.robin-ross-6445\.chatgpt\.site\/og\.png/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /font-family: "Geist"/);
  assert.match(css, /#004fa6/i);
  assert.match(script, /data\/snapshots\.json/);
  assert.doesNotMatch(html, /react-loading-skeleton|Codex is working/);
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

  const latestVerified = Object.fromEntries(
    snapshots
      .filter((snapshot) => snapshot.date === "2026-07-25" && snapshot.source === "browser-verified")
      .map((snapshot) => [snapshot.channelId, snapshot.audience]),
  );
  assert.deepEqual(latestVerified, {
    "instagram-geoff": 5672,
    "linkedin-geoff": 18523,
    "x-geoff": 4103,
    "youtube-ai-driven-leader": 1630,
  });

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

  const youtubeSnapshot = snapshots.find((snapshot) => snapshot.date === "2026-07-25" && snapshot.channelId === "youtube-ai-driven-leader");
  assert.equal(youtubeSnapshot.precision, "rounded");
});

test("verified YouTube activity is archived without inventing engagement metrics", async () => {
  const posts = await readFile(new URL("public/data/posts.json", root), "utf8").then(JSON.parse);
  assert.equal(posts.length, 4);
  assert.ok(posts.every((post) => post.channelId === "youtube-ai-driven-leader" && Number.isFinite(post.views)));
  assert.ok(posts.every((post) => post.engagements === null && post.source === "browser-verified"));
  assert.deepEqual(posts.map((post) => post.views), [143, 100, 84, 392]);
});

test("static packaging includes a Pages-ready index", async () => {
  await Promise.all([
    access(new URL("_site/index.html", root)),
    access(new URL("_site/tracker.js", root)),
    access(new URL("_site/data/snapshots.json", root)),
    access(new URL("_site/fonts/geist-latin.woff2", root)),
    access(new URL("_site/ail-mark.png", root)),
    access(new URL("_site/og.png", root)),
    access(new URL("_site/.nojekyll", root)),
  ]);
});
