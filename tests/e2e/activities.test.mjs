// The newer worksheets: sudoku, find the shadow, draw in the grid, word tracing, counting.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const pageCount = () => p.locator('button[aria-label^="Page "]').count();
const ink = () =>
  p.evaluate(() => {
    const layer = window.Konva.stages[0].findOne(".ink-layer");
    return { texts: layer.find("Text").map((t) => t.text()), images: layer.find("Image").filter((n) => n.name() !== "paint" && n.width() > 20).length, lines: layer.find("Line").length };
  });
async function worksheet(name, setup) {
  await p.getByRole("button", { name: "Add page" }).click();
  await p.getByRole("button", { name: /Worksheets…/ }).click();
  const dialog = p.getByRole("dialog");
  await dialog.getByRole("radio", { name, exact: true }).click();
  if (setup) await setup(dialog);
  await dialog.getByRole("button", { name: /^Add \d+ pages?$/ }).click();
  await p.waitForTimeout(600);
  return dialog;
}

// ---- grid copy needs something on the page
const empty = await worksheet("Draw in the grid");
check(await empty.getByText(/current page is empty/).isVisible(), "draw in the grid on an empty page explains what's missing");
await empty.getByRole("button", { name: "Cancel" }).click();

// Three white shapes: used by "find the shadow"? No — that needs pictures; shapes make the grid-copy source.
await p.getByRole("button", { name: "#ffffff" }).click();
for (const [shape, x, y] of [["Star", 200, 250], ["Heart", 380, 420]]) {
  await p.keyboard.press("r");
  await p.getByRole("button", { name: shape, exact: true }).click();
  await p.mouse.click(cb.x + x, cb.y + y);
  await p.waitForTimeout(250);
}
let n = await pageCount();
await worksheet("Draw in the grid");
let page = await ink();
check((await pageCount()) === n + 1 && page.images === 1 && page.texts.includes("Draw it square by square!") && page.lines > 20, "draw in the grid: the page as a picture under a grid, plus an empty grid");
await p.screenshot({ path: shot("grid-copy.png") });

// ---- sudoku (2 puzzles + 2 answer pages by default)
n = await pageCount();
await worksheet("Sudoku");
page = await ink();
check((await pageCount()) === n + 4 && page.texts.includes("Sudoku") && page.texts.filter((s) => /^[1-4]$/.test(s)).length >= 5, "sudoku adds puzzles with their answer pages");
await p.screenshot({ path: shot("sudoku.png") });

// ---- find the shadow (no pictures on the current page → built-in shapes)
n = await pageCount();
await worksheet("Find the shadow");
page = await ink();
check((await pageCount()) === n + 1 && page.texts.includes("Find the shadow!"), "find the shadow adds a matching page");
await p.screenshot({ path: shot("shadows.png") });

// ---- word tracing
n = await pageCount();
await worksheet("Word tracing", async (dialog) => dialog.locator("textarea").fill("sun\nmoon\nstar\ncloud\nrain"));
page = await ink();
check((await pageCount()) === n + 2 && page.texts.filter((s) => s === "sun").length >= 1 && page.texts.includes("moon"), "5 words make 2 tracing pages");
await p.screenshot({ path: shot("word-tracing.png") });

// ---- counting → sums
n = await pageCount();
await worksheet("Counting", async (dialog) => dialog.getByRole("button", { name: "Add", exact: true }).click());
page = await ink();
check((await pageCount()) === n + 2 && page.texts.includes("Add them up!") && page.texts.filter((s) => s === "+").length === 6, "counting in Add mode makes sum rows");
await p.screenshot({ path: shot("counting.png") });

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
