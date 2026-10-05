// Mirror drawing, undo/redo, shapes, marquee select, align, group, zoom, shortcuts.
import { launch, newPage, openEditor, draw, check, inkNodes, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const strokes = () => p.evaluate(() => window.Konva.stages[0].findOne('.ink-layer').find('Line').filter(l => !l.closed()).length);

await p.keyboard.press('p');
await draw(p, cb, [[60, 120], [120, 90], [180, 140], [200, 220]], 6);
check((await strokes()) === 1, 'pen stroke');
await p.keyboard.press('m');
await draw(p, cb, [[40, 300], [110, 260], [150, 330]], 6);
await p.waitForTimeout(300);
check((await strokes()) === 3, 'mirror adds the reflected stroke', `${await strokes()} strokes`);
await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
check((await strokes()) === 1, 'Ctrl+Z undoes the mirrored pair');
await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200);
check((await strokes()) === 3, 'Ctrl+Shift+Z redoes');
await p.keyboard.press('m');

const n0 = await inkNodes(p);
for (const [label, x, y] of [['Triangle', 120, 420], ['Star', 260, 420], ['Arrow', 200, 560]]) {
  await p.keyboard.press('r'); await p.waitForTimeout(200);
  await p.getByRole('button', { name: label, exact: true }).click();
  await p.mouse.click(cb.x + x, cb.y + y);
  await p.waitForTimeout(200);
}
check((await inkNodes(p)) === n0 + 3, 'three shapes placed');

await p.keyboard.press('v');
await draw(p, cb, [[30, 350], [380, 620]], 8);
await p.waitForTimeout(300);
const selected = await p.evaluate(() => window.Konva.stages[0].findOne('Transformer')?.nodes().length ?? 0);
check(selected === 3, 'marquee selects the three shapes', `${selected} selected`);
await p.getByRole('button', { name: 'Align top' }).click(); await p.waitForTimeout(200);
const tops = await p.evaluate(() => window.Konva.stages[0].findOne('Transformer').nodes().map(n => Math.round(n.getClientRect().y)));
// Client rects include stroke/arrowhead overhang, so allow a couple of px.
check(Math.max(...tops) - Math.min(...tops) <= 3, 'align top lines them up', tops.join(','));
await p.keyboard.press('Control+g'); await p.waitForTimeout(300);
// Grouped objects select together: click just one of them.
await p.keyboard.press('Escape'); await p.waitForTimeout(100);
const star = await p.evaluate(() => { const shapes = window.Konva.stages[0].findOne('.ink-layer').getChildren().filter(n => n.getClassName() === 'Group'); const r = shapes[1].getClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await p.mouse.click(cb.x + star[0], cb.y + star[1]); await p.waitForTimeout(200);
const inGroup = await p.evaluate(() => window.Konva.stages[0].findOne('Transformer')?.nodes().length ?? 0);
check(inGroup === 3, 'Ctrl+G groups: clicking one selects all three', `${inGroup} selected`);
await p.screenshot({ path: shot('shapes-grouped.png') });

await p.keyboard.press('Escape');
const scale = () => p.evaluate(() => window.Konva.stages[0].scaleX());
const z0 = await scale();
await p.keyboard.press('Control+=');
await p.keyboard.press('Control+='); await p.waitForTimeout(400);
check((await scale()) > z0, 'Ctrl+= zooms in');
await p.keyboard.press('Control+0'); await p.waitForTimeout(300);
check(Math.abs((await scale()) - z0) < 1e-6, 'Ctrl+0 fits the page again');

await p.keyboard.press('?'); await p.waitForTimeout(300);
check(await p.getByRole('dialog').filter({ hasText: /shortcut/i }).isVisible(), 'shortcuts dialog opens with ?');
await p.keyboard.press('Escape');

check(p.dialogs.length === 0, 'no alert dialogs', p.dialogs.join(' | '));
noPageErrors(p);
await b.close();
