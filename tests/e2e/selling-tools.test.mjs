// Listing mockups, version history and the repeated-pages check.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const pageCount = () => p.locator('button[aria-label^="Page "]').count();
const shapesOnPage = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Line").filter((l) => l.closed()).length);

await p.getByRole("button", { name: "#ffffff" }).click();
for (const [shape, x, y] of [["Star", 200, 250], ["Heart", 380, 420], ["Circle", 250, 560]]) {
  await p.keyboard.press("r");
  await p.getByRole("button", { name: shape, exact: true }).click();
  await p.mouse.click(cb.x + x, cb.y + y);
  await p.waitForTimeout(250);
}
await p.keyboard.press("v");
await p.mouse.click(cb.x + 30, cb.y + 30);

// ---- repeated pages
await p.getByRole("button", { name: "Page 1", exact: true }).hover();
await p.getByRole("button", { name: "Duplicate page 1" }).click();
await p.waitForTimeout(400);
check(await p.getByText("1 page repeats an earlier one").isVisible(), "a duplicated page is flagged as a repeat");
// Change the copy: no longer a repeat.
await p.keyboard.press("r");
await p.getByRole("button", { name: "Triangle", exact: true }).click();
await p.mouse.click(cb.x + 430, cb.y + 200);
await p.waitForTimeout(400);
check((await p.getByText("1 page repeats an earlier one").count()) === 0, "once the copy differs, the warning goes");

// ---- version history
const versionsButton = p.getByRole("button", { name: "Version history" });
await versionsButton.scrollIntoViewIfNeeded();
await versionsButton.click();
let dialog = p.getByRole("dialog");
await dialog.getByRole("button", { name: "Save a version now" }).click();
await p.waitForTimeout(400);
check((await dialog.getByRole("list", { name: "Versions" }).getByRole("listitem").count()) >= 1 && (await dialog.getByText(/saved by you/).first().isVisible()), "a version can be saved by hand");
await dialog.getByRole("button", { name: "Close" }).click();
// Wreck the book: delete page 2, then restore.
await p.getByRole("button", { name: "Page 2", exact: true }).hover();
await p.getByRole("button", { name: "Delete page 2" }).click();
await p.waitForTimeout(300);
check((await pageCount()) === 1, "page 2 deleted");
await versionsButton.scrollIntoViewIfNeeded();
await versionsButton.click();
dialog = p.getByRole("dialog");
await dialog.getByRole("listitem").filter({ hasText: "saved by you" }).first().getByRole("button", { name: "Restore" }).click();
await p.waitForTimeout(500);
check((await pageCount()) === 2 && (await shapesOnPage()) === 2, "restoring brings the saved pages back");
await p.keyboard.press("ControlOrMeta+z");
await p.waitForTimeout(300);
check((await pageCount()) === 1, "…and the restore itself can be undone");
await p.keyboard.press("ControlOrMeta+Shift+z");
await p.waitForTimeout(300);

// ---- mockups
const mock = p.getByRole("button", { name: "Listing mockups" });
await mock.scrollIntoViewIfNeeded();
await mock.click();
dialog = p.getByRole("dialog");
await dialog.getByRole("button", { name: "Download PNG" }).and(p.locator(":not([disabled])")).waitFor({ timeout: 20000 });
const stats = () =>
  p.evaluate(() => {
    const c = document.querySelector('canvas[aria-label="Mockup preview"]');
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let dark = 0, colorful = 0, sum = 0;
    for (let i = 0; i < d.length; i += 16) {
      if (d[i] + d[i + 1] + d[i + 2] < 150) dark++;
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 90) colorful++;
      sum = (sum + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000003;
    }
    return { w: c.width, dark, colorful, sum };
  });
const bookScene = await stats();
check(bookScene.w === 1600 && bookScene.dark > 300, "the standing-book scene shows the page's line art at 1600px", JSON.stringify(bookScene));
await p.screenshot({ path: shot("mockup-book.png") });
await dialog.getByRole("radio", { name: "On the table, with crayons" }).click();
await p.waitForTimeout(400);
const flat = await stats();
check(flat.sum !== bookScene.sum && flat.colorful > bookScene.colorful + 500, "the flat-lay scene adds a colored page and crayons", JSON.stringify(flat));
await p.screenshot({ path: shot("mockup-flatlay.png") });
await dialog.getByRole("radio", { name: "Three pages" }).click();
await p.waitForTimeout(300);
await dialog.getByRole("button", { name: "#2b2d42" }).click();
await p.waitForTimeout(300);
check((await stats()).sum !== flat.sum, "scene and background can be changed");
await p.screenshot({ path: shot("mockup-fan.png") });
const [download] = await Promise.all([p.waitForEvent("download"), dialog.getByRole("button", { name: "Download PNG" }).click()]);
check(/-mockup-fan\.png$/.test(download.suggestedFilename()), "the mockup downloads as a PNG");
await dialog.getByRole("button", { name: "Close" }).click();
check((await pageCount()) === 2 && (await p.getByRole("button", { name: "Page 1", exact: true }).getAttribute("aria-current")) !== null, "after rendering, the editor is back on a page with the book intact");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
