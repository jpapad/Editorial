// Worksheet generator adds the right number of pages for each kind.
import { launch, newPage, openEditor, check, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const count = () => p.locator('[aria-label^="Page "]').count();
const open = async () => { await p.getByRole('button', { name: 'Add page' }).click(); await p.getByRole('button', { name: /Worksheets…/ }).click(); await p.waitForTimeout(200); };
const n0 = await count();

await open(); await p.getByRole('button', { name: 'Α–Ω' }).click(); await p.getByRole('button', { name: /Add 24 pages/ }).click(); await p.waitForTimeout(700);
check((await count()) === n0 + 24, 'Greek letter tracing: 24 pages');
await open(); await p.getByRole('radio', { name: 'Number tracing' }).click(); await p.getByRole('button', { name: /Add 5 pages/ }).click(); await p.waitForTimeout(700);
check((await count()) === n0 + 29, 'number tracing: 5 pages');
await open(); await p.getByRole('radio', { name: 'Connect the dots' }).click(); await p.getByRole('button', { name: 'Butterfly' }).click(); await p.getByRole('button', { name: /Add 1 page/ }).click(); await p.waitForTimeout(700);
check((await count()) === n0 + 30, 'connect the dots: 1 page');
await open(); await p.getByRole('radio', { name: 'Maze' }).click(); await p.getByRole('button', { name: 'Medium' }).click(); await p.getByRole('button', { name: /Add 3 pages/ }).click(); await p.waitForTimeout(700);
check((await count()) === n0 + 33, 'mazes: 3 pages');

// spot the difference needs a page with some objects
for (const [sh, x, y] of [['Star', 150, 200], ['Heart', 350, 220], ['Triangle', 150, 450], ['Hexagon', 380, 470], ['Circle', 260, 620], ['Arrow', 250, 330]]) {
  await p.keyboard.press('r'); await p.getByRole('button', { name: sh, exact: true }).click();
  await p.mouse.click(cb.x + x, cb.y + y); await p.waitForTimeout(150);
}
await open(); await p.getByRole('radio', { name: 'Spot the difference' }).click(); await p.getByRole('button', { name: /Add 2 pages/ }).click(); await p.waitForTimeout(700);
check((await count()) === n0 + 35, 'spot the difference: puzzle + answers');
noPageErrors(p);
await b.close();
