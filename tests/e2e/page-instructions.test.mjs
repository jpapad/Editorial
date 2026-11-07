// Page from instructions: the instructions are read into a checklist (texts verbatim),
// the user corrects it, and the page is laid out exactly — AI endpoints mocked.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(p, { books: [bookRow({ pages: [{ id: "p1", pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [] }] })] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };

const instructions = "Τίτλος πάνω: «Τα ζώα της φάρμας». Από κάτω 4 εικόνες σε 2 σειρές: αγελάδα, πρόβατο, κότα, γουρούνι, με μια γραμμή κάτω από καθεμία. Στο τέλος: «Κύκλωσε αυτό που μας δίνει γάλα».";
const spec = {
  frame: null,
  blocks: [
    { type: "title", text: "Τα ζώα της φάρμας", size: "large", align: "center" },
    { type: "pictures", items: [{ subject: "a cow", label: "αγελάδα", caption: "" }, { subject: "a sheep", label: "πρόβατο", caption: "" }, { subject: "a hen", label: "κότα", caption: "" }, { subject: "a pig", label: "γουρούνι", caption: "" }], columns: 2, boxed: false, writeLine: true, marker: "none" },
    { type: "text", text: "Κύκλωσε αυτό που μας δίνει γάλα.", size: "medium", align: "center", style: "normal" },
  ],
  warnings: [],
};
const asked = [];
await p.route(`${BASE}/api/page-from-instructions`, (route) => {
  asked.push(route.request().postDataJSON());
  return route.fulfill({ json: { spec } });
});
const drawn = [];
await p.route(`${BASE}/api/generate-line-art`, (route) => {
  drawn.push(route.request().postDataJSON());
  return route.fulfill({ json: { results: [{ ok: true, svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="100" fill="none" stroke="#000" stroke-width="12"/></svg>` }], refunded: 0 } });
});

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
await p.getByRole("button", { name: "AI", exact: true }).click().catch(async () => p.locator('[aria-label*="AI"]').first().click());
await p.getByRole("button", { name: "Write instructions" }).click();
const dialog = p.getByRole("dialog", { name: "Page from instructions" });
await dialog.getByRole("textbox", { name: "Describe the page" }).fill(instructions);
await dialog.getByRole("button", { name: "Read my instructions" }).click();
await dialog.getByText("What I understood — top of the page first").waitFor();
check(asked[0]?.instructions === instructions, "the instructions are sent exactly as typed");
const understood = await dialog.getByTestId("understood").allTextContents();
check(understood.length === 3 && understood[0] === "Title: «Τα ζώα της φάρμας»" && understood[1].startsWith("4 pictures in 2 columns: «αγελάδα», «πρόβατο», «κότα», «γουρούνι»") && /a line to write under each/.test(understood[1]), "the checklist shows what was understood, texts verbatim", JSON.stringify(understood));
check(await dialog.getByText("4 pictures = 4 AI credits.").isVisible(), "the cost is shown before anything is made");
await dialog.getByRole("textbox", { name: "Text of item 3" }).fill("Κύκλωσε τα ζώα που δίνουν γάλα.");
await p.screenshot({ path: shot("instructions-review.png") });
await dialog.getByRole("button", { name: "Make the page" }).click();
await dialog.waitFor({ state: "detached", timeout: 30000 });
await p.waitForTimeout(1500);

check(drawn.length === 4 && drawn.map((d) => d.subject).join() === "a cow,a sheep,a hen,a pig" && drawn.every((d) => d.aspectRatio === "square"), "exactly the 4 pictures asked for are drawn (square, for a grid)");
const book = db.books[0];
const made = book.pages.at(-1);
const textsOn = made.objects.filter((o) => o.kind === "text").map((o) => o.text);
check(book.pages.length === 2 && made.objects.filter((o) => o.kind === "stamp").length === 4, "a new page with the 4 pictures is added after the current one");
check(textsOn.includes("Τα ζώα της φάρμας") && textsOn.includes("Κύκλωσε τα ζώα που δίνουν γάλα.") && textsOn.length === 2, "only the texts asked for — the corrected one as corrected — nothing added", JSON.stringify(textsOn));
check(made.objects.filter((o) => o.kind === "shape" && o.shapeKind === "line").length === 4, "a write line under each picture");
await p.screenshot({ path: shot("instructions-page.png") });
noPageErrors(p);
await b.close();
