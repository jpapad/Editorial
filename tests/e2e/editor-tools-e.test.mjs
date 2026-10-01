// Vectorize a picture, the segment eraser, and text on a curve.
import { launch, newPage, openEditor, check, draw, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const scale = await p.evaluate(() => window.Konva.stages[0].scaleX());
const at = (x, y) => [cb.x + x * scale, cb.y + y * scale];
const pens = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Line").filter((l) => !l.closed() && l.stroke() === "#111827").map((l) => l.points().map(Math.round)));

// ---- segment eraser: a horizontal line crossed by two verticals
await p.keyboard.press("p");
for (const pts of [[[100, 300], [500, 300]], [[220, 200], [220, 400]], [[380, 200], [380, 400]]]) {
  await draw(p, { x: cb.x, y: cb.y }, pts.map(([x, y]) => [x * scale, y * scale]), 12);
  await p.waitForTimeout(120);
}
check((await pens()).length === 3, "three strokes drawn");
await p.keyboard.press("e");
await p.getByRole("button", { name: "Whole pieces" }).click();
await p.mouse.click(...at(300, 300)); // the middle piece of the horizontal line
await p.waitForTimeout(250);
let lines = await pens();
const horizontals = lines.filter((l) => Math.abs(l[1] - l[l.length - 1]) < 12 && Math.abs(l[0] - l[l.length - 2]) > 40);
check(lines.length === 4 && horizontals.length === 2 && horizontals.every((l) => Math.max(l[0], l[l.length - 2]) <= 222 || Math.min(l[0], l[l.length - 2]) >= 378), "one click removed the piece between the two crossings", JSON.stringify(horizontals.map((l) => [l[0], l[l.length - 2]])));
await p.screenshot({ path: shot("segment-eraser.png") });
await p.keyboard.press("ControlOrMeta+z");
await p.waitForTimeout(200);
check((await pens()).length === 3, "undo restores the line");

// ---- vectorize: upload a raster picture, then sharpen it
const png = Buffer.from(
  await p.evaluate(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 240;
    const x = cv.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, 240, 240);
    x.strokeStyle = "#000";
    x.lineWidth = 10;
    x.beginPath();
    x.arc(120, 120, 80, 0, Math.PI * 2);
    x.stroke();
    return cv.toDataURL("image/png").split(",")[1];
  }),
  "base64"
);
await p.keyboard.press("s");
await p.locator('input[type="file"][accept*="svg"]').setInputFiles({ name: "ring.png", mimeType: "image/png", buffer: png });
await p.waitForTimeout(400);
await p.mouse.click(...at(300, 560));
await p.waitForTimeout(400);
const src = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Image").filter((n) => n.name() !== "paint").map((n) => n.image()?.src?.slice(0, 40) ?? "")[0]);
check((await src()).startsWith("data:image/png"), "the uploaded picture is a raster stamp");
const bar = p.getByRole("toolbar", { name: "Selection actions" });
await bar.getByRole("button", { name: "Sharpen lines (vectorize)" }).click();
await p.getByRole("status").filter({ hasText: "Lines sharpened" }).waitFor({ timeout: 15000 });
await p.waitForTimeout(400);
check((await src()).startsWith("data:image/svg+xml"), "after sharpening it is an SVG (vector) picture");
// It still looks like the ring: dark pixels on the canvas where the ring is, none in its centre.
const probe = await p.evaluate(() => {
  const img = window.Konva.stages[0].findOne(".ink-layer").find("Image").filter((n) => n.name() !== "paint")[0].image();
  const c = document.createElement("canvas");
  c.width = c.height = 240;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, 240, 240);
  return { ring: [...x.getImageData(40, 120, 1, 1).data], centre: [...x.getImageData(120, 120, 1, 1).data] };
});
check(probe.ring[3] > 200 && probe.ring[0] < 80 && probe.centre[3] < 40, "the vector picture draws the same ring (dark line, open centre)", JSON.stringify(probe));
await p.screenshot({ path: shot("vectorized.png") });

// ---- text on a curve
await p.keyboard.press("t");
await p.mouse.click(...at(300, 120));
await p.waitForTimeout(300);
const bend = p.getByRole("slider", { name: "Bend" });
await bend.focus();
for (let i = 0; i < 9; i++) await p.keyboard.press("ArrowRight");
await p.waitForTimeout(300);
const text = await p.evaluate(() => {
  const n = window.Konva.stages[0].findOne(".ink-layer").find("TextPath")[0];
  return n ? { cls: n.getClassName(), data: n.data(), text: n.text() } : null;
});
check(text && /A[\d. ]+ 0 0 1 /.test(text.data) && text.text.length > 0, "bending turns the text into text on an arc", JSON.stringify(text));
await p.screenshot({ path: shot("text-on-curve.png") });
for (let i = 0; i < 9; i++) await p.keyboard.press("ArrowLeft");
await p.waitForTimeout(300);
check((await p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("TextPath").length)) === 0, "back to 0° it is straight text again");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
