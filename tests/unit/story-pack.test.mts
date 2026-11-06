import { buildStoryPack, orderPage, packLabel, questionsPage } from "../../src/utils/storyPack";
import { buildStoryPrompt, parseStoryPlan } from "../../src/services/storyBook";
import { FAIRY_TALES, taleRequest } from "../../src/data/fairyTales";
import { interiorSpace, geometryFromSpace } from "../../src/utils/pageGeometry";
import { objectBounds } from "../../src/utils/objectGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };
const texts = (p: BookPage) => p.objects.filter((o) => o.kind === "text").map((o) => (o as PageObject & { text: string }).text);
const space = interiorSpace("8.5x11", false);
const { safe } = geometryFromSpace(space);
const inside = (p: BookPage) => p.objects.filter((o) => !(o.kind === "stamp" && o.isFrame)).every((o) => { const b = objectBounds(o); return b.left >= safe.left - 1 && b.right <= safe.right + 1 && b.top >= safe.top - 1 && b.bottom <= safe.bottom + 1; });

// ---- the AI's reply is checked and bounded
const plan = parseStoryPlan({
  title: "Bobo", character: "a bear", theme: "bold", ageGroup: "3-5",
  pages: [{ text: "Bobo walks.", scene: "a bear walking" }],
  questions: [
    { question: "What did Bobo eat?", choices: ["An apple", "A fish", "Honey"], answer: 0 },
    { question: "Bad index", choices: ["a", "b"], answer: 5 },
    { question: "One choice only", choices: ["a"], answer: 0 },
  ],
  words: ["apple", "apple", "rain bow", "butterfly", "x".repeat(30)],
  moral: "Nature is full of friends.",
  discussion: ["What would you do?", ""],
});
ok(plan.questions.length === 1 && plan.questions[0].answer === 0, "questions with a bad answer index or too few choices are dropped");
ok(plan.words.join() === "apple,butterfly,xxxxxxxxxxxxxx" || plan.words.join() === "apple,butterfly", "words: duplicates and phrases dropped, long ones cut", plan.words.join());
ok(plan.moral === "Nature is full of friends." && plan.discussion.length === 1, "moral and discussion kept, empty ones dropped");
const old = parseStoryPlan({ pages: [{ text: "a", scene: "b" }] });
ok(old.questions.length === 0 && old.words.length === 0 && old.moral === "", "a reply without the new fields still works (empty pack data)");
ok(buildStoryPrompt("x", "de").includes("in German") && buildStoryPrompt("x", "it").includes("in Italian") && buildStoryPrompt("x", "el").includes('"questions"'), "the prompt asks for the chosen language and the pack data");

// ---- pages, in the story's language
const story = { title: "Bobo im Wald", questions: [{ question: "Was hat Bobo gegessen?", choices: ["Einen Apfel", "Einen Fisch", "Honig"], answer: 0 }, { question: "Wen hat er getroffen?", choices: ["Eine Ente", "Einen Löwen", "Einen Hai"], answer: 0 }], words: ["Apfel", "Ente", "Mond", "Regen"], moral: "Die Natur ist voller Freunde.", discussion: ["Was würdest du tun?", "Wie fühlte sich Bobo?"] };
const pics = Array.from({ length: 8 }, (_, i) => ({ src: `data:pic${i}`, width: 600, height: 800 }));
const pack = buildStoryPack(space, story, pics, ["questions", "order", "words", "ending", "talk", "certificate"], "de", 7);
const all = pack.map(texts).flat();
ok(pack.length === 7, "all parts: questions, order, word search + answers, ending, talk, certificate = 7 pages", String(pack.length));
ok(all.includes("Fragen") && all.includes("Suchsel") && all.includes("Mal dein eigenes Ende") && all.includes("Urkunde"), "page titles are in German, the story's language — not the UI's");
ok(all.some((tx) => tx.includes("Bobo im Wald")), "the certificate names the story");
ok(pack.every(inside), "every pack page stays inside the safe area");
ok(buildStoryPack(space, story, pics, ["ending"], "el", 1).length === 1 && texts(buildStoryPack(space, story, pics, ["ending"], "el", 1)[0]).includes(packLabel("el", "ending")), "only the parts asked for, Greek labels for a Greek story");

const q = questionsPage(space, story.questions, "de")!;
ok(texts(q).some((tx) => tx.startsWith("Lösungen:") && tx.includes("1. Einen Apfel")), "the question page carries a small answer key for the grown-up");
ok(questionsPage(space, [], "de") === null, "no questions, no page");

const order = orderPage(space, pics, "en", 3)!;
const shown = order.objects.filter((o) => o.kind === "stamp").map((o) => Number((o as { src: string }).src.replace("data:pic", "")));
ok(shown.length === 6 && shown.includes(0) && shown.includes(7), "six pictures spread over the whole story, first and last included", shown.join());
ok(shown.some((v, i) => i > 0 && v < shown[i - 1]), "shown out of order (that's the puzzle)");
const key = texts(order).find((tx) => tx.startsWith("Answers:"))!;
const sorted = [...shown].sort((a, b) => a - b);
ok(key === `Answers: ${shown.map((v) => sorted.indexOf(v) + 1).join(" · ")}`, "the answer key gives each picture's place in the story", key);
ok(orderPage(space, pics.slice(0, 2), "en", 3) === null, "fewer than three pictures: no ordering page");
const firsts = Array.from({ length: 40 }, (_, seed) => Number((orderPage(space, pics, "en", seed)!.objects.find((o) => o.kind === "stamp") as { src: string }).src.replace("data:pic", "")));
ok(firsts.every((v) => v !== 0) && new Set(firsts).size >= 3, "across 40 shuffles the first card is never the story's first scene, and varies", firsts.join());

// ---- the tale library
ok(FAIRY_TALES.length === 10 && new Set(FAIRY_TALES.map((tl) => tl.id)).size === 10, "ten tales, unique ids");
ok(FAIRY_TALES.every((tl) => tl.title.el && tl.title.en && tl.moral.el && tl.summary.length > 80 && tl.character), "each has Greek and English titles and morals, a summary and a character");
const req = taleRequest(FAIRY_TALES[0], "6-8", 10);
ok(req.includes("in your own fresh words") && req.includes("aged 6 to 8") && req.includes("10 pages") && req.includes(FAIRY_TALES[0].summary), "a tale is retold fresh, for the chosen age and length");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
