// Library → "Or describe it" → AI plan → edit → pictures one by one → new book opens.
// The AI endpoints are mocked here; the real ones need OPENAI_API_KEY.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(p, { books: [bookRow()] });
db.usage = { used: 2, limit: 20 };

const planned = [];
await p.route(`${BASE}/api/plan-book`, async (route) => {
  planned.push(JSON.parse(route.request().postData()));
  await route.fulfill({ json: { plan: { title: "Farm friends", ageGroup: "3-5", theme: "very simple bold outlines", captions: true, pages: [{ label: "Cow", subject: "a friendly cow" }, { label: "Pig", subject: "a happy pig" }, { label: "Hen", subject: "a hen with chicks" }] } } });
});
const drawn = [];
await p.route(`${BASE}/api/generate-line-art`, async (route) => {
  const req = JSON.parse(route.request().postData());
  drawn.push(req);
  if (req.subject === "a happy pig") return route.fulfill({ status: 429, json: { error: "Monthly AI limit reached" } });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><circle cx="300" cy="400" r="200" fill="none" stroke="#000" stroke-width="12"/></svg>`;
  await route.fulfill({ json: { results: [{ ok: true, svgMarkup: svg }], refunded: 0 } });
});

await p.goto(`${BASE}/studio`);
await p.waitForTimeout(2000);
await p.getByPlaceholder("A 20-page book of farm animals for 4-year-olds").fill("3 farm animals for 4-year-olds");
await p.getByRole("button", { name: "Plan the book" }).click();
const dialog = p.getByRole("dialog", { name: "New book from a description" });
await dialog.getByRole("textbox", { name: "Title" }).waitFor();
check(planned[0]?.description === "3 farm animals for 4-year-olds" && planned[0]?.lang === "en", "sends the description (and UI language) to the planner");
check((await dialog.getByRole("textbox", { name: "Title" }).inputValue()) === "Farm friends", "plan title shown");
check(await dialog.getByText("Ages 3–5").isVisible(), "age group shown");
check(await dialog.getByText("3 pages = 3 AI images.").isVisible(), "shows what it costs");
await p.screenshot({ path: shot("book-plan.png") });

// Edit the plan: rename the book, add a page of our own.
await dialog.getByRole("textbox", { name: "Title" }).fill("On the farm");
const pagesBox = dialog.getByRole("textbox", { name: "Pages — one per line" });
await pagesBox.fill("Cow\nPig\nHen\nHorse");
await dialog.getByRole("button", { name: "Create 4 pages" }).click();
await p.waitForURL(/\/studio\/editor\?book=/, { timeout: 15000 });

check(drawn.map((d) => d.subject).join("|") === "a friendly cow|a happy pig|a hen with chicks|Horse", "planned subjects drawn in order; a new label is drawn as written", drawn.map((d) => d.subject).join("|"));
check(drawn.every((d) => d.theme === "very simple bold outlines"), "every picture gets the plan's style");
const book = db.books.find((x) => x.title === "On the farm");
check(Boolean(book) && book.pages.length === 3, "book created with the 3 pages that worked (limit hit on one)", `${book?.pages.length} pages`);
const caption = book?.pages[0].objects.find((o) => o.kind === "text")?.text;
check(book?.pages[0].objects.some((o) => o.kind === "stamp") && caption === "Cow", "each page: the picture plus its caption", caption);
check(new URL(p.url()).searchParams.get("book") === book?.id, "opens the new book in the editor");
noPageErrors(p);
await b.close();
