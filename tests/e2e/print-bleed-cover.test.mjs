// Letter canvas, bleed toggle shifts art with the trim, copyright template,
// KDP interior PDF with bleed and the wrap-around cover.
import fs from "node:fs";
import { launch, newPage, openEditor, check, shot, nativeSize, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b, { acceptDownloads: true });
const pdfs = [];
// Page sizes of each downloaded PDF, as [x, y, w, h] MediaBoxes.
p.on('download', async (d) => {
  const buf = fs.readFileSync(await d.path());
  pdfs.push([...buf.toString('latin1').matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number)));
});
const cb = await openEditor(p);
let n = await nativeSize(p);
check(n[0] === 612 && n[1] === 792, 'interior canvas = Letter 612×792', `${n}`);

await p.keyboard.press('p');
await p.mouse.move(cb.x + 100, cb.y + 100); await p.mouse.down(); await p.mouse.move(cb.x + 160, cb.y + 100, { steps: 5 }); await p.mouse.up();
const lineX = () => p.evaluate(() => window.Konva.stages[0].findOne('.ink-layer').find('Line').filter(l => !l.closed())[0].points()[0]);
const x0 = await lineX();
await p.keyboard.press('v');
await p.getByText('Print to the edge (bleed)').click(); await p.waitForTimeout(800);
n = await nativeSize(p);
check(n[0] === 630 && n[1] === 810, 'bleed on: canvas 630×810', `${n}`);
const x1 = await lineX();
check(Math.abs(x1 - x0 - 9) < 0.01, 'stroke shifted +9pt with the trim', `${x0.toFixed(1)} → ${x1.toFixed(1)}`);
await p.screenshot({ path: shot('bleed.png') });

await p.getByRole('button', { name: 'Add page' }).click();
await p.getByRole('button', { name: /Copyright/ }).click(); await p.waitForTimeout(500);
const copyText = await p.evaluate(() => window.Konva.stages[0].find('Text').map(t => t.text()).find(t => t.includes('ISBN')) ?? '');
check(copyText.includes('ISBN: [ISBN]'), 'copyright page template');

await p.getByRole('button', { name: 'Export', exact: true }).first().click(); await p.waitForTimeout(800);
const modal = p.locator('div.fixed.inset-0.z-50');
await modal.getByRole('button', { name: /Add \d blank page/ }).click(); await p.waitForTimeout(400);
await modal.getByRole('button', { name: 'Export', exact: true }).click();
await p.waitForTimeout(8000);
const interior = pdfs[0] ?? [];
// KDP bleed: trim + 0.125in outside edge = 621×810pt per page
check(interior.length >= 2 && interior.every(([, , w, h]) => w === 621 && h === 810), 'interior PDF: every page 621×810pt (trim + outside bleed)', `${interior.length} pages, first ${JSON.stringify(interior[0])}`);

await p.getByRole('tab', { name: 'Cover' }).click(); await p.waitForTimeout(800);
n = await nativeSize(p);
const expectedW = Math.round(2 * 612 + 24 * 0.002252 * 72 + 18);
check(n[0] === expectedW && n[1] === 810, 'cover canvas = back + spine + front + bleed', `${n} (expected ${expectedW}×810)`);
check(await p.getByRole('button', { name: 'Add spine title' }).isDisabled(), 'spine title disabled under 80 pages');
await p.screenshot({ path: shot('cover.png') });
await p.getByRole('button', { name: 'Export cover PDF' }).click(); await p.waitForTimeout(5000);
const coverBox = pdfs[1]?.[0];
check(coverBox && Math.abs(coverBox[2] - n[0]) <= 1 && coverBox[3] === 810, 'cover PDF matches the cover canvas', JSON.stringify(coverBox));

await p.getByRole('tab', { name: 'Draw' }).click(); await p.waitForTimeout(500);
n = await nativeSize(p);
check(n[0] === 630, 'back in Draw: interior canvas again');
noPageErrors(p);
await b.close();
