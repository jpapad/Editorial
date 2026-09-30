// Light/dark switch: follows the OS the first time, remembers the choice,
// restyles through tokens, and never darkens the children's coloring screen.
import { BASE, launch, newPage, openEditor, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const theme = (p) => p.evaluate(() => document.documentElement.getAttribute("data-theme"));
const bg = (p, sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);

// First visit follows the OS setting.
const osDark = await newPage(await b.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } }));
await openEditor(osDark);
check((await theme(osDark)) === "dark", "first visit follows an OS dark setting");

const p = await newPage(b);
await openEditor(p);
check((await theme(p)) === "light", "light by default on a light OS");
const lightBg = await bg(p, ".pw-workspace");
await p.getByRole("button", { name: "Dark theme" }).click();
await p.waitForTimeout(200);
check((await theme(p)) === "dark", "switch turns the editor dark");
check((await p.getByRole("button", { name: "Dark theme" }).getAttribute("aria-pressed")) === "true", "active option is marked pressed");
const darkBg = await bg(p, ".pw-workspace");
check(lightBg !== darkBg && darkBg === "rgb(15, 16, 19)", "workspace colour follows the theme", `${lightBg} → ${darkBg}`);
await p.screenshot({ path: shot("editor-dark.png") });
await p.reload();
await p.waitForSelector("canvas");
check((await theme(p)) === "dark", "choice survives a reload (no flash back to light)");

// The children's screen stays light even when the app is dark.
const k = await newPage(b, { lang: null, viewport: { width: 1200, height: 900 } });
await k.addInitScript(() => localStorage.setItem("pagewright-theme", "dark"));
await mockSupabase(k, { books: [bookRow({ pages: [{ id: "p1", pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [] }] })] });
await k.goto(`${BASE}/studio/color?book=22222222-2222-4222-8222-222222222222`);
await k.waitForSelector("canvas", { timeout: 30000 });
await k.waitForTimeout(800);
const kidsRoot = await k.evaluate(() => {
  const el = document.querySelector('[data-theme="light"]');
  return el ? getComputedStyle(el).backgroundColor : null;
});
check((await theme(k)) === "dark" && kidsRoot === "rgb(238, 240, 244)", "coloring screen pinned to light inside a dark app", String(kidsRoot));

await p.getByRole("button", { name: "Light theme" }).click();
await p.waitForTimeout(200);
check((await theme(p)) === "light", "and back to light");
noPageErrors(osDark, p, k);
await b.close();
