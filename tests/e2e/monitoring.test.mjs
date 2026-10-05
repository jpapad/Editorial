// Error log (browser errors reported, supervisors see and clear them) and API rate limits.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase } from "./mockSupabase.mjs";

const b = await launch();

// ---- a browser error is reported once to /api/log-error
const p = await newPage(b);
await p.addInitScript(() => localStorage.setItem("pagewright-report-errors", "1"));
const reports = [];
await p.route(`${BASE}/api/log-error`, async (route) => {
  reports.push(route.request().postDataJSON());
  await route.fulfill({ status: 204 });
});
await p.goto(`${BASE}/kids`);
await p.waitForTimeout(1500);
await p.evaluate(() => {
  for (let i = 0; i < 3; i++) setTimeout(() => { throw new TypeError("boom from the test"); }, 0);
  setTimeout(() => Promise.reject(new Error("rejected in the test")), 0);
});
await p.waitForTimeout(800);
check(reports.filter((r) => r.message === "TypeError: boom from the test").length === 1 && reports.some((r) => r.message === "Error: rejected in the test"), "uncaught errors and rejections are reported, each distinct message once", JSON.stringify(reports));
check(reports.every((r) => r.path === "/kids"), "with the page they happened on");
p.errors.length = 0; // those were thrown on purpose

// ---- the real endpoint: validates input and rate-limits
const bad = await fetch(`${BASE}/api/log-error`, { method: "POST", body: "{}", headers: { "x-forwarded-for": "203.0.113.7" } });
check(bad.status === 400, "an empty report is refused");
let last;
for (let i = 0; i < 21; i++) last = await fetch(`${BASE}/api/log-error`, { method: "POST", body: JSON.stringify({ message: `rate test ${i}` }), headers: { "x-forwarded-for": "203.0.113.8" } });
check(last.status === 429 && Number(last.headers.get("retry-after")) > 0, "more than 20 reports a minute from one address get 429 with Retry-After", String(last.status));
const other = await fetch(`${BASE}/api/log-error`, { method: "POST", body: JSON.stringify({ message: "other address" }), headers: { "x-forwarded-for": "203.0.113.9" } });
check(other.status === 204, "another address isn't affected");

// ---- supervisors see the log on /studio/admin and clear fixed errors
const a = await newPage(b, { viewport: { width: 1280, height: 1100 }, acceptDialogs: true });
const db = await mockSupabase(a, { isAdmin: true, users: [] });
db.errors = [
  { id: 1, source: "server", message: "TypeError: cannot read 'pages' of null", path: "route /api/export-editor-pdf", digest: null, user_agent: null, first_at: "2026-10-04T10:00:00Z", last_at: "2026-10-05T10:00:00Z", hits: 7 },
  { id: 2, source: "client", message: "Error: canvas too big", path: "/studio/editor", digest: null, user_agent: "Safari", first_at: "2026-10-05T09:00:00Z", last_at: "2026-10-05T09:30:00Z", hits: 1 },
];
await a.goto(`${BASE}/studio/admin`);
await a.waitForTimeout(2500);
const list = a.getByRole("list", { name: "Recent errors" });
check((await list.getByRole("listitem").count()) === 2 && await list.getByText(/7× · last/).isVisible(), "the admin page lists errors with how often they happened");
await a.screenshot({ path: shot("admin-errors.png"), fullPage: true });
await list.getByRole("button", { name: "Fixed" }).first().click();
await a.waitForTimeout(1200);
check(db.errors.length === 1 && (await list.getByRole("listitem").count()) === 1, "'Fixed' clears an error");
noPageErrors(p, a);
await b.close();
