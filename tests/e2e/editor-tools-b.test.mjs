// Phase B editor tools: colored preview, color by number, connect-the-dots from your own drawing.
import { launch, newPage, openEditor, check, draw, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const texts = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Text").map((t) => t.text()));
const pageCount = () => p.locator('button[aria-label^="Page "]').count();
async function worksheet(name, setup) {
  await p.getByRole("button", { name: "Add page" }).click();
  await p.getByRole("button", { name: /Worksheets…/ }).click();
  const dialog = p.getByRole("dialog");
  await dialog.getByRole("radio", { name }).click();
  if (setup) await setup(dialog);
  await dialog.getByRole("button", { name: /^Add \d+ pages?$/ }).click();
  await p.waitForTimeout(500);
  return dialog;
}

// Nothing on the page yet: both tools say so instead of making an empty page.
const d0 = await worksheet("Color by number");
check(await d0.getByText(/no closed areas/).isVisible(), "color by number on an empty page explains what's missing");
await d0.getByRole("button", { name: "Cancel" }).click();

// Three closed shapes to color (white inside, like line art).
await p.getByRole("button", { name: "#ffffff" }).click();
for (const [shape, x, y] of [["Star", 180, 220], ["Circle", 380, 240], ["Heart", 260, 460]]) {
  await p.keyboard.press("r");
  await p.getByRole("button", { name: shape, exact: true }).click();
  await p.mouse.click(cb.x + x, cb.y + y);
  await p.waitForTimeout(250);
}
await p.keyboard.press("v");
await p.mouse.click(cb.x + 30, cb.y + 30);

// ---- colored preview
await p.getByRole("button", { name: "Preview colored in" }).click();
const preview = p.getByRole("dialog");
check(await preview.getByText("3 areas to color").isVisible(), "preview finds the 3 closed areas");
const sample = () =>
  p.evaluate(() => {
    const c = document.querySelector('canvas[aria-label="The page colored in"]');
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 40) colored++;
      sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000003;
    }
    return { colored, sum };
  });
const first = await sample();
check(first.colored > 2000, "the areas are filled with color", `${first.colored} px`);
await p.screenshot({ path: shot("color-preview.png") });
let changed = false;
for (let i = 0; i < 4 && !changed; i++) {
  await preview.getByRole("button", { name: "Other colors" }).click();
  await p.waitForTimeout(150);
  changed = (await sample()).sum !== first.sum;
}
check(changed, "Other colors re-colors the preview");
const [download] = await Promise.all([p.waitForEvent("download"), preview.getByRole("button", { name: "Download PNG" }).click()]);
check(download.suggestedFilename().endsWith("-colored.png"), "the preview downloads as a PNG");
await preview.getByRole("button", { name: "Close" }).click();
check((await texts()).length === 0, "the page itself is unchanged by the preview");

// ---- color by number
const before = await pageCount();
await worksheet("Color by number");
const cbn = await texts();
check((await pageCount()) === before + 1, "color by number adds one page");
check(cbn.filter((s) => /^\d$/.test(s)).length === 3 && cbn.includes("1 Red") && cbn.includes("3 Yellow"), "each area has a number and the key names the colors", cbn.join("|"));
await p.screenshot({ path: shot("color-by-number.png") });

// ---- dots from my drawing
await p.getByRole("button", { name: "Page 1", exact: true }).click();
await p.waitForTimeout(300);
const mine = (dialog) => dialog.getByRole("button", { name: "My drawing" }).click();
const d1 = await worksheet("Connect the dots", mine);
check(await d1.getByText(/no pen outline/).isVisible(), "dots from my drawing needs a pen outline");
await d1.getByRole("button", { name: "Cancel" }).click();
await p.keyboard.press("p");
await draw(p, cb, [[150, 600], [400, 600], [400, 700], [150, 700], [150, 606]], 20);
await worksheet("Connect the dots", mine);
const dots = await texts();
const nums = dots.filter((s) => /^\d+$/.test(s)).map(Number);
check(dots.includes("Connect the dots!") && nums.length >= 15 && nums[0] === 1 && Math.max(...nums) === nums.length, "my outline became numbered dots", `${nums.length} dots`);
await p.screenshot({ path: shot("dots-from-drawing.png") });

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
