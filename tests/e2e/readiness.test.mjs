// The editor's print-readiness card: score, what's wrong, one-click fixes.
import { launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";

const b = await launch();
const p = await newPage(b);
await openEditor(p);
const list = p.getByRole("list", { name: "Print checks" });
const score = async () => Number((await list.locator("xpath=../div//span[contains(@class,'font-extrabold')]").first().textContent()).trim());
const pages = () => p.locator('button[aria-label^="Page "]').count();

const s0 = await score();
check(s0 === 75, "new one-page book: 75 (under 24 pages, not ×4, 1 empty page)", String(s0));
check(await list.getByText("1 empty page").isVisible(), "lists the empty page");
await p.screenshot({ path: shot("readiness.png") });

await list.getByRole("button", { name: "Fix" }).click();
await p.waitForTimeout(300);
check((await pages()) === 4, "Fix pads the book to a multiple of 4", `${await pages()} pages`);
check(await list.getByText("Page count is a multiple of 4").isVisible(), "page-count item turns green");
const s1 = await score();
check(s1 === 70, "score follows (4 empty pages now)", String(s1));

await p.getByRole("button", { name: "Page 3", exact: true }).click();
await p.waitForTimeout(200);
await list.getByRole("button", { name: "Go to page" }).click();
await p.waitForTimeout(200);
check((await p.getByRole("button", { name: "Page 1", exact: true }).getAttribute("aria-current")) === "true", "Go to page jumps to the first empty page");

// Draw on every page → no empty pages.
const cb = await p.locator("canvas").first().boundingBox();
for (let i = 1; i <= 4; i++) {
  await p.getByRole("button", { name: `Page ${i}`, exact: true }).click();
  await p.waitForTimeout(250);
  await p.keyboard.press("p");
  // A different stroke on each page — identical pages would count as repeats.
  await p.mouse.move(cb.x + 150, cb.y + 200 + i * 50); await p.mouse.down(); await p.mouse.move(cb.x + 300, cb.y + 260 + i * 50, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(150);
}
const s2 = await score();
check(s2 === 90, "all pages drawn: only the KDP 24-page minimum is left", String(s2));
noPageErrors(p);
await b.close();
