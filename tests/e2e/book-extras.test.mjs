// Print at home, personalise, the certificate/sticker templates, and the look-alike check.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
const cb = await openEditor(p);
const pageCount = () => p.locator('button[aria-label^="Page "]').count();
const texts = () => p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Text").map((t) => t.text()));
const addTemplate = async (name) => {
  await p.getByRole("button", { name: "Add page" }).click();
  await p.getByRole("button", { name }).click();
  await p.waitForTimeout(400);
};
const side = (name) => p.getByRole("button", { name, exact: true });

// ---- templates
await addTemplate(/Certificate/);
check((await texts()).includes("Certificate") && (await texts()).includes("colored every page of this book!"), "certificate page added");
await p.screenshot({ path: shot("certificate.png") });
await addTemplate(/Reward Stickers/);
check((await texts()).includes("My stickers") && (await pageCount()) === 3, "sticker page added");
await p.screenshot({ path: shot("stickers.png") });
check((await p.getByText(/lines below 3pt/).count()) === 0, "the new templates don't trip the faint-line check");

// ---- personalise: no placeholder yet → add one, then fill it
await p.getByRole("button", { name: "Page 2", exact: true }).click();
await p.waitForTimeout(300);
await side("Personalize for a child").scrollIntoViewIfNeeded();
await side("Personalize for a child").click();
let dialog = p.getByRole("dialog");
check(await dialog.getByText("No text in this book has {name} yet.").isVisible(), "with no placeholder the dialog says so");
await dialog.getByRole("button", { name: "Add a name line to this page" }).click();
await p.waitForTimeout(300);
check((await texts()).includes("{name}"), "a {name} line is added to the page");
await p.keyboard.press("Escape");
await side("Personalize for a child").scrollIntoViewIfNeeded();
await side("Personalize for a child").click();
dialog = p.getByRole("dialog");
await dialog.getByLabel("Child's name").fill("Μαρία");
await dialog.getByRole("button", { name: "Put the name in" }).click();
await p.waitForTimeout(300);
check((await texts()).includes("Μαρία") && !(await texts()).includes("{name}"), "the child's name replaces the placeholder");
await side("Personalize for a child").click();
dialog = p.getByRole("dialog");
await dialog.getByLabel("Child's name").fill("Νίκος");
await dialog.getByRole("button", { name: "Put the name in" }).click();
await p.waitForTimeout(300);
check((await texts()).includes("Νίκος") && !(await texts()).includes("Μαρία"), "and it can be changed for the next child");
await p.screenshot({ path: shot("personalized.png") });

// ---- print at home: the PDF request carries sheet-sized pages
const requests = [];
await p.route("**/api/export-editor-pdf", async (route) => {
  const body = route.request().postDataJSON();
  requests.push({ title: body.title, pages: body.pages.map((pg) => ({ w: Math.round(pg.pageWidth), h: Math.round(pg.pageHeight), x: pg.x, iw: pg.imageWidth })) });
  await route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4\n%%EOF") });
});
await side("Print at home").scrollIntoViewIfNeeded();
await side("Print at home").click();
dialog = p.getByRole("dialog");
await dialog.getByRole("button", { name: "US Letter" }).click();
check(await dialog.getByRole("button", { name: "Download 2 PDFs" }).isVisible(), "two paper sizes → two PDFs");
await dialog.getByRole("button", { name: "Download 2 PDFs" }).click();
await dialog.waitFor({ state: "detached", timeout: 60000 });
check(requests.length === 2 && requests[0].pages.length === 2 && requests[0].pages.every((pg) => pg.w === 595 && pg.h === 842 && pg.x >= 17.9) && requests[1].pages.every((pg) => pg.w === 612 && pg.h === 792), "test print: the 2 drawn pages (the empty one is skipped) on A4 and on Letter, inside the printer margin", JSON.stringify(requests.map((r) => [r.title, r.pages.length])));
check(/test-print-a4$/.test(requests[0].title) && /test-print-letter$/.test(requests[1].title), "files are named by purpose and paper size");
requests.length = 0;
await side("Print at home").click();
dialog = p.getByRole("dialog");
await dialog.getByRole("radio", { name: /Whole book/ }).click();
check(await dialog.getByText("Start with a “how to print” page").isVisible(), "the whole-book pack offers an instructions page");
await dialog.getByRole("button", { name: "Download PDF" }).click();
await dialog.waitFor({ state: "detached", timeout: 90000 });
check(requests.length === 1 && requests[0].pages.length === 4 && requests[0].pages[0].x === 0 && requests[0].pages[0].iw > 590, "whole book: instructions page first (full sheet), then all 3 pages", JSON.stringify(requests[0]?.pages.length));

// ---- look-alike: duplicate a page, nudge one thing → not identical, but flagged as near-copy once previews exist
await p.getByRole("button", { name: "Page 1", exact: true }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "#ffffff" }).click();
for (const [shape, x, y] of [["Star", 200, 250], ["Heart", 380, 420], ["Circle", 250, 560]]) {
  await p.keyboard.press("r");
  await p.getByRole("button", { name: shape, exact: true }).click();
  await p.mouse.click(cb.x + x, cb.y + y);
  await p.waitForTimeout(250);
}
await p.getByRole("button", { name: "Page 1", exact: true }).hover();
await p.getByRole("button", { name: "Duplicate page 1" }).click();
await p.waitForTimeout(400);
await p.keyboard.press("v");
await p.mouse.click(cb.x + 250, cb.y + 560);
await p.keyboard.press("ArrowRight");
await p.keyboard.press("ArrowRight");
await p.keyboard.press("ArrowRight");
await p.waitForTimeout(700);
check((await p.getByText(/repeats? an? earlier|repeat earlier/).count()) === 0, "a slightly changed copy is not an exact repeat");
// Leaving each page gives it a preview; the look check runs on those.
await p.getByRole("button", { name: "Page 1", exact: true }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Page 3", exact: true }).click();
await p.waitForTimeout(1200);
check(await p.getByText("1 page looks almost like an earlier one").isVisible(), "…but it is flagged as a look-alike");

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
