// Every drawing tool in the editor does what it says, measured on the canvas pixels.
import { launch, newPage, openEditor, draw as drawAt, check, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const state = () => p.evaluate(() => {
  const stage = window.Konva?.stages?.[0];
  if (!stage) return null;
  const ink = stage.findOne('.ink-layer');
  const kids = ink.getChildren().filter(n => n.getClassName() !== 'Transformer');
  const canvas = ink.toCanvas({ pixelRatio: 1 / stage.scaleX() });
  const d = canvas.getContext('2d').getImageData(0, 0, 595, 842).data;
  let dark = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 100) dark++;
  const tr = ink.findOne('Transformer');
  return { nodes: kids.length, inkPx: dark, selected: tr ? tr.nodes().length : 0, scale: stage.scaleX() };
});
const draw = async (pts) => { await drawAt(p, cb, pts, 8); await p.waitForTimeout(150); };
const paintCount = () => p.evaluate(() => { const img = window.Konva.stages[0].find('Image').find(i => i.image() instanceof HTMLCanvasElement); const d = img.image().getContext('2d').getImageData(0, 0, 595, 842).data; let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) c++; return c; });

const s0 = await state();
check(!!s0, 'Konva stage reachable');

await p.getByRole('button', { name: 'Pen', exact: true }).click();
await draw([[60, 80], [200, 120]]);
let s = await state(); check(s.inkPx > s0.inkPx, 'Pen draws', `ink ${s0.inkPx} -> ${s.inkPx}`);
const afterPen = s;

await p.getByRole('button', { name: 'Eraser', exact: true }).click();
await p.getByRole('button', { name: /Bold/ }).click();
await draw([[60, 80], [200, 120]]);
s = await state(); check(s.inkPx < afterPen.inkPx, 'Eraser erases', `ink ${afterPen.inkPx} -> ${s.inkPx}`);

await p.getByRole('button', { name: 'Undo' }).click(); await p.waitForTimeout(150);
s = await state(); check(s.inkPx === afterPen.inkPx, 'Undo (button)');
await p.getByRole('button', { name: 'Redo' }).click(); await p.waitForTimeout(150);
s = await state(); check(s.inkPx < afterPen.inkPx, 'Redo (button)');

await p.getByRole('button', { name: 'Stamp', exact: true }).click(); await p.waitForTimeout(200);
let before = await state();
await p.locator('aside button').filter({ hasText: /star/i }).first().click();
await p.mouse.click(cb.x + 150, cb.y + 250); await p.waitForTimeout(500);
s = await state(); check(s.nodes === before.nodes + 1 && s.selected === 1, 'Stamp places and selects', `nodes ${before.nodes} -> ${s.nodes}`);

for (const shape of ['Rectangle', 'Circle', 'Triangle', 'Star', 'Heart', 'Hexagon', 'Line', 'Arrow']) {
  await p.getByRole('button', { name: 'Shape', exact: true }).click();
  before = await state();
  await p.getByRole('button', { name: shape, exact: true }).click();
  await p.mouse.click(cb.x + 320, cb.y + 350); await p.waitForTimeout(250);
  s = await state(); check(s.nodes === before.nodes + 1, `Shape: ${shape}`);
}

await p.getByRole('button', { name: 'Text', exact: true }).click();
before = await state();
await p.getByRole('button', { name: 'Add text' }).click();
await p.mouse.click(cb.x + 250, cb.y + 550); await p.waitForTimeout(300);
s = await state(); check(s.nodes === before.nodes + 1, 'Text places');
await p.mouse.dblclick(cb.x + 250, cb.y + 550); await p.waitForTimeout(300);
const ta = p.locator('textarea');
const hasTa = await ta.count();
if (hasTa) { await ta.fill('Hello kids'); await p.keyboard.press('Enter'); await p.waitForTimeout(200); }
const textVal = await p.evaluate(() => window.Konva.stages[0].find('Text').map(t => t.text()).join('|'));
check(hasTa > 0 && textVal.includes('Hello kids'), 'Text edit (double-click)');

await p.keyboard.press('v');
await p.mouse.click(cb.x + 500, cb.y + 700); await p.waitForTimeout(100);
const pos = () => p.evaluate(() => { const n = window.Konva.stages[0].findOne('.ink-layer').getChildren()[0]; return [n.x(), n.y()]; });
const pos0 = await pos();
const first = await p.evaluate(() => { const r = window.Konva.stages[0].findOne('.ink-layer').getChildren()[0].getClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await p.mouse.move(cb.x + first[0], cb.y + first[1]); await p.mouse.down(); await p.mouse.move(cb.x + first[0] + 60, cb.y + first[1] + 40, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(250);
const pos1 = await pos();
check(Math.abs(pos1[0] - pos0[0]) > 20, 'Select + drag moves object');

before = await state();
await p.keyboard.press('Delete'); await p.waitForTimeout(200);
s = await state(); check(s.nodes === before.nodes - 1, 'Delete key');

await p.keyboard.press('p');
check((await p.getByRole('button', { name: 'Pen', exact: true }).getAttribute('aria-pressed')) === 'true', 'Key P selects pen');
await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
s = await state(); check(s.nodes === before.nodes, 'Ctrl+Z undo');

const z0 = (await state()).scale;
await p.getByRole('button', { name: /Zoom in/ }).click(); await p.waitForTimeout(200);
const z1 = (await state()).scale;
check(z1 > z0, 'Zoom in button', `${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
await p.locator('button[title^="Fit page"]').click(); await p.waitForTimeout(200);

await p.getByRole('tab', { name: 'Color' }).click(); await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Fill', exact: true }).click();
const fillBefore = await paintCount();
await p.mouse.click(cb.x + 400, cb.y + 150); await p.waitForTimeout(500);
check((await paintCount()) > fillBefore, 'Fill bucket (Color mode)');

noPageErrors(p);
await b.close();
