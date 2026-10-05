// Listing ideas and translation: prompts, parsers, the book-text plumbing,
// and Claude's side of both through a local stand-in for the Anthropic API.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { buildListingIdeasPrompt, buildTranslatePrompt, isTranslateCode, parseListingIdeas, parseTranslations } from "../../src/services/bookTexts";
import { applyTranslations, chunk, collectTexts } from "../../src/utils/translateBook";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

// ---- listing ideas
const ideas = parseListingIdeas({ keywords: ["farm animals coloring book", " Farm Animals Coloring Book ", "x".repeat(80), '"toddler" coloring', 5, "", "a", "b", "c", "d", "e"], categories: ["Books > Children's Books > Activities", "Books > Crafts", "Books > Education", "extra"], subtitle: "  For  ages 3-5 " });
ok(ideas.keywords.length === 7 && ideas.keywords[0] === "farm animals coloring book" && ideas.keywords[1].length === 50 && ideas.keywords[2] === "toddler coloring", "keywords: de-duplicated, cut to 50 characters, quotes removed, at most 7");
ok(ideas.categories.length === 3 && ideas.subtitle === "For ages 3-5", "3 categories at most; subtitle tidied");
let threw = false; try { parseListingIdeas({ keywords: [] }); } catch { threw = true; }
ok(threw && parseListingIdeas({ keywords: ["one"] }).categories.length === 0, "no keywords at all is an error; missing categories is not");
const lp = buildListingIdeasPrompt({ title: "Ζωάκια", theme: "farm", audience: "kids, ages 3-5", subjects: ["Αγελάδα", "Γάτα"], pageCount: 40, lang: "el" });
ok(lp.includes("Greek") && lp.includes("Αγελάδα") && lp.includes("exactly 7") && lp.includes("50 characters"), "the prompt names the language, the limits and what the book shows");

// ---- translation parsing
ok(parseTranslations({ translations: ["Cat", "", 7] }, ["Γάτα", "Σκύλος", "Άλογο"]).join() === "Cat,Σκύλος,Άλογο", "a missing or empty translation falls back to the original — nothing is lost");
ok(parseTranslations(["Cat"], ["Γάτα"])[0] === "Cat" && parseTranslations(null, ["Γάτα"])[0] === "Γάτα", "a bare array works; garbage leaves the text as it was");
const tp = buildTranslatePrompt(["Γάτα", "Αυτό το βιβλίο\nανήκει στ… {name}"], "de");
ok(tp.includes("German") && tp.includes("exactly 2") && tp.includes("{name}") && isTranslateCode("es") && !isTranslateCode("xx"), "the prompt names the language and count, and protects placeholders");

// ---- which texts get translated
const space = { width: 612, height: 792, bleed: 0 };
const text = (id: string, t: string, extra: Record<string, unknown> = {}): PageObject => ({ kind: "text", id, text: t, x: 0, y: 0, width: 100, height: 20, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "a", fontSize: 12, align: "center", fill: "#000", isDragging: false, ...extra } as PageObject);
const pages: BookPage[] = [
  { id: "a", pageNumber: 1, space, lines: [], thumbnailDataUrl: "data:t", objects: [text("1", "Κρυπτόλεξο"), text("2", "Γ"), text("3", "7"), text("4", "12", { role: "pageNumber" }), text("5", "γάτα γάτα", { dashed: true }), text("6", "Μπράβο, Μαρία!", { template: "Μπράβο, {name}!" })] },
  { id: "b", pageNumber: 2, space, lines: [], objects: [text("7", "Κρυπτόλεξο"), text("8", "1. Κάνει νιάου")] },
];
const found = collectTexts(pages);
ok(found.join("|") === "Κρυπτόλεξο|Μπράβο, {name}!|1. Κάνει νιάου", "titles, clues and placeholder wording are collected once each; single letters, numbers, page numbers and tracing rows are not");
const out = applyTranslations(pages, new Map([["Κρυπτόλεξο", "Word search"], ["Μπράβο, {name}!", "Well done, {name}!"], ["1. Κάνει νιάου", "1. It says meow"]]));
const tx = (p: number, i: number) => out[p].objects[i] as { text: string; template?: string };
ok(tx(0, 0).text === "Word search" && tx(1, 0).text === "Word search" && tx(1, 1).text === "1. It says meow", "every occurrence is translated");
ok(tx(0, 1).text === "Γ" && tx(0, 3).text === "12" && tx(0, 4).text === "γάτα γάτα", "grid letters, page numbers and tracing rows are untouched");
ok(tx(0, 5).template === "Well done, {name}!" && tx(0, 5).text === "Well done, {name}!", "a personalised text gets its wording translated, ready for the name to go back in");
ok(out[0].thumbnailDataUrl === undefined && pages[0].thumbnailDataUrl === "data:t" && (pages[0].objects[0] as { text: string }).text === "Κρυπτόλεξο", "changed pages lose their stale preview; the original book is untouched");
ok(applyTranslations(pages, new Map())[0] === pages[0], "nothing to translate → pages unchanged");
ok(chunk([1, 2, 3, 4, 5], 2).map((c) => c.length).join() === "2,2,1" && chunk([], 3).length === 0, "texts are sent in batches");

// ---- Claude's side, against a stand-in API
let next: unknown = {};
const seen: Record<string, unknown>[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => { seen.push(JSON.parse(raw || "{}")); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(next)); });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
process.env.ANTHROPIC_API_KEY = "test-key";
delete process.env.AI_TEXT_PROVIDER;
const message = (t: string) => ({ id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null, content: [{ type: "text", text: t }], usage: { input_tokens: 1, output_tokens: 1 } });
const { listingIdeasWithAi, translateWithAi } = await import("../../src/services/textAi");

next = message(JSON.stringify({ keywords: ["farm animal coloring", "toddler coloring book"], categories: ["Books > Children's Books > Activities, Crafts & Games > Coloring"], subtitle: "40 big pictures for ages 3-5" }));
const li = await listingIdeasWithAi({ title: "Farm", theme: "farm", audience: "kids", subjects: [], pageCount: 40, lang: "en" });
const schema = (seen.at(-1)!.output_config as { format: { type: string; schema: { required: string[] } } }).format;
ok(li.keywords.length === 2 && li.subtitle.startsWith("40 big") && schema.type === "json_schema" && schema.schema.required.join() === "keywords,categories,subtitle", "listing ideas go through Claude with a JSON schema and come back parsed");
next = message(JSON.stringify({ translations: ["Cat", "Dog"] }));
const tr = await translateWithAi(["Γάτα", "Σκύλος"], "en");
const sent = (seen.at(-1)!.messages as { content: string }[])[0].content;
ok(tr.join() === "Cat,Dog" && sent.includes("English") && sent.includes("Γάτα"), "translation sends the texts and target language, returns one string per text");
next = message(JSON.stringify({ translations: ["Cat"] }));
ok((await translateWithAi(["Γάτα", "Σκύλος"], "en")).join() === "Cat,Σκύλος", "a short reply never drops or shifts texts");
server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
