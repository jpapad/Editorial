import { inkOverlap, lookAlikes, lookOf, offStyle, SIMILAR_OVERLAP } from "../../src/utils/pageLooks";
import { applyName, nameSlots } from "../../src/utils/personalize";
import { fitOnSheet, fullSheet, PRINTER_MARGIN_PT, samplePages, SHEETS } from "../../src/utils/printables";
import { runEditorPreflightCheck, thickenThinStrokes } from "../../src/utils/editorPreflight";
import { bookReadiness } from "../../src/utils/readiness";
import { createPageFromTemplate } from "../../src/components/editor/pageTemplates";
import { sudokuPages } from "../../src/components/editor/activities";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);

// ---- page looks: a white 120×150 "thumbnail" with black shapes
const W = 120, H = 150;
function thumb(paint: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (paint(x, y)) data[(y * W + x) * 4] = data[(y * W + x) * 4 + 1] = data[(y * W + x) * 4 + 2] = 0;
  return lookOf({ width: W, height: H, data });
}
const ring = (cx: number, cy: number, r: number, w: number) => (x: number, y: number) => { const d = Math.hypot(x - cx, y - cy); return d < r && d > r - w; };
const a = thumb(ring(60, 75, 40, 3));
const nudged = thumb(ring(61, 75, 40, 3));
const elsewhere = thumb((x, y) => ring(30, 40, 20, 3)(x, y) || (x > 70 && x < 110 && y > 100 && y < 103) || (x > 88 && x < 91 && y > 80 && y < 130));
const moved = thumb(ring(60, 95, 40, 3));
ok(inkOverlap(a.ink, a.ink) === 1 && inkOverlap(a.ink, nudged.ink) >= SIMILAR_OVERLAP && inkOverlap(a.ink, elsewhere.ink) < 0.4 && inkOverlap(a.ink, moved.ink) < SIMILAR_OVERLAP, `ink overlap: a 1px nudge stays high (${inkOverlap(a.ink, nudged.ink).toFixed(2)}); another picture (${inkOverlap(a.ink, elsewhere.ink).toFixed(2)}) or the same one moved down (${inkOverlap(a.ink, moved.ink).toFixed(2)}) is low`);
ok(a.lineWidth >= 3 && a.lineWidth <= 5 && thumb(ring(60, 75, 40, 9)).lineWidth >= 8 && a.density > 0.02 && a.density < 0.08, `line thickness and ink share are measured (${a.lineWidth}px, ${(a.density * 100).toFixed(1)}%)`);
ok(thumb(() => false).density === 0 && thumb(() => false).lineWidth === 0, "a blank page has no ink and no line width");
ok(lookAlikes([{ id: "1", look: a }, { id: "2", look: elsewhere }, { id: "3", look: nudged }, { id: "4", look: thumb(() => false) }, { id: "5", look: thumb(() => false) }]).join() === "3", "look-alikes: the later near-copy is reported; blank pages never are");
const normal = (i: number) => ({ id: "n" + i, look: thumb(ring(40 + i * 8, 60 + i * 6, 30, 3)) });
const book = [0, 1, 2, 3, 4].map(normal);
ok(offStyle(book).length === 0 && offStyle([...book, { id: "bold", look: thumb(ring(60, 75, 45, 10)) }]).join() === "bold", "off-style: a page with far thicker lines than the rest stands out");
ok(offStyle([...book, { id: "busy", look: thumb((x, y) => (x + y) % 4 < 2 && x > 10 && x < 110 && y > 10 && y < 140 && (x % 6 < 3)) }]).includes("busy"), "…and so does a page far busier than the rest");
ok(offStyle(book.slice(0, 3).concat({ id: "bold", look: thumb(ring(60, 75, 45, 10)) })).length === 0, "with fewer than 5 drawn pages there is no 'typical' to compare against");

// ---- readiness takes the look hints
const drawn = (i: number): BookPage => ({ id: "p" + i, pageNumber: i + 1, space, objects: [], lines: [{ id: "l" + i, tool: "pen", strokeWidth: 6, points: [200, 200 + i * 5, 250, 260, 300, 300 + i * 5] }] });
const pages = Array.from({ length: 24 }, (_, i) => drawn(i));
const hinted = bookReadiness(pages, { similar: ["p3", "p4"], offStyle: ["p9"] });
ok(bookReadiness(pages).score === 100 && bookReadiness(pages).items.every((i) => i.id !== "look-alikes"), "without previews the look checks aren't listed (library cards)");
ok(hinted.score === 100 - 6 - 2 && hinted.items.find((i) => i.id === "look-alikes")!.pageIds.length === 2 && !hinted.items.find((i) => i.id === "style")!.ok, `look-alikes cost 3 each, off-style 2 (${hinted.score})`);

