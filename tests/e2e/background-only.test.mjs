// "θέλω να μου φτιάξεις μια σελίδα με φόντο ένα αγρόκτημα" — a page that is only a color background scene.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1470, height: 780 }, lang: null });
const db = await mockSupabase(p, { books: [bookRow({ bleed: true, pages: [{ id: "p0", pageNumber: 1, space: { width: 630, height: 810, bleed: 9 }, lines: [], objects: [] }] })] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };
await p.route(`${BASE}/api/page-from-instructions`, (route) => route.fulfill({ json: { spec: { mode: "color", frame: null, background: null, gradient: null, pattern: null, scene: { subject: "a farm with a red barn, green fields and a blue sky", label: "ένα αγρόκτημα" }, blocks: [], warnings: [] } } }));
const drawn = [];
await p.route(`${BASE}/api/generate-line-art`, (route) => {
  drawn.push(route.request().postDataJSON());
  return route.fulfill({ json: { results: [{ ok: true, svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="300" fill="#bfe3ff"/><rect y="300" width="400" height="300" fill="#7cc576"/><rect x="140" y="220" width="120" height="110" fill="#c0392b"/></svg>` }], refunded: 0 } });
});

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
await p.locator('[aria-label*="AI"]').first().click();
await p.getByRole("button", { name: "Γράψε οδηγίες" }).click();
const dialog = p.getByRole("dialog", { name: "Σελίδα από οδηγίες" });
await dialog.getByRole("radio", { name: "Έγχρωμη" }).click();
await dialog.getByRole("textbox", { name: "Περίγραψε τη σελίδα" }).fill("θέλω να μου φτιάξεις μια σελίδα με φόντο ένα αγρόκτημα");
await dialog.getByRole("button", { name: "Διάβασε τις οδηγίες μου" }).click();
await dialog.getByText("Έγχρωμο σκηνικό φόντου: «ένα αγρόκτημα»").waitFor({ timeout: 15000 });
check(true, "a page that is only a background is understood (no 'nothing could be understood')");
check(await dialog.getByRole("button", { name: "Φτιάξε τη σελίδα" }).isEnabled(), "and it can be made");
await dialog.getByRole("button", { name: "Φτιάξε τη σελίδα" }).click();
await dialog.waitFor({ state: "detached", timeout: 30000 });
await p.waitForTimeout(1500);
const made = db.books[0].pages.at(-1);
check(drawn.length === 1 && drawn[0].style === "color" && made.background?.image && made.inColor === true, "a color farm scene fills the new page", JSON.stringify({ n: drawn.length, bg: Boolean(made.background?.image) }));
await p.screenshot({ path: shot("background-only.png") });
noPageErrors(p);
await b.close();
