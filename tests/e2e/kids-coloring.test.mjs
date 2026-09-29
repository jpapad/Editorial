// The children's coloring screen (Greek UI): legacy page conversion, pattern fill,
// brush, reward sticker, gallery, print, and saves that don't wipe book settings.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { lang: null, viewport: { width: 1200, height: 900 } });
const circle = (id) => ({ kind: 'shape', id, shapeKind: 'circle', x: 150, y: 250, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1, fill: '#ffffff', stroke: '#111827', strokeWidth: 6 });
const writes = [];
await mockSupabase(p, { books: [bookRow({ pages: [
  { id: 'p1', pageNumber: 1, lines: [], objects: [circle('c1')] }, // legacy A4 page (no space)
  { id: 'p2', pageNumber: 2, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [circle('c2')] },
] })], onWrite: (t, row) => writes.push([t, row]) });
await p.goto(`${BASE}/studio/color?book=22222222-2222-4222-8222-222222222222`);
await p.waitForSelector('canvas', { timeout: 30000 }); await p.waitForTimeout(1500);

const native = await p.evaluate(() => { const s = window.Konva.stages[0]; return [Math.round(s.width() / s.scaleX()), Math.round(s.height() / s.scaleY())]; });
check(native[0] === 612 && native[1] === 792, 'legacy page opens at Letter size', `${native}`);
const circleAt = await p.evaluate(() => { const r = window.Konva.stages[0].findOne('Ellipse').getClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const cb = await p.locator('canvas').first().boundingBox();
const paint = () => p.evaluate(() => { const img = window.Konva.stages[0].find('Image').find(i => i.image() instanceof HTMLCanvasElement); const c = img.image(); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const colors = new Set(); let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; if (n % 7 === 0) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); } return { n, colors: colors.size }; });

await p.getByRole('radio', { name: 'Αστεράκια' }).click();
await p.mouse.click(cb.x + circleAt[0], cb.y + circleAt[1]); await p.waitForTimeout(500);
let s = await paint();
check(s.n > 10000 && s.colors >= 2, 'star pattern fill', `${s.n}px, ${s.colors} tones`);
await p.screenshot({ path: shot('kids-pattern.png') });

await p.getByRole('button', { name: 'Πινέλο' }).click();
const before = s.n;
await p.mouse.move(cb.x + 60, cb.y + 60); await p.mouse.down(); await p.mouse.move(cb.x + 420, cb.y + 90, { steps: 12 }); await p.mouse.up();
await p.waitForTimeout(400);
s = await paint(); check(s.n > before, 'brush paints', `${before} → ${s.n}`);
const label = await p.locator('text=/Σελίδα \\d από/').textContent();
check(/Σελίδα 1 από 2/.test(label), 'brush drag does not turn the page', label.trim());

await p.getByRole('button', { name: 'Τελείωσα!' }).click(); await p.waitForTimeout(500);
check(await p.getByRole('dialog', { name: 'Κέρδισες αυτοκόλλητο' }).isVisible(), 'reward dialog with sticker');
await p.getByRole('button', { name: 'Η συλλογή μου' }).last().click(); await p.waitForTimeout(400);
check((await p.getByRole('dialog', { name: 'Η συλλογή μου' }).locator('img').count()) === 1, 'gallery shows the finished page');
await p.getByRole('button', { name: 'Κλείσιμο' }).click();

await p.getByRole('button', { name: 'Εκτύπωση σελίδας' }).click(); await p.waitForTimeout(300);
const pageRule = await p.evaluate(() => { const f = [...document.querySelectorAll('iframe')].pop(); return f?.contentDocument?.querySelector('style')?.textContent ?? ''; });
check(/size:8\.500in 11\.000in/.test(pageRule), 'print uses the book trim size', pageRule.match(/size:[^;]+/)?.[0]);

await p.waitForTimeout(1200);
const last = writes.filter(w => w[0] === 'books').at(-1)?.[1] ?? {};
check(Object.keys(last).length > 0 && !('trim_size' in last && last.trim_size === null), "saves don't wipe the trim size", Object.keys(last).join(','));
check(last.pages?.[0]?.completedAt && last.pages?.[0]?.space?.width === 612, 'saved page: completedAt + converted space');
check(p.dialogs.length === 0, 'no alert dialogs', p.dialogs.join(' | '));
noPageErrors(p);
await b.close();
