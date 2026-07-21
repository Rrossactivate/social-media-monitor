import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "_site");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(path.join(root, "public/tracker.html"), path.join(target, "index.html"));
await cp(path.join(root, "public/tracker.css"), path.join(target, "tracker.css"));
await cp(path.join(root, "public/tracker.js"), path.join(target, "tracker.js"));
await cp(path.join(root, "public/data"), path.join(target, "data"), { recursive: true });
try { await cp(path.join(root, "public/og.png"), path.join(target, "og.png")); } catch {}
await writeFile(path.join(target, ".nojekyll"), "");
console.log(`Static dashboard prepared in ${target}`);
