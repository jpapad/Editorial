// Which parts of sql/ are live in the Supabase project from .env.local?
// Read-only: asks each table for zero rows and the image bucket for a file
// that doesn't exist, with the public (anon) key. Usage: npm run check:supabase
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from .env.local");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const TABLES = [
  ["books", "00_books.sql"],
  ["app_admins", "01_admin_role.sql"],
  ["page_comments", "02_page_comments.sql"],
  ["book_shares", "04_book_shares.sql"],
  ["book_templates", "05_usage_and_templates.sql"],
  ["user_stamps", "06_user_library.sql"],
  ["book_versions", "06_user_library.sql"],
  ["user_media", "08_user_media.sql"],
];

let missing = 0;
for (const [table, file] of TABLES) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers });
  const body = res.ok ? "" : await res.text();
  // PostgREST: PGRST205 / 404 = no such table. 401/403 = it exists but is closed to anonymous visitors (as intended).
  const absent = res.status === 404 || /PGRST205|does not exist|Could not find the table/i.test(body);
  if (absent) missing++;
  console.log(`${absent ? "MISSING" : "ok     "}  table ${table.padEnd(16)} (${file})`);
}
const probe = await fetch(`${url}/storage/v1/object/public/book-images/__probe__`);
const text = await probe.text();
const noBucket = /bucket not found/i.test(text);
if (noBucket) missing++;
console.log(`${noBucket ? "MISSING" : "ok     "}  storage bucket book-images (07_image_storage.sql)`);
console.log(missing ? `\n${missing} missing — paste sql/00_ALL.sql into Supabase > SQL Editor and run it (safe to re-run).` : "\nEverything in sql/ is live.");
