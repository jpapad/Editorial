import { buildSudoku, countingPage, countingRows, countSolutions, gridCopyPage, shadowMatchPage, sudokuPages, wordTracingPages, PICTURE_SHAPES, type ShadowItem } from "../../src/components/editor/activities";
import { silhouette } from "../../src/lib/silhouette";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const inSafe = (o: PageObject) => o.x >= 35.5 && o.x + o.width * Math.abs(o.scaleX) <= 612 - 35.5 && o.y >= 35.5 && o.y + o.height <= 792 - 35.5;
const linesInSafe = (p: BookPage) => p.lines.every((l) => l.points.every((v, i) => (i % 2 === 0 ? v >= 35.5 && v <= 576.5 : v >= 35.5 && v <= 756.5)));
const texts = (p: BookPage) => p.objects.filter((o) => o.kind === "text").map((o) => (o as { text: string }).text);
const shapes = (p: BookPage) => p.objects.filter((o) => o.kind === "shape") as (PageObject & { shapeKind: string; fill: string })[];

// ---- sudoku
const valid = (g: number[][], n: number, br: number, bc: number) => {
  const full = (vals: number[]) => new Set(vals).size === n && vals.every((v) => v >= 1 && v <= n);
  for (let i = 0; i < n; i++) if (!full(g[i]) || !full(g.map((r) => r[i]))) return false;
  for (let r = 0; r < n; r += br) for (let c = 0; c < n; c += bc) if (!full(g.slice(r, r + br).flatMap((row) => row.slice(c, c + bc)))) return false;
  return true;
};
for (const [size, br, bc] of [[4, 2, 2], [6, 2, 3]] as const) {
  for (const level of ["easy", "medium", "hard"] as const) {
    const s = buildSudoku(size, level, 11 + size);
    const holes = s.puzzle.flat().filter((v) => v === 0).length;
    ok(valid(s.solution, size, br, bc) && countSolutions(s.puzzle, size) === 1 && holes > 0 && s.puzzle.every((r, i) => r.every((v, j) => v === 0 || v === s.solution[i][j])), `sudoku ${size}×${size} ${level}: valid solution, ${holes} holes, exactly one way to solve`);
  }
}
const e = buildSudoku(6, "easy", 5).puzzle.flat().filter((v) => !v).length, h = buildSudoku(6, "hard", 5).puzzle.flat().filter((v) => !v).length;
ok(h > e, `hard leaves more cells empty than easy (${h} > ${e})`);
ok(JSON.stringify(buildSudoku(6, "medium", 9)) === JSON.stringify(buildSudoku(6, "medium", 9)) && JSON.stringify(buildSudoku(6, "medium", 9).solution) !== JSON.stringify(buildSudoku(6, "medium", 10).solution), "same seed = same puzzle, new seed = new puzzle");
ok(countSolutions([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 4) === 2, "an empty grid has many solutions (the counter stops at the limit)");
const sp = sudokuPages(space, 4, "medium", false, 3);
const digits = (p: BookPage) => texts(p).filter((s) => /^\d$/.test(s)).length;
ok(digits(sp.puzzle) < 16 && digits(sp.answers) === 16, "puzzle page shows only the givens; answers page shows all 16");
ok(sp.puzzle.lines.length === 10 && sp.puzzle.lines.filter((l) => l.strokeWidth === 4).length === 6 && linesInSafe(sp.puzzle), "grid has thick lines around the 2×2 boxes and stays in the safe area");
const pic = sudokuPages(space, 6, "easy", true, 3);
ok(digits(pic.answers) === 0 && shapes(pic.answers).length === 36 && new Set(shapes(pic.answers).map((s) => s.shapeKind)).size === 6, "picture sudoku uses 6 different shapes instead of numbers");

// ---- shadows
const shapeItems: ShadowItem[] = PICTURE_SHAPES.slice(0, 5).map((shapeKind) => ({ kind: "shape", shapeKind }));
const sh = shadowMatchPage(space, shapeItems, 4)!;
const pics = shapes(sh).filter((s) => s.shapeKind !== "circle" || s.width > 12);
const left = pics.filter((s) => s.x < 200), right = pics.filter((s) => s.x > 300);
ok(left.length === 5 && right.length === 5 && left.every((s) => s.fill === "#ffffff") && right.every((s) => s.fill === "#111827"), "5 outlined pictures on the left, 5 solid shadows on the right");
ok(left.map((s) => s.shapeKind).sort().join() === right.map((s) => s.shapeKind).sort().join() && left.some((s, i) => s.shapeKind !== right[i].shapeKind), "every picture has its shadow, and the order is mixed up");
ok(shapes(sh).filter((s) => s.width === 10).length === 10 && sh.objects.every(inSafe), "a dot beside each to join; everything inside the safe area");
ok(shadowMatchPage(space, shapeItems.slice(0, 2), 1) === null, "fewer than 3 pictures → null");
const pictureItems: ShadowItem[] = [1, 2, 0.5].map((aspect, i) => ({ kind: "picture", src: "src" + i, shadowSrc: "shadow" + i, aspect }));
const ps = shadowMatchPage(space, pictureItems, 2)!.objects.filter((o) => o.kind === "stamp") as (PageObject & { src: string })[];
ok(ps.filter((o) => o.src.startsWith("src")).length === 3 && ps.filter((o) => o.src.startsWith("shadow")).length === 3 && Math.abs(ps.find((o) => o.src === "src1")!.width / ps.find((o) => o.src === "src1")!.height - 2) < 0.01, "own pictures: each appears with its shadow, keeping its proportions");

// ---- silhouette: a hollow square outline becomes a solid square
const W = 20, data = new Uint8ClampedArray(W * W * 4);
for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) if (x === 5 || x === 14 || y === 5 || y === 14) data[(y * W + x) * 4 + 3] = 255;
const sil = silhouette({ width: W, height: W, data });
const alpha = (x: number, y: number) => sil.data[(y * W + x) * 4 + 3];
ok(alpha(10, 10) === 255 && alpha(5, 5) === 255 && alpha(2, 2) === 0 && alpha(16, 10) === 0, "silhouette fills the inside of an outline, leaves the outside clear");

