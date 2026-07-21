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
  assert.match(css, /@media \(max-width: 680px\)/);
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
});

test("static packaging includes a Pages-ready index", async () => {
  await Promise.all([
    access(new URL("_site/index.html", root)),
    access(new URL("_site/tracker.js", root)),
    access(new URL("_site/data/snapshots.json", root)),
    access(new URL("_site/.nojekyll", root)),
  ]);
});
