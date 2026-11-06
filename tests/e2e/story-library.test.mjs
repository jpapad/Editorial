// The tale library (a classic retold for an age and language), the full story pack in that
// language, and "Read it to me" on the coloring board. AI endpoints are mocked.
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
await p.addInitScript(() => {
  window.__spoken = [];
  window.speechSynthesis.speak = (u) => window.__spoken.push({ text: u.text, lang: u.lang });
});
const db = await mockSupabase(p, { books: [bookRow()] });
db.usage = { used: 0, limit: 20, extra: 0, plan: "free" };

const story = {
  title: "Der Hase und die Schildkröte", ageGroup: "6-8", theme: "simple outlines", character: "a small kind tortoise with a round shell",
  pages: [
    { text: "Der Hase lacht über die Schildkröte.", scene: "a hare laughing at a tortoise" },
    { text: "Sie machen ein Wettrennen.", scene: "a hare and a tortoise at a start line" },
    { text: "Der Hase schläft unter einem Baum.", scene: "a hare sleeping under a tree" },
    { text: "Die Schildkröte gewinnt!", scene: "a tortoise crossing a finish line" },
  ],
  questions: [{ question: "Wer hat gewonnen?", choices: ["Der Hase", "Die Schildkröte", "Der Fuchs"], answer: 1 }],
  words: ["Hase", "Baum", "Ziel"],
  moral: "Langsam und stetig gewinnt.",
  discussion: ["Warum hat der Hase verloren?"],
};
const requests = [];
await p.route(`${BASE}/api/plan-story`, (route) => {
  requests.push(route.request().postDataJSON());
  return route.fulfill({ json: { story } });
});
await p.route(`${BASE}/api/generate-line-art`, (route) => route.fulfill({ json: { results: [{ ok: true, svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><circle cx="150" cy="200" r="100" fill="none" stroke="#000" stroke-width="12"/></svg>` }], refunded: 0 } }));

await p.goto(`${BASE}/studio`);
await p.waitForTimeout(2000);
await p.getByRole("button", { name: "Story book" }).click();
const dialog = p.getByRole("dialog", { name: "Story book" });
await dialog.getByRole("radio", { name: "From the tale library" }).click();
await dialog.getByRole("button", { name: "Patience" }).click();
check((await dialog.getByRole("radio", { name: /The Hare and the Tortoise/ }).count()) === 1 && (await dialog.getByRole("radio", { name: /The Boy Who Cried Wolf/ }).count()) === 0, "the library filters tales by theme");
await dialog.getByRole("radio", { name: /The Hare and the Tortoise/ }).click();
await dialog.getByLabel("Language of the story").selectOption("de");
await dialog.getByLabel("Age", { exact: true }).selectOption("6-8");
await p.screenshot({ path: shot("tale-library.png") });
await dialog.getByRole("button", { name: "Write the story" }).click();
await dialog.getByRole("textbox", { name: "Page 1 text" }).waitFor();
check(requests[0]?.lang === "de" && requests[0].idea.includes("The Hare and the Tortoise") && requests[0].idea.includes("aged 6 to 8") && requests[0].idea.includes("own fresh words"), "the tale is sent to be retold fresh, in German, for ages 6–8", JSON.stringify(requests[0]).slice(0, 160));
check(await dialog.getByText(/Wer hat gewonnen\?/).isVisible() && (await dialog.getByLabel("Words for the word search").inputValue()) === "Hase, Baum, Ziel", "the pack's questions and words are shown before anything is made");
await dialog.getByRole("button", { name: "Draw 4 pages" }).click();
await p.waitForURL(/\/studio\/editor\?book=/, { timeout: 30000 });

const book = db.books.find((x) => x.title === story.title);
const pageTexts = book.pages.map((pg) => pg.objects.filter((o) => o.kind === "text").map((o) => o.text));
const storyText = book.pages[0].objects.find((o) => o.role === "storyText");
check(storyText?.text === story.pages[0].text && storyText.lang === "de", "story text is marked as such, with its language");
const titles = pageTexts.slice(4).map((t) => t[0]);
check(book.pages.length === 11 && titles.join("|") === "Fragen|Bring es in die richtige Reihenfolge|Suchsel|Suchsel — Lösungen|Mal dein eigenes Ende|Lass uns darüber sprechen|Urkunde", "4 story pages, then the whole pack — titled in German", `${book.pages.length}: ${titles.join("|")}`);
check(book.pages.every((pg, i) => pg.pageNumber === i + 1), "pages numbered in order");

// Read it to me, in the story's language.
await p.goto(`${BASE}/studio/color?book=${book.id}`);
await p.waitForSelector("canvas", { timeout: 30000 });
await p.waitForTimeout(1500);
const auto = await p.evaluate(() => window.__spoken.at(-1));
check(auto?.text === story.pages[0].text && auto.lang === "de-DE", "opening a story page reads it aloud, with a German voice", JSON.stringify(auto));
await p.evaluate(() => (window.__spoken = []));
await p.getByRole("button", { name: "Read it to me" }).click();
check((await p.evaluate(() => window.__spoken.length)) === 1, "'Read it to me' reads the page again");
await p.screenshot({ path: shot("read-aloud.png") });
noPageErrors(p);
await b.close();
