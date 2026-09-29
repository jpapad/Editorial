// "Check age fit": a hard maze is too detailed for ages 3–5.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
await openEditor(p);
const verdict = () => p.locator('text=/fit for this age|Too detailed|Mostly fine/').textContent();

await p.getByRole('button', { name: 'Add page' }).click(); await p.getByRole('button', { name: /Color Test Page/ }).click(); await p.waitForTimeout(800);
await p.getByRole('button', { name: 'Check age fit' }).click(); await p.waitForTimeout(500);
const areas = await p.locator('text=/areas to color/').textContent();
check(/\d+ areas to color/.test(areas), 'age check reports areas', `${await verdict()} | ${areas}`);

await p.getByRole('button', { name: 'Add page' }).click(); await p.getByRole('button', { name: /Worksheets…/ }).click();
await p.getByRole('radio', { name: 'Maze' }).click(); await p.getByRole('button', { name: 'Hard' }).click(); await p.getByRole('button', { name: /Add 3 pages/ }).click(); await p.waitForTimeout(800);
await p.getByRole('combobox', { name: 'Age group' }).selectOption('3-5'); await p.waitForTimeout(500);
const v = await verdict();
const mazeAreas = await p.locator('text=/areas to color/').textContent();
check(/Too detailed/.test(v) && mazeAreas !== areas, 'hard maze (re-checked) is too detailed for ages 3–5', `${v} | ${mazeAreas}`);
await p.screenshot({ path: shot('age-check.png') });
noPageErrors(p);
await b.close();
