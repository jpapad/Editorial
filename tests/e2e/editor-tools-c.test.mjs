// Phase C editor tools: select & move drawn strokes, the curve pen, smart guides, my stamps.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const scale = await p.evaluate(() => window.Konva.stages[0].scaleX());
const at = (x, y) => [cb.x + x * scale, cb.y + y * scale]; // page points → screen
const penLines = () =>
  p.evaluate(() =>
    window.Konva.stages[0]
      .findOne(".ink-layer")
      .find("Line")
      .filter((l) => l.stroke() === "#111827" && !l.closed())
      .map((l) => ({ n: l.points().length / 2, x0: Math.round(l.points()[0]), y0: Math.round(l.points()[1]) }))
  );
const tool = (name) => p.getByRole("navigation", { name: "Tools" }).getByRole("button", { name, exact: true }).click();

// ---- curve: three clicks + Enter = one smooth stroke through them
await tool("Curve");
for (const [x, y] of [[100, 150], [200, 80], [300, 150]]) {
  await p.mouse.click(...at(x, y));
  await p.waitForTimeout(80);
}
await p.screenshot({ path: shot("curve-draft.png") });
await p.keyboard.press("Enter");
await p.waitForTimeout(200);
let lines = await penLines();
check(lines.length === 1 && lines[0].n > 20 && lines[0].x0 === 100 && lines[0].y0 === 150, "curve: 3 clicks + Enter make one smooth stroke", JSON.stringify(lines));
// Escape abandons a curve in progress.
await p.mouse.click(...at(100, 300));
await p.mouse.click(...at(180, 320));
await p.keyboard.press("Escape");
await p.waitForTimeout(150);
check((await penLines()).length === 1, "Escape cancels a curve in progress");
// Clicking the first anchor closes the shape.
for (const [x, y] of [[350, 300], [450, 300], [400, 380], [350, 300]]) {
  await p.mouse.click(...at(x, y));
  await p.waitForTimeout(80);
}
await p.waitForTimeout(150);
lines = await penLines();
check(lines.length === 2 && lines[1].n > 30, "clicking the first point closes the curve");

// ---- select strokes: tap, drag, delete, undo
await tool("Select strokes");
const bar = p.getByRole("toolbar", { name: "Selected strokes" });
check(await bar.getByText(/Tap a line/).isVisible(), "the stroke toolbar explains what to do");
await p.mouse.click(...at(100, 150)); // on the first curve's start
await p.waitForTimeout(200);
check(await bar.getByText("1 stroke selected — drag to move").isVisible(), "a tap on a line selects that stroke");
await p.screenshot({ path: shot("stroke-selected.png") });
// Drag the selection 60pt right, 40pt down.
const [sx, sy] = at(200, 110);
await p.mouse.move(sx, sy);
await p.mouse.down();
await p.mouse.move(sx + 60 * scale, sy + 40 * scale, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(200);
lines = await penLines();
check(Math.abs(lines[0].x0 - 160) <= 1 && Math.abs(lines[0].y0 - 190) <= 1 && lines[1].x0 === 350, "dragging moves the picked stroke only", JSON.stringify(lines));
// Box-select both, then delete.
const [mx, my] = at(40, 40);
await p.mouse.move(mx, my);
await p.mouse.down();
await p.mouse.move(...at(520, 420), { steps: 6 });
await p.mouse.up();
await p.waitForTimeout(200);
check(await bar.getByText("2 strokes selected — drag to move").isVisible(), "a box selects every stroke it touches");
await bar.getByRole("button", { name: "Delete" }).click();
await p.waitForTimeout(200);
check((await penLines()).length === 0, "Delete removes the picked strokes");
await p.keyboard.press("ControlOrMeta+z");
await p.waitForTimeout(200);
check((await penLines()).length === 2, "…and undo brings them back");

// ---- smart guides: a shape dragged near the page centre snaps to it
await p.getByRole("button", { name: "#ffffff" }).click();
await p.keyboard.press("r");
await p.getByRole("button", { name: "Star", exact: true }).click();
await p.mouse.click(...at(150, 560));
await p.waitForTimeout(300);
const star = () => p.evaluate(() => {
  const g = window.Konva.stages[0].findOne(".ink-layer").getChildren().filter((n) => n.getClassName() === "Group").at(-1) ?? window.Konva.stages[0].findOne(".ink-layer").find("Line").filter((l) => l.closed()).at(-1);
  const r = g.getClientRect({ relativeTo: window.Konva.stages[0], skipShadow: true, skipStroke: true });
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
});
const start = await star();
const [gx, gy] = at(start.cx, start.cy);
const pageCx = 612 / 2;
await p.mouse.move(gx, gy);
await p.mouse.down();
await p.mouse.move(gx + (pageCx - 4 - start.cx) * scale, gy + 20, { steps: 10 }); // stop 4pt short of the centre
await p.waitForTimeout(100);
const guides = await p.evaluate(() => window.Konva.stages[0].find("Line").filter((l) => l.stroke() === "#e0489b").length);
await p.screenshot({ path: shot("smart-guides.png") });
await p.mouse.up();
await p.waitForTimeout(250);
const snapped = await star();
check(guides >= 1, "a guide line shows while the object is near the page centre");
check(Math.abs(snapped.cx - pageCx) < 0.6, "the object snapped exactly onto the centre", `cx ${snapped.cx.toFixed(2)}`);
check((await p.evaluate(() => window.Konva.stages[0].find("Line").filter((l) => l.stroke() === "#e0489b").length)) === 0, "guides disappear after the drop");

// ---- my stamps: save the star, place it again, delete it from the library
const sel = p.getByRole("toolbar", { name: "Selection actions" });
await sel.getByRole("button", { name: "Save to my stamps" }).click();
await p.waitForTimeout(400);
check(await p.getByRole("status").filter({ hasText: "Saved to my stamps" }).isVisible(), "saving confirms where to find it");
await p.keyboard.press("s");
const mine = p.getByRole("list", { name: "My stamps" });
check((await mine.getByRole("listitem").count()) === 1, "the piece is listed under My stamps");
const objects = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Line").filter((l) => l.closed()).length);
const before = await objects();
await mine.getByRole("button", { name: /^Place / }).click();
await p.waitForTimeout(300);
check((await objects()) === before + 1 && (await sel.isVisible()), "placing adds a copy to the page, selected");
await p.screenshot({ path: shot("my-stamps.png") });
await p.reload();
await p.waitForSelector("canvas");
await p.waitForTimeout(1500);
await p.keyboard.press("s");
check((await p.getByRole("list", { name: "My stamps" }).getByRole("listitem").count()) === 1, "my stamps survive a reload (kept on this device)");
await p.getByRole("list", { name: "My stamps" }).getByRole("listitem").hover();
await p.getByRole("button", { name: /^Delete Stamp/ }).click();
await p.waitForTimeout(300);
check((await p.getByRole("list", { name: "My stamps" }).count()) === 0, "a saved stamp can be deleted");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
