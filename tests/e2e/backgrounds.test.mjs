// Backgrounds from instructions: a scene (faded on a mixed page) and a pattern, put on every
// page, the bleed warning with its one-click fix, and the editor's "background on every page".
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 }, acceptDialogs: true });
const blank = (i) => ({ id: `p${i}`, pageNumber: i + 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [] });
const db = await mockSupabase(p, { books: [bookRow({ pages: [blank(0), blank(1)] })] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };
const spec = {
  mode: "mixed", frame: null, background: null, gradient: null, pattern: "clouds", warnings: [],
  scene: { subject: "a forest with tall trees and flowers", label: "ένα δάσος με δέντρα" },
  blocks: [{ type: "title", text: "Στο δάσος", size: "large", align: "center", color: "#3cb371", fill: null }],
};
await p.route(`${BASE}/api/page-from-instructions`, (route) => route.fulfill({ json: { spec } }));
const drawn = [];
await p.route(`${BASE}/api/generate-line-art`, (route) => {
  drawn.push(route.request().postDataJSON());
  return route.fulfill({ json: { results: [{ ok: true, svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="600" fill="#fff"/><path d="M50 550 L120 300 L190 550 Z M220 550 L300 250 L380 550 Z" fill="none" stroke="#000" stroke-width="10"/></svg>` }], refunded: 0 } });
});

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
await p.locator('[aria-label*="AI"]').first().click();
await p.getByRole("button", { name: "Write instructions" }).click();
const dialog = p.getByRole("dialog", { name: "Page from instructions" });
await dialog.getByRole("radio", { name: "Mixed" }).click();
await dialog.getByRole("textbox", { name: "Describe the page" }).fill("Πράσινος τίτλος «Στο δάσος», φόντο ένα δάσος με δέντρα, και συννεφάκια.");
await dialog.getByRole("button", { name: "Read my instructions" }).click();
await dialog.getByText("What I understood — top of the page first").waitFor();
check(await dialog.getByText("Faded background scene: «ένα δάσος με δέντρα»").isVisible() && await dialog.getByText("Background pattern: Clouds").isVisible(), "the scene (faded, on a mixed page) and the pattern are in the checklist");
check(await dialog.getByText("1 pictures = 1 AI credits.").isVisible() || await dialog.getByText(/1 pictures = 1 AI/).isVisible(), "the background picture counts as one AI credit");
check(await dialog.getByRole("alert").filter({ hasText: "turn on bleed" }).isVisible(), "a background to the edge without bleed is warned about, before making");
await dialog.getByRole("checkbox", { name: "Use this background on every page of the book" }).check();
await p.screenshot({ path: shot("background-review.png") });
await dialog.getByRole("button", { name: "Make the page" }).click();
await dialog.waitFor({ state: "detached", timeout: 30000 });
await p.waitForTimeout(1500);

check(drawn.length === 1 && drawn[0].aspectRatio === "portrait" && drawn[0].style === "lineart" && /full-page background scenery/.test(drawn[0].theme), "the background is drawn as a full-page scene, as outlines (it's a mixed page)");
const pages = db.books[0].pages;
const made = pages.at(-1);
check(made.background?.imageOpacity === 0.35 && made.backgroundPatternId === "clouds", "the new page has the faded scene and the clouds");
check(pages.every((pg) => pg.background?.image && pg.backgroundPatternId === "clouds"), "and so does every page of the book", JSON.stringify(pages.map((pg) => Boolean(pg.background?.image))));

await p.screenshot({ path: shot("background-page.png") });

// The readiness card offers to turn bleed on.
await p.getByRole("button", { name: "Close AI panel" }).click();
await p.waitForTimeout(500);
const readiness = p.getByText(/have a background to the edge but bleed is off/);
check(await readiness.isVisible(), "the print-readiness card lists the pages without bleed");
await p.locator("li", { has: readiness }).getByRole("button").first().click();
await p.waitForTimeout(2500);
check(db.books[0].bleed === true || db.books[0].pages.every((pg) => pg.space?.bleed > 0), "its one-click fix turns bleed on");

// The editor's own tool: take it off one page, put it back on all.
await p.getByRole("button", { name: "Remove the background from this page" }).click();
await p.waitForTimeout(800);
check(!db.books[0].pages.at(-1).background, "a page's background can be removed");
await p.getByRole("button", { name: "Page 1", exact: true }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Use this background on every page" }).click();
await p.waitForTimeout(1200);
check(db.books[0].pages.every((pg) => pg.background?.image), "'Use this background on every page' puts it back everywhere");
noPageErrors(p);
await b.close();
