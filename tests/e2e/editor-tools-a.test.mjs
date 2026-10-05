// Phase A editor tools: line styles, page numbers, repeat on all pages,
// tracing reference, and the new worksheets (word search, crossword, finish the picture).
import { launch, newPage, openEditor, check, draw, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const ink = () =>
  p.evaluate(() => {
    const layer = window.Konva.stages[0].findOne(".ink-layer");
    return {
      lines: layer.find("Line").map((l) => ({ dash: l.dash() ?? null, n: l.points().length })),
      texts: layer.find("Text").map((t) => t.text()),
      groups: layer.getChildren().filter((n) => n.getClassName() === "Group").length,
    };
  });
const pageCount = () => p.getByRole("button", { name: /^Page \d+/ }).count();

// ---- line style
await p.keyboard.press("p");
await p.locator("label", { hasText: "Line" }).locator("select").selectOption("dashed");
await draw(p, cb, [[120, 200], [320, 220]]);
await p.locator("label", { hasText: "Line" }).locator("select").selectOption("solid");
await draw(p, cb, [[120, 300], [320, 320]]);
const lines = (await ink()).lines.filter((l) => l.n >= 4);
check(lines.length === 2 && lines[0].dash?.length === 2 && !lines[1].dash?.length, "dashed pen stroke is dashed, the next solid one is not");

// ---- page numbers
const numbers = p.getByRole("radiogroup", { name: "Page numbers" });
await numbers.scrollIntoViewIfNeeded();
check((await numbers.getByRole("radio", { name: "Off" }).getAttribute("aria-checked")) === "true", "page numbers start off");
await numbers.getByRole("radio", { name: "Centre" }).click();
await p.waitForTimeout(200);
check((await ink()).texts.includes("1"), "turning numbers on prints 1 on page 1");

// ---- repeat on all pages
await p.keyboard.press("r");
await p.getByRole("button", { name: "Star", exact: true }).click();
await p.mouse.click(cb.x + 420, cb.y + 120);
await p.waitForTimeout(300);
const bar = p.getByRole("toolbar", { name: "Selection actions" });
await bar.getByRole("button", { name: "Repeat on all pages" }).click();
await p.waitForTimeout(200);
check(await bar.getByRole("button", { name: "Remove from all pages" }).isVisible(), "the button now offers to remove it everywhere");

// ---- worksheets: word search (2 pages), crossword (2), finish the picture (1)
const before = await pageCount();
async function addWorksheet(name) {
  await p.getByRole("button", { name: "Add page" }).click();
  await p.getByRole("button", { name: /Worksheets…/ }).click();
  const dialog = p.getByRole("dialog");
  await dialog.getByRole("radio", { name }).click();
  await dialog.getByRole("button", { name: /^Add \d+ pages?$/ }).click();
  await p.waitForTimeout(400);
  return dialog;
}
await addWorksheet("Word search");
check((await pageCount()) === before + 2, "word search adds a puzzle page and an answers page");
const ws = await ink();
check(ws.texts.includes("Word search") && ws.texts.includes("HORSE") && ws.texts.filter((s) => /^[A-Z]$/.test(s)).length >= 100, "word search page shows the grid and the word list");
check(ws.texts.includes(String(before + 1)), "the new page got its page number automatically");
await p.screenshot({ path: shot("word-search.png") });

await addWorksheet("Crossword");
const cw = await ink();
check((await pageCount()) === before + 4 && cw.texts.includes("Across") && cw.texts.some((s) => s.includes("It loves cheese")), "crossword page shows numbered clues");
await p.screenshot({ path: shot("crossword.png") });

await p.getByRole("button", { name: "Page 1", exact: true }).click();
await p.waitForTimeout(300);
await addWorksheet("Finish the picture");
const fin = await ink();
check((await pageCount()) === before + 5 && fin.texts.includes("Finish the picture!") && fin.lines.some((l) => l.dash?.length), "finish the picture: title and dashed centre line");
await p.screenshot({ path: shot("finish-picture.png") });

// ---- numbers off again
await p.getByRole("button", { name: "Page 1", exact: true }).click();
await p.waitForTimeout(300);
await numbers.getByRole("radio", { name: "Off" }).click();
await p.waitForTimeout(200);
check(!(await ink()).texts.includes("1"), "turning numbers off removes them");

// ---- tracing reference: shown on the canvas, absent from the page thumbnail/export capture
const png = await p.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 60;
  const x = c.getContext("2d");
  x.fillStyle = "#c00";
  x.fillRect(0, 0, 60, 60);
  return c.toDataURL("image/png").split(",")[1];
});
await p.getByLabel("Tracing reference image").setInputFiles({ name: "ref.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
await p.waitForTimeout(500);
const trace = await p.evaluate(() => {
  const stage = window.Konva.stages[0];
  const img = stage.find("Image").find((n) => n.getLayer().name() === "editor-overlay");
  return img ? { opacity: img.opacity(), visible: img.getLayer().isVisible() } : null;
});
check(trace && trace.opacity > 0.1 && trace.opacity < 0.9 && trace.visible, "reference shows faded behind the page");
await p.screenshot({ path: shot("trace-reference.png") });
await p.getByRole("button", { name: "Remove reference" }).click();
await p.waitForTimeout(200);
check((await p.evaluate(() => window.Konva.stages[0].find("Image").filter((n) => n.getLayer().name() === "editor-overlay").length)) === 0, "removing the reference clears it");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
