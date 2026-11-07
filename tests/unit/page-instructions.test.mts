import { buildPageSpecPrompt, parsePageSpec, type PageSpec } from "../../src/services/pageSpec";
import { layoutPageSpec, pictureKey, picturesToMake, type PictureMap } from "../../src/utils/pageLayout";
import { interiorSpace, geometryFromSpace } from "../../src/utils/pageGeometry";
import { objectBounds } from "../../src/utils/objectGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const { safe } = geometryFromSpace(space);
const texts = (p: BookPage) => p.objects.filter((o) => o.kind === "text").map((o) => (o as PageObject & { text: string }).text);
const inside = (p: BookPage) => p.objects.filter((o) => !(o.kind === "stamp" && o.isFrame)).every((o) => { const b = objectBounds(o); return b.left >= safe.left - 1 && b.right <= safe.right + 1 && b.top >= safe.top - 1 && b.bottom <= safe.bottom + 1; });
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

// ---- reading the model's answer: known blocks only, bounded, nothing invented
const spec = parsePageSpec({
  frame: "stars",
  blocks: [
    { type: "title", text: "Τα ζώα της φάρμας", size: "large", align: "center" },
    { type: "pictures", items: [{ subject: "a cow", caption: "αγελάδα" }, { subject: "a sheep", caption: "" }, { subject: "a hen", caption: "" }, { subject: "a pig", caption: "" }], columns: 2, boxed: true, writeLine: true, marker: "none" },
    { type: "text", text: "Κύκλωσε αυτό που μας δίνει γάλα.", size: "medium", align: "left", style: "normal" },
    { type: "rocket", text: "unknown block" },
    { type: "lines", count: 99, handwriting: false },
  ],
  warnings: ["Δεν μπορώ να βάλω φωτογραφία."],
});
ok(spec.frame === "stars" && spec.blocks.length === 4, "unknown block types are dropped, known ones kept in order");
ok(spec.blocks[0].type === "title" && spec.blocks[0].text === "Τα ζώα της φάρμας", "texts kept word for word (Greek, accents)");
ok(spec.blocks[3].type === "lines" && spec.blocks[3].count === 20, "counts are bounded (99 lines → 20)");
ok(spec.warnings[0] === "Δεν μπορώ να βάλω φωτογραφία.", "warnings come through for the user");
ok(parsePageSpec({ frame: "made-up", blocks: [{ type: "space", label: "", boxed: true }] }).frame === null, "an unknown frame is ignored");
ok(throws(() => parsePageSpec({ blocks: [], warnings: [] })), "an empty answer is an error, not a blank page");
const prompt = buildPageSpecPrompt("Τίτλος «Γεια»", "el");
ok(prompt.includes("WORD FOR WORD") && prompt.includes("Never add") && prompt.includes("Numbers are exact") && prompt.includes("warnings"), "the prompt insists on verbatim text, exact numbers, nothing extra, and reporting what can't be done");

// ---- layout: exactly what was asked, inside the page
const pics: PictureMap = new Map(picturesToMake(spec).map(({ key }) => [key, { src: `data:${key}`, width: 512, height: 512 }]));
ok(picturesToMake(spec).map((p) => p.subject).join() === "a cow,a sheep,a hen,a pig", "the pictures to make are exactly the ones listed, in order");
const { page, extraPages, continued } = layoutPageSpec(spec, space, pics, 1);
const stamps = page.objects.filter((o) => o.kind === "stamp" && !o.isFrame);
ok(stamps.length === 4, "4 pictures asked → 4 pictures on the page", String(stamps.length));
const xs = new Set(stamps.map((s) => Math.round(s.x + s.width / 2)));
const ys = new Set(stamps.map((s) => Math.round(s.y)));
ok(xs.size === 2 && ys.size === 2, "2 columns asked → 2 columns and 2 rows", `${xs.size}×${ys.size}`);
ok(texts(page).includes("Τα ζώα της φάρμας") && texts(page).includes("Κύκλωσε αυτό που μας δίνει γάλα.") && texts(page).includes("αγελάδα"), "every text is on the page exactly as written");
const rules = page.objects.filter((o) => o.kind === "shape" && o.shapeKind === "line");
const allRules = [page, ...extraPages].flatMap((pg) => pg.objects.filter((o) => o.kind === "shape" && o.shapeKind === "line"));
ok(allRules.length === 4 + 20, "a write line under each picture (4) plus all 20 lines asked for — none lost", String(allRules.length));
ok([page, ...extraPages].every((pg) => pg.objects.some((o) => o.kind === "stamp" && o.isFrame)), "the frame asked for is on every page");
ok([page, ...extraPages].every(inside), "everything stays inside the safe area, on every page");
ok(continued && extraPages.length >= 1, "20 lines + 4 pictures don't fit on one page: it continues on the next (reported)");
const short = layoutPageSpec({ ...spec, blocks: spec.blocks.slice(0, 3) }, space, pics, 1);
ok(!short.continued && short.extraPages.length === 0 && inside(short.page), "a page that fits stays one page");

// Order: title above pictures above the sentence.
const titleY = page.objects.find((o) => o.kind === "text" && (o as { text: string }).text === "Τα ζώα της φάρμας")!.y;
const sentenceY = page.objects.find((o) => o.kind === "text" && (o as { text: string }).text.startsWith("Κύκλωσε"))!.y;
ok(titleY < Math.min(...stamps.map((s) => s.y)) && Math.max(...stamps.map((s) => s.y)) < sentenceY, "blocks keep the order of the instructions, top to bottom");

// Missing pictures leave a labelled box, nothing silently dropped.
const noPics = layoutPageSpec(spec, space, new Map(), 1).page;
ok(texts(noPics).filter((tx) => ["a cow", "a sheep", "a hen", "a pig"].includes(tx)).length === 4, "a picture that couldn't be made leaves a box saying what goes there");

// Other blocks.
const misc: PageSpec = parsePageSpec({ frame: null, blocks: [
  { type: "table", rows: 3, columns: 4, header: ["Όνομα", "", "", ""] },
  { type: "choices", question: "Ποιο ζώο νιαουρίζει;", options: ["σκύλος", "γάτα", "πάπια"], marker: "checkbox" },
  { type: "numbered", items: ["Πώς λέγεσαι;", "Πόσο χρονών είσαι;"], writeLine: true },
  { type: "lines", count: 2, handwriting: true },
  { type: "bubble", text: "Γεια σου!" },
  { type: "activity", kind: "wordsearch", words: ["ΓΑΤΑ", "ΣΚΥΛΟΣ"] },
  { type: "activity", kind: "maze", words: [] },
] });
const m = layoutPageSpec(misc, space, new Map(), 2);
const rects = m.page.objects.filter((o) => o.kind === "shape" && o.shapeKind === "rectangle");
ok(rects.length >= 16 + 3, "a 3-row table with a header = 16 cells (+ 3 tick boxes)", String(rects.length));
ok(texts(m.page).includes("1. Πώς λέγεσαι;") && texts(m.page).includes("Γεια σου!") && texts(m.page).includes("γάτα"), "numbered items, speech bubble and answers written as given");
ok(m.extraPages.length === 2, "word search and maze each get their own page after this one");
ok(inside(m.page) && !m.continued, "a mixed page fits on one page, inside the margins");
ok(pictureKey(2, 3) === "2:3", "picture keys are block:item");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
