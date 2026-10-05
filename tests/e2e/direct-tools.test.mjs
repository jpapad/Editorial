// Text and Shape tools place on the first click; Color mode starts on Fill.
import { launch, newPage, openEditor, check, inkNodes, paintedPixels, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);

await p.getByRole('button', { name: 'Text', exact: true }).click();
let n = await inkNodes(p); await p.mouse.click(cb.x + 200, cb.y + 200); await p.waitForTimeout(250);
check((await inkNodes(p)) === n + 1, 'Text tool places on first click');

await p.getByRole('button', { name: 'Shape', exact: true }).click();
n = await inkNodes(p); await p.mouse.click(cb.x + 250, cb.y + 400); await p.waitForTimeout(250);
check((await inkNodes(p)) === n + 1, 'Shape tool places on first click');

await p.getByRole('button', { name: 'Shape', exact: true }).click();
await p.getByRole('button', { name: 'Heart', exact: true }).click();
await p.mouse.click(cb.x + 250, cb.y + 600); await p.waitForTimeout(200);
await p.getByRole('button', { name: 'Shape', exact: true }).click();
n = await inkNodes(p); await p.mouse.click(cb.x + 100, cb.y + 650); await p.waitForTimeout(250);
const groups = await p.evaluate(() => window.Konva.stages[0].findOne('.ink-layer').getChildren().filter(n => n.getClassName() === 'Group').length);
check((await inkNodes(p)) === n + 1 && groups >= 2, 'Shape tool remembers the last shape (heart)');

await p.getByRole('tab', { name: 'Color' }).click(); await p.waitForTimeout(400);
const fillPressed = await p.getByRole('button', { name: 'Fill', exact: true }).getAttribute('aria-pressed');
await p.mouse.click(cb.x + 450, cb.y + 100); await p.waitForTimeout(400);
check(fillPressed === 'true' && (await paintedPixels(p)) > 0, 'Color mode starts on Fill and fills on first click');

noPageErrors(p);
await b.close();
