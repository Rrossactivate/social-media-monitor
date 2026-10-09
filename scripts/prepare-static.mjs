import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "_site");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
let html = await readFile(path.join(root, "public/tracker.html"), "utf8");
for (const asset of ["tracker.js", "tracker.css"]) {
  const bytes = await readFile(path.join(root, "public", asset));
  const version = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  html = html.replace(`./${asset}`, `./${asset}?v=${version}`);
}
await writeFile(path.join(target, "index.html"), html);
await cp(path.join(root, "public/tracker.css"), path.join(target, "tracker.css"));
await cp(path.join(root, "public/tracker.js"), path.join(target, "tracker.js"));
await cp(path.join(root, "public/data"), path.join(target, "data"), { recursive: true });
await cp(path.join(root, "public/fonts"), path.join(target, "fonts"), { recursive: true });
await cp(path.join(root, "public/ail-mark.png"), path.join(target, "ail-mark.png"));
try { await cp(path.join(root, "public/og.png"), path.join(target, "og.png")); } catch {}
await writeFile(path.join(target, ".nojekyll"), "");
console.log(`Static dashboard prepared in ${target}`);
