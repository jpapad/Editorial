// Ctrl+wheel zooms at the pointer, Space+drag pans, drawing still lands under the pointer.
import { launch, newPage, openEditor, check, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const scroller = p.locator('div.overflow-auto').first();
const scale = () => p.evaluate(() => window.Konva.stages[0].scaleX());
const z0 = await scale();

await p.mouse.move(cb.x + 100, cb.y + 100);
await p.keyboard.down('Control');
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(80); }
await p.keyboard.up('Control');
await p.waitForTimeout(300);
check((await scale()) > z0 * 1.3, 'Ctrl+wheel zooms in', `${z0.toFixed(2)} -> ${(await scale()).toFixed(2)}`);
const s1 = await scroller.evaluate(el => [el.scrollLeft, el.scrollTop]);

await p.keyboard.down('Space');
await p.mouse.move(700, 500); await p.mouse.down(); await p.mouse.move(600, 380, { steps: 5 }); await p.mouse.up();
await p.keyboard.up('Space');
const s2 = await scroller.evaluate(el => [el.scrollLeft, el.scrollTop]);
check(s2[0] > s1[0] && s2[1] > s1[1], 'Space+drag pans', `${s1} -> ${s2}`);

await p.keyboard.press('p');
await p.mouse.move(700, 450); await p.mouse.down(); await p.mouse.move(760, 470, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(200);
const hit = await p.evaluate(() => {
  const st = window.Konva.stages[0];
  const line = st.findOne('.ink-layer').find('Line').at(-1);
  const box = st.container().getBoundingClientRect();
  const r = line.getClientRect();
  return [box.left + r.x, box.top + r.y, r.width];
});
check(Math.abs(hit[0] - 700) < 12 && Math.abs(hit[1] - 450) < 12, 'zoomed stroke starts under the pointer', hit.map(Math.round).join(','));

noPageErrors(p);
await b.close();
