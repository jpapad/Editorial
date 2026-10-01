import { applyFrameToAll, applyPatternToAll, propagateRepeats, setLineWidth, variationSubjects, withRepeats } from "../../src/utils/bookTools";
import { repeatOnAllPages } from "../../src/utils/pageNumbers";
import { FRAMES } from "../../src/components/editor/frameLibrary";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const page = (id: string, extra: Partial<BookPage> = {}): BookPage => ({ id, pageNumber: 0, space, objects: [], lines: [], ...extra });
const star = (id: string, extra: Partial<PageObject> = {}): PageObject => ({ kind: "shape", id, shapeKind: "star", x: 40, y: 40, width: 50, height: 50, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 3, ...extra } as PageObject);
const book = [page("cover", { isCover: true }), page("a", { objects: [star("s1")] }), page("b"), page("back", { isBlankBack: true })];
const frames = (p: BookPage) => p.objects.filter((o) => o.kind === "stamp" && o.isFrame);

// ---- frame / background on all pages
const framed = applyFrameToAll(book, FRAMES[0].id);
ok(framed.map((p) => frames(p).length).join("") === "0110", "frame goes on every content page — not the cover or blank backs");
ok(framed[1].objects[0].kind === "stamp" && framed[1].objects[1].id === "s1", "the frame sits behind the page's own objects");
const reframed = applyFrameToAll(framed, FRAMES[1].id);
ok(reframed.every((p) => frames(p).length <= 1) && (frames(reframed[1])[0] as { frameId?: string }).frameId === FRAMES[1].id, "applying another frame replaces the old one");
ok(applyFrameToAll(reframed, null).every((p) => frames(p).length === 0) && applyFrameToAll(book, null)[2] === book[2], "none removes them; untouched pages keep their identity");
const pat = applyPatternToAll(book, "stars");
ok(pat.map((p) => p.backgroundPatternId ?? "-").join() === "-,stars,stars,-" && applyPatternToAll(pat, "stars")[1] === pat[1], "background pattern on content pages only; no-op when already set");

// ---- line width
const drawn = [page("a", { lines: [{ id: "l1", tool: "pen", strokeWidth: 2, points: [0, 0, 9, 9] }, { id: "g", tool: "pen", strokeWidth: 0.6, points: [0, 0, 9, 9] }, { id: "e", tool: "eraser", strokeWidth: 20, points: [0, 0, 9, 9] }], objects: [star("s1")] }), page("b", { lines: [{ id: "l2", tool: "pen", strokeWidth: 9, points: [0, 0, 9, 9] }] })];
const one = setLineWidth(drawn, 5, "a");
ok(one[0].lines.map((l) => l.strokeWidth).join() === "5,0.6,20" && (one[0].objects[0] as { strokeWidth: number }).strokeWidth === 5, "pen lines and shape outlines take the new thickness; hairline guides and eraser strokes don't");
ok(one[1] === drawn[1] && setLineWidth(drawn, 5)[1].lines[0].strokeWidth === 5, "one page only, or the whole book");

// ---- master elements
const rep = repeatOnAllPages([page("a", { objects: [star("s1")] }), page("b"), page("c")], "a", ["s1"]);
const before = rep[0].objects;
const movedBook = rep.map((p) => (p.id === "a" ? { ...p, objects: p.objects.map((o) => ({ ...o, x: 300 })) } : p));
const synced = propagateRepeats(movedBook, "a", before);
ok(synced.every((p) => p.objects[0].x === 300), "moving a repeated element on one page moves it on every page");
ok(synced[1].objects[0].id === rep[1].objects[0].id && synced[1].objects[0].id !== synced[0].objects[0].id, "copies keep their own ids");
ok(propagateRepeats(rep, "a", before) === rep, "nothing changed → nothing touched");
const removed = rep.map((p) => (p.id === "a" ? { ...p, objects: [] } : p));
ok(propagateRepeats(removed, "a", before)[1].objects.length === 1, "deleting the copy on one page leaves the others (a page can opt out)");
const added = withRepeats([page("new"), page("blank", { isBlankBack: true })], rep);
ok(added[0].objects.length === 1 && added[0].objects[0].repeatId === rep[0].objects[0].repeatId && added[1].objects.length === 0, "a page added later gets the repeated elements; blank backs don't");
ok(withRepeats(added, rep)[0].objects.length === 1 && withRepeats([page("n")], [page("x")])[0].objects.length === 0, "never doubled; a book without repeats adds nothing");

// ---- variations
const v = variationSubjects("a happy cow", 5);
ok(v.length === 5 && new Set(v).size === 5 && v.every((s) => s.startsWith("a happy cow, ")) && variationSubjects("  ", 5).length === 0, "5 distinct variations of the subject; nothing for an empty subject");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
