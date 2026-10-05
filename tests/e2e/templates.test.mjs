// Community templates: missing-table message, publish (coloring stripped), browse,
// use someone else's, remove your own.
import { BASE, launch, newPage, check, shot, noPageErrors } from './harness.mjs';
import { mockSupabase, bookRow, TEST_USER } from './mockSupabase.mjs';
const b = await launch();
const p = await newPage(b, { viewport: { width: 1400, height: 1000 }, acceptDialogs: true });
const writes = [];
const page = (id, extra = {}) => ({ id, pageNumber: 1, lines: [], objects: [], thumbnailDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', space: { width: 612, height: 792, bleed: 0 }, ...extra });
const src = bookRow({ pages: [page('p1', { fillDataUrl: 'data:secret', completedAt: '2026-09-01' }), page('p2')], bleed: true });
const other = { id: '44444444-4444-4444-8444-444444444444', author_id: '33333333-3333-4333-8333-333333333333', title: 'Ocean friends', description: 'Fish and whales', trim_size: '8.5x11', bleed: false, pages: [page('o1')], page_count: 1, thumbnail: null, created_at: '2026-09-01T00:00:00Z' };
const db = await mockSupabase(p, { books: [src], onWrite: (k, v) => writes.push([k, v]) });
const ok = (name, cond) => check(cond, name);

// 0. migration missing → friendly message
await p.goto(`${BASE}/studio`); await p.waitForTimeout(2000);
await p.getByRole('button', { name: 'Templates', exact: true }).click(); await p.waitForTimeout(800);
ok('missing-table message', await p.getByText("Templates aren't set up yet").isVisible());

// 1. publish from editor
db.templates = [other];
await p.goto(`${BASE}/studio/editor?book=${src.id}`); await p.waitForTimeout(3000);
await p.getByRole('button', { name: 'Share as a template' }).click();
await p.getByLabel('Description').fill('Two squares');
await p.getByRole('button', { name: 'Publish template' }).click(); await p.waitForTimeout(800);
ok('publish success', await p.getByText('Published!').isVisible());
const pub = writes.find(w => w[0] === 'book_templates')?.[1];
ok('publish payload', pub && pub.title === 'Test Book' && pub.page_count === 2 && pub.bleed === true && pub.description === 'Two squares');
ok('coloring stripped', pub && pub.pages.every(pg => !pg.fillDataUrl && !pg.completedAt));
await p.getByRole('button', { name: 'OK', exact: true }).click();

// 2. library gallery
await p.goto(`${BASE}/studio`); await p.waitForTimeout(2000);
await p.getByRole('button', { name: 'Templates', exact: true }).click(); await p.waitForTimeout(800);
ok('two templates listed', (await p.getByRole('button', { name: 'Use template' }).count()) === 2);
ok('own template has remove, other not', (await p.getByRole('button', { name: 'Remove template' }).count()) === 1);
await p.screenshot({ path: shot('templates.png') });

// 3. use other's template
const before = db.books.length;
await p.locator('div', { hasText: 'Ocean friends' }).getByRole('button', { name: 'Use template' }).last().click();
await p.waitForURL(/studio\/editor\?book=/, { timeout: 8000 }).catch(() => {});
ok('navigated to new book', /studio\/editor\?book=/.test(p.url()) && !p.url().includes(src.id));
const nb = db.books.at(-1);
ok('book copied', db.books.length === before + 1 && nb.title === 'Ocean friends' && nb.pages.length === 1 && nb.user_id === TEST_USER.id);

// 4. remove own
await p.goto(`${BASE}/studio`); await p.waitForTimeout(2000);
await p.getByRole('button', { name: 'Templates', exact: true }).click(); await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Remove template' }).click(); await p.waitForTimeout(800);
ok('removed', db.templates.length === 1 && (await p.getByRole('button', { name: 'Use template' }).count()) === 1);
noPageErrors(p);
await b.close();