// ---- faint-line check leaves ruled grids alone
const sudoku = sudokuPages(space, 6, "easy", false, 1).puzzle;
ok(runEditorPreflightCheck([sudoku]).every((i) => i.code !== "THIN_STROKE"), "a sudoku's thin grid lines are not 'faint lines'");
const sketch: BookPage = { id: "s", pageNumber: 1, space, objects: [], lines: [{ id: "a", tool: "pen", strokeWidth: 1, points: [100, 100, 150, 130, 200, 100] }, { id: "rule", tool: "pen", strokeWidth: 1, points: [100, 300, 400, 300] }] };
const issue = runEditorPreflightCheck([sketch]).find((i) => i.code === "THIN_STROKE");
ok(issue?.count === 1, "a thin hand-drawn stroke is still flagged — and only that one");
const fixed = thickenThinStrokes([sketch])[0].lines;
ok(fixed[0].strokeWidth === 3 && fixed[1].strokeWidth === 1, "Fix thickens the drawn stroke and leaves the ruled line thin");

// ---- personalise
const text = (id: string, t: string): PageObject => ({ kind: "text", id, text: t, x: 0, y: 0, width: 100, height: 20, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "a", fontSize: 12, align: "center", fill: "#000", isDragging: false });
const bk: BookPage[] = [{ id: "a", pageNumber: 1, space, lines: [], objects: [text("1", "This book belongs to {name}"), text("2", "No name here")] }, { id: "b", pageNumber: 2, space, lines: [], objects: [text("3", "Μπράβο, {όνομα}! {NAME}")] }];
ok(nameSlots(bk) === 2, "two texts take a name (English and Greek placeholders)");
const maria = applyName(bk, " Μαρία ");
const t1 = (p: BookPage[], i: number, j: number) => (p[i].objects[j] as { text: string; template?: string });
ok(t1(maria, 0, 0).text === "This book belongs to Μαρία" && t1(maria, 1, 0).text === "Μπράβο, Μαρία! Μαρία" && t1(maria, 0, 1) === t1(bk, 0, 1), "the name goes into every placeholder; other texts are untouched");
const nikos = applyName(maria, "Νίκος");
ok(t1(nikos, 0, 0).text === "This book belongs to Νίκος" && nameSlots(nikos) === 2, "re-personalising replaces the old name (the wording is remembered)");
ok(t1(applyName(nikos, ""), 0, 0).text === "This book belongs to {name}" && applyName(maria, "Μαρία")[0] === maria[0], "an empty name puts the placeholder back; the same name again changes nothing");

// ---- print at home
const fit = fitOnSheet("src", space, "a4");
ok(fit.pageWidth === SHEETS.a4.width && fit.x >= PRINTER_MARGIN_PT - 0.01 && fit.y >= PRINTER_MARGIN_PT - 0.01 && Math.abs(fit.imageWidth / fit.imageHeight - 612 / 792) < 1e-6, "a Letter page on A4: inside the printer margin, proportions kept");
ok(Math.abs(fit.x * 2 + fit.imageWidth - SHEETS.a4.width) < 0.01 && Math.abs(fit.y * 2 + fit.imageHeight - SHEETS.a4.height) < 0.01, "centred on the sheet");
const bleed = fitOnSheet("src", interiorSpace("8.5x11", true), "letter");
ok(bleed.x < PRINTER_MARGIN_PT && Math.abs(bleed.imageWidth - (612 + 18) * ((612 - 36) / 612)) < 0.5, "a page with bleed is placed so the bleed falls outside the printed area");
ok(fullSheet("i", "letter").imageWidth === 612 && fullSheet("i", "letter").x === 0, "the instructions page fills the sheet");
const list = [0, 1, 2, 3, 4, 5].map((i) => ({ id: "p" + i, objects: i === 2 ? [] : [1], lines: [], isBlankBack: i === 4 }));
ok(samplePages(list, "p0").map((p) => p.id).join() === "p0,p1,p3,p5" && samplePages(list, "p5").map((p) => p.id).join() === "p0,p1,p3,p5", "test print: 4 drawn pages from the current one (empty and blank-back pages skipped), topped up near the end");

// ---- new page templates
const cert = createPageFromTemplate(1, space, "certificate");
const stick = createPageFromTemplate(1, space, "stickers");
ok(cert.objects.some((o) => o.kind === "text" && (o as { text: string }).text === "Certificate") && cert.objects.some((o) => o.kind === "stamp" && o.isFrame), "certificate: title in a frame");
ok(stick.lines.length === 12 && stick.lines.every((l) => l.style === "dashed" && l.strokeWidth >= 3) && stick.objects.filter((o) => o.kind === "shape").length === 12, "stickers: 12 dashed cut circles, each with a shape to color");
ok(runEditorPreflightCheck([cert, stick]).every((i) => i.code !== "THIN_STROKE" && i.code !== "MARGIN_SAFETY"), "both templates pass the print checks as generated");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
