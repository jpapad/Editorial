import { buildCrossword, buildWordGrid, clipLeft, crosswordPages, finishDrawingPage, normalizeWord, wordSearchPages } from "../../src/components/editor/puzzles";
import { applyPageNumbers, pageNumberMode, removeRepeats, repeatOnAllPages, syncPageNumbers } from "../../src/utils/pageNumbers";
import { lineDash } from "../../src/components/editor/strokeTools";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const texts = (p: BookPage) => p.objects.filter((o) => o.kind === "text").map((o) => (o as { text: string }).text);

// ---- word search
ok(normalizeWord("γάτα") === "ΓΑΤΑ" && normalizeWord("σκύλος!") === "ΣΚΥΛΟΣ" && normalizeWord("ice cream") === "ICECREAM", "normalizeWord: accents off, upper case, letters only");
const greek = ["γάτα", "σκύλος", "άλογο", "λαγός", "πάπια", "πρόβατο"];
const g = buildWordGrid(greek, 12, 5);
ok(g.skipped.length === 0 && g.placements.length === 6, `all 6 Greek words placed (${g.placements.length})`);
ok(g.placements.every((p) => [...p.word].every((ch, i) => g.grid[p.row + p.dRow * i][p.col + p.dCol * i] === ch)), "every placed word reads correctly in the grid");
ok(g.grid.every((r) => r.length === 12 && r.every((c) => /^[Α-Ω]$/.test(c))), "grid is full, filler letters are Greek capitals");
ok(JSON.stringify(buildWordGrid(greek, 12, 5).grid) === JSON.stringify(g.grid) && JSON.stringify(buildWordGrid(greek, 12, 6).grid) !== JSON.stringify(g.grid), "same seed = same grid, new seed = new grid");
ok(buildWordGrid(["cat", "dog"], 10, 1).grid.flat().every((c) => /^[A-Z]$/.test(c)), "Latin words get Latin filler");
ok(buildWordGrid(["ABCDEFGHIJKLMNOP"], 10, 1).skipped.length === 1, "a word longer than the grid is skipped, not truncated");
const ws = wordSearchPages(space, greek, 5)!;
ok(ws.puzzle.lines.length === 0 && ws.answers.lines.length === 6, "puzzle page has no marks, answers page strikes all 6 words");
ok(greek.map(normalizeWord).every((w) => texts(ws.puzzle).includes(w)), "the word list is printed on the page");
const inSafe = (o: PageObject) => o.x >= 36 - 0.5 && o.x + o.width <= 612 - 36 + 0.5 && o.y >= 36 - 0.5 && o.y + o.height <= 792 - 36 + 0.5;
ok(ws.puzzle.objects.every(inSafe), "word search stays inside the safe area");
ok(wordSearchPages(space, ["", "a"], 1) === null, "no usable words → null");

// ---- crossword
const entries = [
  { word: "γάτα", clue: "Κάνει νιάου" }, { word: "σκύλος", clue: "Γαβγίζει" }, { word: "άλογο", clue: "Το καβαλάμε" },
  { word: "πάπια", clue: "Κάνει πα πα" }, { word: "πρόβατο", clue: "Μας δίνει μαλλί" }, { word: "λαγός", clue: "Τρώει καρότα" },
];
const cw = buildCrossword(entries, 3);
ok(cw.words.length >= 4, `crossword places most words (${cw.words.length}/6, skipped: ${cw.skipped.join(",") || "none"})`);
ok(cw.words.every((w) => [...w.word].every((ch, i) => cw.cells.get(`${w.row + (w.across ? 0 : i)},${w.col + (w.across ? i : 0)}`) === ch)), "every word reads correctly in its cells");
ok(cw.words.length + cw.skipped.length === 6, "every word is either placed or reported as skipped");
// Every maximal run of 2+ letters in the grid must be exactly one answer (no accidental words).
const runs: string[] = [];
for (let r = 0; r < cw.rows; r++) { let run = ""; for (let c = 0; c <= cw.cols; c++) { const ch = cw.cells.get(`${r},${c}`); if (ch) run += ch; else { if (run.length > 1) runs.push(run); run = ""; } } }
for (let c = 0; c < cw.cols; c++) { let run = ""; for (let r = 0; r <= cw.rows; r++) { const ch = cw.cells.get(`${r},${c}`); if (ch) run += ch; else { if (run.length > 1) runs.push(run); run = ""; } } }
ok(runs.length === cw.words.length && runs.every((r) => cw.words.some((w) => w.word === r)), `no accidental words: ${runs.length} letter runs = ${cw.words.length} answers`);
ok(cw.words.slice(1).every((w) => [...w.word].some((_, i) => cw.words.some((o) => o !== w && o.across !== w.across && [...o.word].some((__, j) => o.row + (o.across ? 0 : j) === w.row + (w.across ? 0 : i) && o.col + (o.across ? j : 0) === w.col + (w.across ? i : 0))))), "every word crosses another");
ok(cw.words[0].number === 1 && cw.words.every((w, i, a) => i === 0 || w.number >= a[i - 1].number), "numbers run in reading order from 1");
const cp = crosswordPages(space, entries, 3)!;
const letters = (p: BookPage) => texts(p).filter((s) => /^[Α-Ω]$/.test(s)).length;
ok(letters(cp.puzzle) === 0 && letters(cp.answers) === cw.cells.size, "puzzle grid is empty, answers grid is filled in");
ok(texts(cp.puzzle).some((s) => s.endsWith("Γαβγίζει") || s.endsWith("Κάνει νιάου")), "clues are printed");
ok(cp.puzzle.objects.every(inSafe), "crossword stays inside the safe area");
ok(crosswordPages(space, [{ word: "ΑΒΓ", clue: "" }, { word: "ΧΨΩ", clue: "" }], 1) === null, "words with no shared letters → null");

