// AI keyword/category suggestions in the listing kit, and translating a book into a new copy.
// The two AI routes are stubbed — what's tested is everything around the model.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b);
const space = { width: 612, height: 792, bleed: 0 };
const text = (id, value, extra = {}) => ({ kind: "text", id, text: value, x: 80, y: 80 + Number(id.slice(1)) * 60, width: 400, height: 40, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "Arial", fontSize: 24, align: "center", fill: "#111827", isDragging: false, ...extra });
const BOOK = "22222222-2222-4222-8222-222222222222";
const db = await mockSupabase(p, {
  books: [bookRow({ id: BOOK, title: "Ζωάκια", trim_size: "8.5x11", pages: [
    { id: "p1", pageNumber: 1, space, lines: [], objects: [text("t1", "Αυτό το βιβλίο ανήκει στ…"), text("t2", "Γ"), text("t3", "1", { role: "pageNumber" })] },
    { id: "p2", pageNumber: 2, space, lines: [], objects: [text("t4", "Γάτα"), text("t5", "Αυτό το βιβλίο ανήκει στ…")] },
  ] })],
});

const ideaCalls = [];
await p.route("**/api/listing-ideas", async (route) => {
  ideaCalls.push(route.request().postDataJSON());
  await route.fulfill({ json: { ideas: { keywords: ["farm animals coloring book", "toddler coloring ages 3-5", "easy animal coloring pages"], categories: ["Books > Children's Books > Activities, Crafts & Games > Coloring"], subtitle: "Big, simple pictures for little hands" } } });
});
const DICT = { "Αυτό το βιβλίο ανήκει στ…": "This book belongs to", "Γάτα": "Cat" };
const translateCalls = [];
let failTranslate = true;
await p.route("**/api/translate-texts", async (route) => {
  const body = route.request().postDataJSON();
  translateCalls.push(body);
  if (failTranslate) return route.fulfill({ status: 503, json: { error: "No AI key is set — add ANTHROPIC_API_KEY (Claude) or OPENAI_API_KEY to .env.local." } });
  await route.fulfill({ json: { translations: body.texts.map((s) => DICT[s] ?? s) } });
});

await p.goto(`${BASE}/studio/editor?book=${BOOK}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
const side = (name) => p.getByRole("button", { name, exact: true });

// ---- listing ideas
await side("Amazon listing kit").scrollIntoViewIfNeeded();
await side("Amazon listing kit").click();
let dialog = p.getByRole("dialog");
await dialog.getByRole("button", { name: "Suggest with AI" }).click();
await p.waitForTimeout(500);
check(ideaCalls.length === 1 && ideaCalls[0].title === "Ζωάκια" && ideaCalls[0].pageCount === 2 && ideaCalls[0].subjects.includes("Γάτα"), "the request describes the book: title, page count and what its pages show", JSON.stringify(ideaCalls[0]));
check(await dialog.getByText("toddler coloring ages 3-5").isVisible() && await dialog.getByText("Keywords (3 of 7 slots)").isVisible(), "the suggested keywords replace the list");
check(await dialog.getByText("Books > Children's Books > Activities, Crafts & Games > Coloring").isVisible() && await dialog.getByText("Big, simple pictures for little hands").isVisible(), "categories and a subtitle are shown, each with a copy button");
check(await dialog.getByText(/Suggestions, not data/).isVisible() && await dialog.getByRole("button", { name: "Suggest again" }).isVisible(), "they are labelled as suggestions to verify");
await p.screenshot({ path: shot("listing-ai.png") });
await dialog.getByRole("button", { name: "Close" }).click();

// ---- translate: a failure is reported and nothing is created
await side("Translate the book").scrollIntoViewIfNeeded();
await side("Translate the book").click();
dialog = p.getByRole("dialog");
check(await dialog.getByText(/2 texts will be translated/).isVisible(), "2 distinct texts found (the repeated line counts once; the grid letter and page number don't)");
await dialog.getByRole("button", { name: "Translate into a new book" }).click();
await p.waitForTimeout(600);
check(await dialog.getByText(/No AI key is set/).isVisible() && db.books.length === 1, "without an AI key the reason is shown and no book is created");
await p.screenshot({ path: shot("translate-error.png") });

// ---- translate: success → a new book, opened
failTranslate = false;
await dialog.getByRole("button", { name: "Translate into a new book" }).click();
await p.waitForURL((url) => url.searchParams.get("book") !== BOOK && url.pathname.endsWith("/editor"), { timeout: 20000 });
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1200);
const made = db.books.find((bk) => bk.title === "Ζωάκια (EN)");
const words = (pg) => pg.objects.map((o) => o.text).join("|");
check(Boolean(made) && db.books.length === 2 && translateCalls.at(-1).target === "en" && translateCalls.at(-1).texts.length === 2, "a 'Ζωάκια (EN)' book is created from one batch of 2 texts");
check(made && words(made.pages[0]) === "This book belongs to|Γ|1" && words(made.pages[1]) === "Cat|This book belongs to", "its texts are translated; the grid letter and page number are as they were", made && words(made.pages[0]));
check(words(db.books.find((bk) => bk.id === BOOK).pages[1]) === "Γάτα|Αυτό το βιβλίο ανήκει στ…", "the original book is unchanged");
const shown = await p.evaluate(() => window.Konva.stages[0].findOne(".ink-layer").find("Text").map((t) => t.text()));
check(shown.includes("This book belongs to"), "the editor opens the translated copy");
await p.screenshot({ path: shot("translated-book.png") });

check(p.dialogs.length === 0, "no alerts");
noPageErrors(p);
await b.close();
