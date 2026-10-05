// Story book (text + scenes, same character on every page), auto-vectorized AI pictures,
// and niche ideas → "Plan this book". AI endpoints are mocked.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(p, { books: [bookRow()] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };

const story = {
  title: "Lina sees the sea",
  ageGroup: "3-5",
  theme: "very simple bold outlines",
  character: "a small sea turtle with a round shell and a tiny backpack",
  pages: [
    { text: "Lina lives on the sand.", scene: "Lina the turtle on a sandy beach" },
    { text: "She walks to the water.", scene: "Lina walking towards small waves" },
    { text: "Splash! She swims with a crab.", scene: "Lina swimming next to a smiling crab" },
  ],
};
await p.route(`${BASE}/api/plan-story`, (route) => route.fulfill({ json: { story } }));
const drawn = [];
await p.route(`${BASE}/api/generate-line-art`, async (route) => {
  drawn.push(JSON.parse(route.request().postData()));
  // A raster picture, as the image providers really send: a PNG inside an <svg><image>.
  const png = await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 300; c.height = 400; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 300, 400); x.lineWidth = 14; x.beginPath(); x.arc(150, 200, 100, 0, Math.PI * 2); x.stroke(); return c.toDataURL("image/png"); });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><image href="${png}" x="0" y="0" width="300" height="400"/></svg>`;
  await route.fulfill({ json: { results: [{ ok: true, svgMarkup: svg }], refunded: 0 } });
});

await p.goto(`${BASE}/studio`);
await p.waitForTimeout(2000);
await p.getByRole("button", { name: "Story book" }).click();
const dialog = p.getByRole("dialog", { name: "Story book" });
await dialog.getByRole("textbox", { name: "What's the story about?" }).fill("a little turtle who wants to see the sea");
await dialog.getByRole("button", { name: "Write the story" }).click();
await dialog.getByRole("textbox", { name: "Page 1 text" }).waitFor();
check((await dialog.getByRole("textbox", { name: "Main character (how they look on every page)" }).inputValue()).includes("tiny backpack"), "the story comes with its main character, editable");
await dialog.getByRole("textbox", { name: "Page 2 text" }).fill("She walks slowly to the water.");
await p.screenshot({ path: shot("story-plan.png") });
await dialog.getByRole("button", { name: "Draw 3 pages" }).click();
await p.waitForURL(/\/studio\/editor\?book=/, { timeout: 30000 });

check(drawn.length === 3 && drawn.every((d) => d.character === story.character && d.theme === story.theme), "every picture is drawn with the same character description and style");
check(drawn[0].characterRef === undefined && drawn.slice(1).every((d) => /^data:image\/png;base64,/.test(d.characterRef ?? "")), "pages 2 and 3 are drawn from page 1's picture (as a PNG reference)");
const book = db.books.find((x) => x.title === "Lina sees the sea");
const texts = book?.pages.map((pg) => pg.objects.find((o) => o.kind === "text")?.text);
check(book?.pages.length === 3 && texts[1] === "She walks slowly to the water.", "the book has a page per sentence, with the edited text", JSON.stringify(texts));
const stamp = book?.pages[0].objects.find((o) => o.kind === "stamp");
const svg = decodeURIComponent(stamp?.src.replace(/^data:image\/svg\+xml;utf8,/, "") ?? "");
check(/<path/.test(svg) && !/<image/.test(svg), "AI pictures arrive traced to vector outlines (no embedded pixels)");

// Niche ideas → plan this book.
await p.goto(`${BASE}/studio`);
await p.waitForTimeout(1500);
await p.route(`${BASE}/api/niche-ideas`, (route) => route.fulfill({ json: { ideas: [{ title: "Dino ABC", audience: "ages 4–6", angle: "an alphabet where every letter is a dinosaur", keywords: ["dinosaur alphabet coloring book", "abc dinosaur coloring"], pageIdeas: ["T-Rex for T", "Ankylosaurus for A"], competition: "low", why: "Classroom favourite." }] } }));
let planned = null;
await p.route(`${BASE}/api/plan-book`, (route) => { planned = JSON.parse(route.request().postData()); return route.fulfill({ json: { plan: { title: "Dino ABC", ageGroup: "3-5", theme: "bold", captions: true, pages: [{ label: "A", subject: "an ankylosaurus" }] } } }); });
await p.getByRole("button", { name: "Find a book idea" }).click();
const niche = p.getByRole("dialog", { name: "Find a book idea" });
await niche.getByRole("textbox", { name: "Topic" }).fill("dinosaurs");
await niche.getByRole("radio", { name: "Amazon.co.uk" }).click();
await niche.getByRole("button", { name: "Find ideas" }).click();
await niche.getByText("Dino ABC").waitFor();
check(await niche.getByText("Less crowded").isVisible() && await niche.getByText(/AI suggestions, not sales figures/).isVisible(), "ideas show a competition estimate, clearly marked as AI suggestions");
const amazon = await niche.getByRole("link", { name: "“dinosaur alphabet coloring book” on Amazon" }).getAttribute("href");
check(amazon === "https://www.amazon.co.uk/s?k=dinosaur%20alphabet%20coloring%20book&i=stripbooks", "each keyword links to a real search on the chosen Amazon", amazon);
await p.screenshot({ path: shot("niche-ideas.png") });
await niche.getByRole("button", { name: "Plan this book" }).click();
await p.getByRole("dialog", { name: "New book from a description" }).getByRole("textbox", { name: "Title" }).waitFor();
check(Boolean(planned?.description.startsWith("Dino ABC — an alphabet where every letter is a dinosaur")), "'Plan this book' hands the idea to the book planner", planned?.description);
noPageErrors(p);
await b.close();