// ---- finish the drawing
ok(JSON.stringify(clipLeft([0, 0, 100, 100], 50)) === JSON.stringify([[0, 0, 50, 50]]), "clipLeft cuts a crossing stroke exactly at the limit");
ok(clipLeft([0, 0, 100, 0, 0, 10], 50).length === 2 && clipLeft([60, 0, 90, 5], 50).length === 0, "clipLeft splits a stroke that leaves and returns; drops one fully outside");
const drawn: BookPage = { id: "d", pageNumber: 1, space, objects: [], lines: [{ id: "l", tool: "pen", strokeWidth: 4, points: [100, 300, 500, 300] }] };
const fin = finishDrawingPage(drawn, space)!;
const mirror = fin.lines.find((l) => l.style === "dashed")!;
const kept = fin.lines.filter((l) => l.strokeWidth > 1 && !l.style);
ok(Boolean(mirror) && kept.length === 1 && Math.max(...kept[0].points.filter((_, i) => i % 2 === 0)) <= mirror.points[0] + 0.01, "finish the picture: art stops at the dashed centre line");
ok(fin.lines.filter((l) => l.strokeWidth < 1).every((l) => Math.min(l.points[0], l.points[2]) >= mirror.points[0] - 0.01), "the copy grid is only on the empty half");
ok(finishDrawingPage({ ...drawn, lines: [{ id: "l", tool: "pen", strokeWidth: 4, points: [400, 300, 500, 300] }] }, space) === null, "empty left half → null");

// ---- line styles
ok(lineDash(undefined, 4) === undefined && lineDash("dashed", 4)![0] > lineDash("dotted", 4)![0], "lineDash: solid has none, dashes are longer than dots");

// ---- page numbers
const blankPage = (id: string, extra: Partial<BookPage> = {}): BookPage => ({ id, pageNumber: 0, space, objects: [], lines: [], ...extra });
const book = [blankPage("a", { isCover: true }), blankPage("b"), blankPage("c"), blankPage("d", { isBlankBack: true }), blankPage("e")];
const num = (p: BookPage) => p.objects.find((o) => o.role === "pageNumber") as (PageObject & { text: string; align: string }) | undefined;
ok(pageNumberMode(book) === "off" && syncPageNumbers(book) === book, "no numbers: mode off, sync is a no-op");
const centred = applyPageNumbers(book, "center");
ok(centred.map((p) => num(p)?.text ?? "-").join("") === "-23-5", "numbers match page position; cover and blank backs stay bare");
ok(pageNumberMode(centred) === "center" && centred.every((p) => !num(p) || (num(p)!.locked && inSafe(num(p)!))), "numbers are locked and inside the safe area");
const outer = applyPageNumbers(centred, "outer");
ok(pageNumberMode(outer) === "outer" && num(outer[1])!.align === "left" && num(outer[2])!.align === "right", "outer: even pages left, odd pages right");
const moved = syncPageNumbers([centred[0], centred[4], centred[1], centred[2], centred[3]]);
ok(moved.map((p) => num(p)?.text ?? "-").join("") === "-234-" && moved.every((p) => p.objects.filter((o) => o.role === "pageNumber").length <= 1), "after reordering, sync re-stamps without duplicating");
ok(syncPageNumbers(centred).every((p, i) => p === centred[i]), "sync leaves unchanged pages untouched (same identity)");
ok(applyPageNumbers(outer, "off").every((p) => !num(p)), "off removes every number");

// ---- repeated elements
const star: PageObject = { kind: "shape", id: "s1", shapeKind: "star", x: 40, y: 40, width: 50, height: 50, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 3 };
const withStar = book.map((p) => (p.id === "b" ? { ...p, objects: [star] } : p));
const rep = repeatOnAllPages(withStar, "b", ["s1"]);
const rid = rep[1].objects[0].repeatId!;
ok(Boolean(rid) && rep.map((p) => p.objects.filter((o) => o.repeatId === rid).length).join("") === "01101", "repeat: one copy on every page except cover and blank backs");
ok(new Set(rep.flatMap((p) => p.objects.map((o) => o.id))).size === 3 && rep[2].objects[0].x === 40, "copies get their own ids and the same position");
ok(JSON.stringify(repeatOnAllPages(rep, "b", ["s1"])) === JSON.stringify(rep), "repeating again adds nothing");
ok(removeRepeats(rep, [rid]).every((p) => p.objects.length === 0), "remove takes it off every page");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