// ---- grid copy
const gc = gridCopyPage(space, { src: "data:x", width: 612, height: 792 }, 6);
const stamp = gc.objects.find((o) => o.kind === "stamp")!;
ok(Math.abs(stamp.width / stamp.height - 612 / 792) < 0.01 && inSafe(stamp) && linesInSafe(gc), "picture keeps its proportions and the page stays in the safe area");
const vertical = gc.lines.filter((l) => l.points[0] === l.points[2]);
ok(vertical.length === 14 && gc.lines.length % 2 === 0, "two grids with the same number of squares (6 across → 7 lines each)");
const ysTop = Math.min(...gc.lines.map((l) => l.points[1])), firstGridBottom = stamp.y + stamp.height;
ok(Math.abs(ysTop - stamp.y) < 0.01 && gc.lines.some((l) => l.points[1] > firstGridBottom + 5), "first grid lies over the picture, the second is below it");

// ---- word tracing
const wt = wordTracingPages(space, ["γάτα", "σκύλος", " ", "άλογο", "πάπια", "πρόβατο"]);
ok(wt.length === 2 && wt[0].objects.filter((o) => o.kind === "text" && (o as { outline?: boolean; text: string }).outline && (o as { text: string }).text === "γάτα").length === 1 && texts(wt[1]).includes("πρόβατο"), "5 words → 2 pages (4 per page), words kept as typed, blanks skipped");
const dashed = wt[0].objects.filter((o) => o.kind === "text" && (o as { dashed?: boolean }).dashed) as (PageObject & { text: string })[];
ok(dashed.length === 4 && dashed[0].text.startsWith("γάτα") && wt[0].objects.filter((o) => o.kind === "shape").length === 12, "each word has a dashed copy to trace on a 3-line ruled row");
ok(wt.every((p) => p.objects.every(inSafe)) && wordTracingPages(space, []).length === 0, "inside the safe area; no words → no pages");
const long = wordTracingPages(space, ["ηλεκτροεγκεφαλογράφημα"])[0].objects[0] as PageObject & { fontSize: number };
ok(long.fontSize * 22 * 0.62 <= 540.5, "a very long word is shrunk to fit the line");

// ---- counting
const rows = countingRows("count", 6, 6, 3);
ok(rows.length === 6 && rows.every((r) => r.a >= 1 && r.a <= 6 && r.b === undefined) && rows.every((r, i) => i === 0 || r.a !== rows[i - 1].a), "count: 6 rows of 1–6, neighbours never equal");
const sums = countingRows("add", 6, 8, 3);
ok(sums.every((r) => r.a >= 1 && r.b! >= 1 && r.a + r.b! <= 8), "add: two groups of at least 1, sum within the limit");
const cp = countingPage(space, "add", 10, 7);
const boxes = shapes(cp).filter((s) => s.shapeKind === "rectangle" && s.x > 480);
ok(boxes.length === 6 && texts(cp).filter((s) => s === "+").length === 6 && texts(cp).filter((s) => s === "=").length === 6, "every sum row has +, = and an answer box");
ok(cp.objects.every(inSafe) && shapes(cp).filter((s) => s.x <= 480).every((s) => s.x + s.width < boxes[0].x), "shapes never run into the answer box, even at 10");
ok(texts(countingPage(space, "count", 5, 1)).filter((s) => s === "+").length === 0, "counting rows have no plus sign");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
