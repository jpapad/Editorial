// Adding activities onto a page you already made (a colored farm page): a maze from
// Worksheets and a question from Page-from-instructions go into its free space, over its background.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1470, height: 900 } });
const scene = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect width="400" height="300" fill="#bfe3ff"/><rect y="300" width="400" height="300" fill="#7cc576"/></svg>`);
const farm = { id: "farm", pageNumber: 1, space: { width: 612, height: 792, bleed: 0 }, lines: [], inColor: true, background: { image: scene, imageOpacity: 1 },
  objects: [{ kind: "text", id: "title", text: "Στη φάρμα", x: 36, y: 36, width: 540, height: 62, fontSize: 44, align: "center", fontFamily: "Arial", fill: "#c0392b", rotation: 0, scaleX: 1, scaleY: 1, isDragging: false }] };
const db = await mockSupabase(p, { books: [bookRow({ pages: [farm] })] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);

// ---- a maze from Worksheets, onto the farm page
await p.getByRole("button", { name: "Add page" }).click();
await p.getByRole("button", { name: /Worksheets/ }).click();
const ws = p.getByRole("dialog");
await ws.getByRole("radio", { name: "Maze" }).click();
await ws.getByRole("switch", { name: "Add it to the page you're on" }).click().catch(async () => ws.getByText("Add it to the page you're on").click());
await ws.getByRole("button", { name: "Add to this page" }).click();
await ws.waitFor({ state: "detached", timeout: 15000 });
await p.waitForTimeout(1500);
let pages = db.books[0].pages;
const page = pages[0];
check(pages.length === 3 && pages[0].id === "farm", "the first maze went onto the farm page; the other two (3 by default) were added after", String(pages.length));
check(page.background?.image === scene && page.objects.some((o) => o.id === "title") && page.lines.length > 20, "the farm background and title stay; the maze's walls are on the page");
const title = page.objects.find((o) => o.id === "title");
const wallsTop = Math.min(...page.lines.flatMap((l) => l.points.filter((_, i) => i % 2 === 1)));
check(wallsTop > title.y + title.height, "the maze sits under the title, in the free space", `${wallsTop} vs ${title.y + title.height}`);
check(page.objects.some((o) => o.kind === "shape" && String(o.fill).startsWith("rgba(255,255,255")), "with a light panel behind it, over the background");
await p.screenshot({ path: shot("onto-page-maze.png") });

// ---- a page full: Page from instructions offers a new page instead
await p.route(`${BASE}/api/page-from-instructions`, (route) => route.fulfill({ json: { spec: { mode: "color", frame: null, background: null, gradient: null, pattern: null, scene: null, warnings: [], blocks: [{ type: "choices", question: "Ποιο ζώο μας δίνει γάλα;", options: ["αγελάδα", "κότα"], marker: "circle", color: null, fill: null }] } } }));
await p.locator('[aria-label*="AI"]').first().click();
await p.getByRole("button", { name: "Write instructions" }).click();
const ins = p.getByRole("dialog", { name: "Page from instructions" });
check(await ins.getByRole("checkbox", { name: /Add it to the page you're on/ }).isDisabled(), "the farm page is now full, so 'add to this page' is off and says why");
await ins.getByRole("button", { name: "Close" }).click();

// ---- on a page with room, the question goes onto it
db.books[0].pages = [{ ...farm }];
await p.reload();
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
await p.locator('[aria-label*="AI"]').first().click();
await p.getByRole("button", { name: "Write instructions" }).click();
await ins.getByRole("radio", { name: "In color" }).click();
await ins.getByRole("checkbox", { name: /Add it to the page you're on/ }).check();
await ins.getByRole("textbox", { name: "Describe the page" }).fill("Ερώτηση «Ποιο ζώο μας δίνει γάλα;» με απαντήσεις αγελάδα, κότα για κύκλωμα.");
await ins.getByRole("button", { name: "Read my instructions" }).click();
await ins.getByRole("button", { name: "Make the page" }).click();
await ins.waitFor({ state: "detached", timeout: 15000 });
await p.waitForTimeout(1500);
pages = db.books[0].pages;
const texts = pages[0].objects.filter((o) => o.kind === "text").map((o) => o.text);
check(pages.length === 1 && texts.includes("Στη φάρμα") && texts.includes("Ποιο ζώο μας δίνει γάλα;") && texts.includes("αγελάδα"), "the question went onto the farm page, under the title", JSON.stringify(texts));
await p.screenshot({ path: shot("onto-page-question.png") });
noPageErrors(p);
await b.close();
