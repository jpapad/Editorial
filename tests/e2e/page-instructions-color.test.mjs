// Page from instructions in color: the kind of page is sent, colors show as samples before
// anything is made, pictures are drawn in color, and the print-cost check notices.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(p, { books: [bookRow({ pages: Array.from({ length: 24 }, (_, i) => ({ id: `p${i}`, pageNumber: i + 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], objects: [] })) })] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };
const spec = {
  mode: "color", frame: null, background: "#fff8e1", warnings: [],
  blocks: [
    { type: "title", text: "Τα χρώματα", size: "large", align: "center", color: "#e5484d", fill: null },
    { type: "pictures", items: [{ subject: "a red apple", label: "μήλο", caption: "μήλο" }, { subject: "a yellow sun", label: "ήλιος", caption: "ήλιος" }], columns: 2, boxed: true, writeLine: false, marker: "none", color: "#2f80ed", fill: "#e8f1fd" },
  ],
};
const asked = [];
await p.route(`${BASE}/api/page-from-instructions`, (route) => { asked.push(route.request().postDataJSON()); return route.fulfill({ json: { spec } }); });
const drawn = [];
await p.route(`${BASE}/api/generate-line-art`, (route) => {
  drawn.push(route.request().postDataJSON());
  return route.fulfill({ json: { results: [{ ok: true, svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="100" fill="#e5484d"/></svg>` }], refunded: 0 } });
});

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
await p.getByRole("button", { name: "AI", exact: true }).click({ timeout: 3000 }).catch(async () => p.locator('[aria-label*="AI"]').first().click());
await p.getByRole("button", { name: "Write instructions" }).click();
const dialog = p.getByRole("dialog", { name: "Page from instructions" });
await dialog.getByRole("radio", { name: "In color" }).click();
check(await dialog.getByText(/A finished color page/).isVisible(), "choosing 'In color' explains what that means");
await dialog.getByRole("textbox", { name: "Describe the page" }).fill("Κόκκινος τίτλος «Τα χρώματα», από κάτω ένα μήλο και ένας ήλιος σε μπλε κουτιά, απαλό κίτρινο φόντο.");
await dialog.getByRole("button", { name: "Read my instructions" }).click();
await dialog.getByText("What I understood — top of the page first").waitFor();
check(asked[0]?.mode === "color", "the kind of page is sent with the instructions");
check(await dialog.getByText("Page background").isVisible() && (await dialog.getByRole("img", { name: "Color #e5484d" }).count()) === 1 && (await dialog.getByRole("img", { name: "Fill #e8f1fd" }).count()) === 1, "colors are shown as samples before anything is made");
check(await dialog.getByText(/Color pages print with color ink/).isVisible(), "the print-cost note is shown for a color page");
await p.screenshot({ path: shot("instructions-color-review.png") });
await dialog.getByRole("button", { name: "Make the page" }).click();
await dialog.waitFor({ state: "detached", timeout: 30000 });
await p.waitForTimeout(1500);

check(drawn.length === 2 && drawn.every((d) => d.style === "color"), "the pictures are drawn in color");
const made = db.books[0].pages.at(-1);
const stamp = made.objects.find((o) => o.kind === "stamp");
check(made.inColor === true && made.objects[0].fill === "#fff8e1" && made.objects.find((o) => o.text === "Τα χρώματα")?.fill === "#e5484d", "the page is a color page, with its background and red title");
check(stamp?.src.includes("%23e5484d") || stamp?.src.includes("#e5484d"), "a color picture is kept as it is — not traced to black outlines");
await p.screenshot({ path: shot("instructions-color-page.png") });

// Price & royalty notices the color page.
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Close AI panel" }).click();
await p.getByRole("button", { name: "Price & royalty", exact: true }).scrollIntoViewIfNeeded();
await p.getByRole("button", { name: "Price & royalty", exact: true }).click();
const profit = p.getByRole("dialog", { name: "Price & royalty" });
check((await profit.getByRole("radio", { name: "Premium color" }).getAttribute("aria-checked")) === "true", "with a color page, the cost starts from color ink");
await profit.getByRole("radio", { name: "Black ink" }).click();
check(await profit.getByText(/This book has color pages/).isVisible(), "choosing black ink for a book with color pages is warned about");
noPageErrors(p);
await b.close();
