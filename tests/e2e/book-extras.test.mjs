// Print at home, personalise, the certificate/sticker templates, and the look-alike check.
import fs from "node:fs";
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b, { acceptDownloads: true });
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

// ---- print at home: sheet-sized PDFs, built in the browser (where each page lands on the sheet: unit/book-extras)
const pdfs = [];
p.on("download", async (d) => {
  const buf = fs.readFileSync(await d.path());
  const pages = [...buf.toString("latin1").matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  pdfs.push({ name: d.suggestedFilename(), pages: pages.map(([, , w, h]) => ({ w: Math.round(w), h: Math.round(h) })) });
});
const settle = async (n) => { for (let i = 0; i < 100 && pdfs.length < n; i++) await p.waitForTimeout(100); };
await side("Print at home").scrollIntoViewIfNeeded();
await side("Print at home").click();
dialog = p.getByRole("dialog");
await dialog.getByRole("button", { name: "US Letter" }).click();
check(await dialog.getByRole("button", { name: "Download 2 PDFs" }).isVisible(), "two paper sizes → two PDFs");
await dialog.getByRole("button", { name: "Download 2 PDFs" }).click();
await dialog.waitFor({ state: "detached", timeout: 60000 });
await settle(2);
const a4 = pdfs.find((f) => /-a4\.pdf$/.test(f.name));
const letter = pdfs.find((f) => /-letter\.pdf$/.test(f.name));
check(pdfs.length === 2 && a4?.pages.length === 2 && a4.pages.every((pg) => pg.w === 595 && pg.h === 842) && letter?.pages.length === 2 && letter.pages.every((pg) => pg.w === 612 && pg.h === 792), "test print: the 2 drawn pages (the empty one is skipped) on A4 and on Letter", JSON.stringify(pdfs.map((f) => [f.name, f.pages.length])));
check(/test-print-a4\.pdf$/.test(a4?.name ?? "") && /test-print-letter\.pdf$/.test(letter?.name ?? ""), "files are named by purpose and paper size");
pdfs.length = 0;
await side("Print at home").click();
dialog = p.getByRole("dialog");
await dialog.getByRole("radio", { name: /Whole book/ }).click();
check(await dialog.getByText("Start with a “how to print” page").isVisible(), "the whole-book pack offers an instructions page");
await dialog.getByRole("button", { name: "Download PDF" }).click();
await dialog.waitFor({ state: "detached", timeout: 90000 });
await settle(1);
check(pdfs.length === 1 && pdfs[0].pages.length === 4, "whole book: the instructions page, then all 3 pages", JSON.stringify(pdfs.map((f) => [f.name, f.pages.length])));

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
