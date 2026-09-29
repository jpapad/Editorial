// Runs every tests/e2e/*.test.mjs against a running dev server
// (BASE_URL, default http://localhost:3000). Pass names to run a subset:
//   npm run test:e2e -- share templates
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BASE } from "./harness.mjs";

const dir = path.dirname(new URL(import.meta.url).pathname);
const only = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.mjs") && (only.length === 0 || only.some((o) => f.includes(o)))).sort();

try {
  await fetch(BASE, { signal: AbortSignal.timeout(5000) });
} catch {
  console.error(`No app at ${BASE}. Start it first with \`npm run dev\` (or set BASE_URL).`);
  process.exit(1);
}

const failed = [];
for (const f of files) {
  console.log(`\n── e2e/${f}`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: "inherit", timeout: 180_000 });
  if (r.status !== 0) failed.push(f);
  console.log(`   ${r.status === 0 ? "ok" : "FAILED"} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
console.log(`\ne2e: ${files.length - failed.length}/${files.length} files passed${failed.length ? ` — failed: ${failed.join(", ")}` : ""}`);
console.log(`screenshots: ${path.join(dir, ".output")}`);
process.exit(failed.length ? 1 : 0);
