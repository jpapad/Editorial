// Gap check message, frames, page templates, duplicate, blank backs, drag to reorder.
import { launch, newPage, openEditor, draw, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const labels = () => p.locator('button[aria-label^="Page "]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));

await p.keyboard.press('p');
// open square: the right side stops short, leaving a gap; plus a closed triangle
await draw(p, cb, [[100, 150], [300, 150]]);
await draw(p, cb, [[100, 150], [100, 350]]);
await draw(p, cb, [[100, 350], [300, 350]]);
await draw(p, cb, [[300, 150], [300, 236]]);
await draw(p, cb, [[300, 249], [300, 350]]);
await draw(p, cb, [[150, 450], [300, 600], [100, 600], [150, 450]]);
await p.keyboard.press('v');
const t0 = Date.now();
await p.getByRole('button', { name: 'Check lines for gaps' }).click();
await p.waitForTimeout(300);
const msg = await p.locator('text=/possible gap|No gaps/').last().textContent();
check(/1 possible gap/.test(msg), 'gap check finds the one gap', msg);
check(Date.now() - t0 < 3000, 'gap check is quick', `${Date.now() - t0}ms incl. click`);

const before = await p.evaluate(() => window.Konva.stages[0].findOne('.ink-layer').getChildren().length);
await p.getByRole('button', { name: 'Stars frame' }).click(); await p.waitForTimeout(400);
check((await p.evaluate(() => window.Konva.stages[0].findOne('.ink-layer').getChildren().length)) > before, 'Stars frame adds a border');

const n0 = (await labels()).length;
await p.getByRole('button', { name: 'Page 1', exact: true }).hover();
await p.getByRole('button', { name: 'Duplicate page 1' }).click(); await p.waitForTimeout(300);
check((await labels()).length === n0 + 1, 'duplicate page');
await p.getByRole('button', { name: 'Add page' }).click();
await p.getByRole('button', { name: /This Book Belongs To/ }).click(); await p.waitForTimeout(1200);
const belongs = await p.evaluate(() => window.Konva.stages[0].find('Text').map(t => t.text()).join(' '));
check(/belongs to/i.test(belongs), '"This book belongs to" template');
await p.getByRole('button', { name: 'Add page' }).click();
await p.getByRole('button', { name: /Color Test Page/ }).click(); await p.waitForTimeout(600);
const n1 = (await labels()).length;
await p.getByRole('button', { name: /Blank backs/ }).click(); await p.waitForTimeout(500);
const withBacks = await labels();
check(withBacks.length === n1 * 2, 'blank backs double the pages', `${n1} -> ${withBacks.length}`);
await p.screenshot({ path: shot('pages.png') });

const src = p.getByRole('button', { name: 'Page 1', exact: true });
const dst = p.getByRole('button', { name: /^Page 4/ });
await src.dragTo(dst, { targetPosition: { x: 40, y: 20 } }); await p.waitForTimeout(400);
const afterDrag = await labels();
check(JSON.stringify(afterDrag) !== JSON.stringify(withBacks) && afterDrag.length === withBacks.length, 'drag reorders pages');

noPageErrors(p);
await b.close();
