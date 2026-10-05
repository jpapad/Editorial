// Flip, lock and hide an object; the publish preview contains no guides or hidden objects.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const scale = await p.evaluate(() => window.Konva.stages[0].scaleX());
const groups = () => p.evaluate(() => window.Konva.stages[0].findOne('.ink-layer').getChildren().filter(n => n.getClassName() === 'Group').map(g => ({ scaleX: g.scaleX() })));

await p.keyboard.press('r'); await p.getByRole('button', { name: 'Arrow', exact: true }).click();
await p.mouse.click(cb.x + 250, cb.y + 480); await p.waitForTimeout(200);
await p.getByRole('button', { name: 'Flip horizontally' }).click(); await p.waitForTimeout(200);
check((await groups())[0]?.scaleX === -1, 'flip horizontally mirrors the object');

await p.getByRole('button', { name: 'Lock Arrow' }).click();
await p.keyboard.press('Escape');
await p.mouse.click(cb.x + 250, cb.y + 480); await p.waitForTimeout(200);
check((await p.locator('text=Click an object to select it').count()) > 0, 'a locked object cannot be selected by clicking');
await p.getByRole('button', { name: 'Hide Arrow' }).click(); await p.waitForTimeout(200);
check((await groups()).length === 0, 'hide removes it from the canvas');

await p.getByRole('button', { name: 'Publish' }).click();
await p.waitForTimeout(2500);
await p.screenshot({ path: shot('publish-preview.png') });
const imgs = await p.locator('img[src^="data:image/png"]').evaluateAll(els => els.map(e => e.src));
check(imgs.length > 0, 'publish preview renders the page', `${imgs.length} images`);
if (imgs[0]) {
  const res = await p.evaluate(async ({ src, scale }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const s = img.width / 612;
    const px = (x, y) => Array.from(ctx.getImageData(Math.round(x * s), Math.round(y * s), 1, 1).data);
    return { guide: px(36, 700), center: px(306, 780), hidden: px(250 / scale, 480 / scale) };
  }, { src: imgs[0], scale });
  // The export is transparent where nothing is drawn.
  const white = (c) => c[3] === 0 || (c[0] > 245 && c[1] > 245 && c[2] > 245);
  check(white(res.guide) && white(res.center), 'no safe-area or center guides in the export image', JSON.stringify(res));
  check(white(res.hidden), 'hidden object left out of the export image');
}
noPageErrors(p);
await b.close();
