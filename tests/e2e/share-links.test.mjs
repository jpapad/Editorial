// Teacher creates a share link; a signed-out child colors a clean copy that stays on
// their device; revoking the link locks it.
import { BASE, launch, newPage, check, shot, paintedPixels, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const circle = { kind: 'shape', id: 'c1', shapeKind: 'circle', x: 150, y: 250, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1, fill: '#ffffff', stroke: '#111827', strokeWidth: 6 };
const teacherCtx = await b.newContext({ viewport: { width: 1440, height: 960 } });
const t = await newPage(teacherCtx, { acceptDialogs: true });
const db = await mockSupabase(t, { books: [bookRow({ pages: [
  { id: 'p1', pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [circle], fillDataUrl: 'data:image/png;base64,TEACHERS_OWN_PAINT' },
  { id: 'p2', pageNumber: 2, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [], isBlankBack: true },
] })] });
await t.goto(`${BASE}/studio/editor?book=22222222-2222-4222-8222-222222222222`);
await t.waitForSelector('canvas', { timeout: 30000 }); await t.waitForTimeout(1500);
await t.getByRole('button', { name: 'Share for coloring' }).click();
await t.getByRole('button', { name: 'Create link' }).click(); await t.waitForTimeout(500);
const link = (await t.locator('[role=dialog] .font-pw-mono').first().textContent()).trim();
check(/\/share\/[0-9a-f-]{36}$/.test(link), 'teacher creates a link', link.replace(/.*\/share\//, '/share/'));
const kidUrl = link.replace(/^https?:\/\/[^/]+/, BASE);

const kidCtx = await b.newContext({ viewport: { width: 1200, height: 900 } });
const k = await newPage(kidCtx, { lang: null });
await mockSupabase(k, { signedIn: false, db });
await k.goto(kidUrl);
await k.waitForSelector('canvas', { timeout: 30000 }); await k.waitForTimeout(1500);
check((await paintedPixels(k)) === 0, "child starts with a clean page (teacher's paint stripped)");
check(/Σελίδα 1 από 1/.test(await k.locator('text=/Σελίδα \\d από/').textContent()), 'blank back left out');
const cb = await k.locator('canvas').first().boundingBox();
const c = await k.evaluate(() => { const r = window.Konva.stages[0].findOne('Ellipse').getClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await k.mouse.click(cb.x + c[0], cb.y + c[1]); await k.waitForTimeout(1200);
const painted = await paintedPixels(k);
check(painted > 10000, 'child fills the circle', `${painted}px`);
await k.reload(); await k.waitForSelector('canvas'); await k.waitForTimeout(1500);
check((await paintedPixels(k)) === painted, 'progress survives reload on this device');
check(db.books[0].pages[0].fillDataUrl === 'data:image/png;base64,TEACHERS_OWN_PAINT', "teacher's book not changed by the child");
await k.screenshot({ path: shot('share-kid.png') });

await t.getByRole('button', { name: 'Turn off' }).click(); await t.waitForTimeout(400);
const k2 = await newPage(kidCtx, { lang: null });
await mockSupabase(k2, { signedIn: false, db });
await k2.goto(kidUrl); await k2.waitForTimeout(2500);
check((await k2.locator('text=/δεν ισχύει/').count()) === 1, 'revoked link shows "no longer valid"');
noPageErrors(t, k, k2);
await b.close();
