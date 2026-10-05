// "Close the gaps for me" bridges the gap, after which the bucket fills only the square.
import { launch, newPage, openEditor, draw, check, shot, paintedPixels, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
await p.keyboard.press('p');
await draw(p, cb, [[100, 150], [300, 150]], 12); await draw(p, cb, [[100, 150], [100, 350]], 12); await draw(p, cb, [[100, 350], [300, 350]], 12);
await draw(p, cb, [[300, 150], [300, 236]], 12); await draw(p, cb, [[300, 249], [300, 350]], 12);
await p.keyboard.press('v');
await p.getByRole('button', { name: 'Check lines for gaps' }).click(); await p.waitForTimeout(500);
const before = await p.locator('text=/possible gap|No gaps/').last().textContent();
check(/1 possible gap/.test(before), 'gap found before', before);
await p.getByRole('button', { name: 'Close the gaps for me' }).click(); await p.waitForTimeout(1200);
const after = await p.locator('text=/possible gap|No gaps/').last().textContent();
check(/No gaps/.test(after), 'no gaps after closing', after);
await p.screenshot({ path: shot('close-gaps.png'), clip: { x: cb.x + 60, y: cb.y + 110, width: 300, height: 290 } });

await p.getByRole('tab', { name: 'Color' }).click(); await p.waitForTimeout(500);
await p.mouse.click(cb.x + 200, cb.y + 250); await p.waitForTimeout(600);
const [n, total] = [await paintedPixels(p), await p.evaluate(() => { const c = window.Konva.stages[0].find('Image').find(i => i.image() instanceof HTMLCanvasElement).image(); return c.width * c.height; })];
check(n > 0 && n / total < 0.2, 'bucket fills only the closed square', `${(100 * n / total).toFixed(1)}% of the page`);
noPageErrors(p);
await b.close();
