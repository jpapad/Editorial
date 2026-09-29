// Runs every tests/unit/*.test.mts with tsx. Each file prints PASS/FAIL
// lines and exits non-zero on failure. No server needed.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "tests", "unit");
const only = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.mts") && (only.length === 0 || only.some((o) => f.includes(o)))).sort();
const tsx = path.join(root, "node_modules", ".bin", "tsx");

const failed = [];
for (const f of files) {
  console.log(`\n── unit/${f}`);
  const r = spawnSync(tsx, ["--tsconfig", path.join(root, "tsconfig.json"), path.join(dir, f)], { stdio: "inherit", cwd: root });
  if (r.status !== 0) failed.push(f);
}
console.log(`\nunit: ${files.length - failed.length}/${files.length} files passed${failed.length ? ` — failed: ${failed.join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
