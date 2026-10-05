// Admin dashboard: stats tiles, activity charts with hover tooltip, per-user AI limit.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, TEST_USER } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1280, height: 1100 }, acceptDialogs: true });
const writes = [];
const daily = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.now() - (29 - i) * 864e5); return { day: d.toISOString().slice(0, 10), ai: Math.round(6 + 5 * Math.sin(i / 3) + (i % 7 === 0 ? 8 : 0)), exports: i % 4 === 0 ? 3 : i % 3 }; });
const users = [
  { id: TEST_USER.id, email: TEST_USER.email, created_at: '2026-01-02T00:00:00Z', last_sign_in_at: '2026-09-28T10:00:00Z', email_confirmed_at: '2026-01-02T00:00:00Z', is_admin: true, book_count: 3, ai_used: 12, ai_limit: 20 },
  { id: '33333333-3333-4333-8333-333333333333', email: 'teacher@example.com', created_at: '2026-03-01T00:00:00Z', last_sign_in_at: '2026-09-27T10:00:00Z', email_confirmed_at: '2026-03-01T00:00:00Z', is_admin: false, book_count: 5, ai_used: 18, ai_limit: 20 },
];
const db = await mockSupabase(p, { isAdmin: true, users, onWrite: (k, v) => writes.push([k, v]) });
db.stats = { users: 2, active_30d: 2, books: 8, published: 3, pages: 96, ai_month: 30, exports_month: 11, daily };
await p.goto(`${BASE}/studio/admin`); await p.waitForTimeout(2500);

check((await p.locator('figure').count()) === 2, 'two activity charts');
await p.locator('button', { hasText: 'teacher@example.com' }).click(); await p.waitForTimeout(300);
const input = p.getByRole('spinbutton', { name: 'Monthly AI limit' });
await input.fill('50'); await input.press('Enter'); await p.waitForTimeout(800);
const w = writes.find((x) => x[0] === 'ai_limit')?.[1];
check(w?.target_user === users[1].id && w?.new_limit === 50, 'setting a user’s AI limit calls admin_set_ai_limit', JSON.stringify(w));

const svg = p.locator('figure svg').first(); const box = await svg.boundingBox();
await p.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.5); await p.waitForTimeout(200);
const tip = await p.locator('figure [role=status]').first().textContent().catch(() => '');
check(/\d/.test(tip), 'hovering a day shows its value', tip);
await p.screenshot({ path: shot('admin.png'), fullPage: true });
noPageErrors(p);
await b.close();
