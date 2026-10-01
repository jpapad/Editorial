// Whole-book tools: pictures as pages, frame/background on all pages, even line thickness, master elements.
import { launch, newPage, openEditor, check, draw, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const pageCount = () => p.locator('button[aria-label^="Page "]').count();
const goTo = async (n) => { await p.getByRole("button", { name: `Page ${n}`, exact: true }).click(); await p.waitForTimeout(350); };
const ink = () =>
  p.evaluate(() => {
    const layer = window.Konva.stages[0].findOne(".ink-layer");
    return {
      images: layer.find("Image").filter((n) => n.name() !== "paint" && n.width() > 50).length,
      penWidths: layer.find("Line").filter((l) => !l.closed() && l.stroke() === "#111827").map((l) => l.strokeWidth()),
      stars: layer.find("Line").filter((l) => l.closed()).map((l) => Math.round(l.getAbsolutePosition(window.Konva.stages[0]).x)),
    };
  });

// ---- pictures as pages
const png = async (color) =>
  Buffer.from(
    await p.evaluate((c) => {
      const cv = document.createElement("canvas");
      cv.width = 300;
      cv.height = 400;
      const x = cv.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, 300, 400);
      x.strokeStyle = c;
      x.lineWidth = 12;
      x.strokeRect(40, 60, 220, 280);
      return cv.toDataURL("image/png").split(",")[1];
    }, color),
    "base64"
  );
await p.getByRole("button", { name: "Add page" }).click();
await p.getByRole("button", { name: /Pictures as pages…/ }).click();
const dialog = p.getByRole("dialog");
await dialog.getByLabel("Pictures to import").setInputFiles([
  { name: "page-10.png", mimeType: "image/png", buffer: await png("#000") },
  { name: "page-2.png", mimeType: "image/png", buffer: await png("#222") },
  { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
]);
check(await dialog.getByText("2 pictures chosen").isVisible(), "only the pictures are taken (a .txt is ignored)");
await dialog.getByRole("button", { name: "Add 2 pages" }).click();
await p.waitForTimeout(800);
check((await pageCount()) === 3, "2 pictures became 2 new pages");
check((await ink()).images === 1, "the new page holds its picture");
await p.screenshot({ path: shot("pictures-as-pages.png") });

// ---- frame on all pages
const frameButtons = p.locator('button[style*="background-image"][class*="aspect-[3/4]"]');
await frameButtons.first().click();
await p.waitForTimeout(300);
const withFrame = (await ink()).images;
await p.getByRole("button", { name: "Use this frame on all pages" }).click();
await p.waitForTimeout(300);
await goTo(1);
check((await ink()).images === 1 && withFrame === 2, "the frame chosen on one page now sits on the others too");

// ---- even line thickness (page 1: two strokes of different widths)
await p.keyboard.press("p");
await draw(p, cb, [[120, 200], [320, 220]]);
await p.keyboard.press("]");
await p.keyboard.press("]");
await draw(p, cb, [[120, 300], [320, 320]]);
const before = (await ink()).penWidths;
await p.getByRole("button", { name: "This page", exact: true }).click();
await p.waitForTimeout(250);
const after = (await ink()).penWidths;
check(new Set(before).size === 2 && new Set(after).size === 1, "uneven strokes become one thickness", `${before} → ${after}`);

// ---- master element: repeat a star, move it on page 1, see it moved on page 2
await p.getByRole("button", { name: "#ffffff" }).click();
await p.keyboard.press("r");
await p.getByRole("button", { name: "Star", exact: true }).click();
await p.mouse.click(cb.x + 420, cb.y + 520);
await p.waitForTimeout(300);
await p.getByRole("toolbar", { name: "Selection actions" }).getByRole("button", { name: "Repeat on all pages" }).click();
await p.waitForTimeout(250);
const x1 = (await ink()).stars[0];
await p.keyboard.press("Shift+ArrowLeft");
await p.keyboard.press("Shift+ArrowLeft");
await p.waitForTimeout(700);
const moved = (await ink()).stars[0];
await goTo(2);
const other = (await ink()).stars[0];
check(moved < x1 && other === moved, "moving the repeated star on page 1 moved its copy on page 2", `${x1} → ${moved}, page 2: ${other}`);
// A page added afterwards gets it too.
await p.getByRole("button", { name: "Add page" }).click();
await p.getByRole("button", { name: /Full Drawing Page/ }).click();
await p.waitForTimeout(400);
check((await ink()).stars.length === 1, "a page added later carries the repeated element");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
