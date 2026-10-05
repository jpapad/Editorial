# Tests

```bash
npm run test:unit        # pure logic, no server needed (~10s)
npm run test:sql         # runs sql/00_ALL.sql twice on in-process Postgres + checks RLS/functions (~5s)
npm run dev              # in another terminal, for the browser tests
npm run test:e2e         # every browser test (~3 min)
npm run test:e2e -- share templates   # only files whose name matches
npm test                 # all three
```

- `unit/*.test.mts`: geometry, gap check, worksheets, age check, sketch cleanup. Run with tsx.
- `sql.test.mjs`: PGlite (real Postgres in WebAssembly) with a small stand-in for Supabase's `auth` schema. Run it after every change in `sql/` (and `npm run sql:all` first).
- `e2e/*.test.mjs`: Playwright driving the real app. Each prints `PASS`/`FAIL` lines and exits non-zero on failure.
  - Tests for signed-in screens use `mockSupabase.mjs`: a fake session cookie plus canned REST/RPC answers. They never touch the real Supabase project; they only read its URL from `.env.local`.
  - The signed-out editor at `/` needs no mock.
  - English UI by default (`newPage(b)`). Use `newPage(b, { lang: null })` for the Greek default.
  - Screenshots go to `e2e/.output/` (git-ignored).
- Against another server: `BASE_URL=https://… npm run test:e2e`.
