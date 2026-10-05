// More activity pages: sudoku, match-the-shadow, copy-in-the-grid, word
// tracing and counting. Pure functions producing ordinary, editable
// BookPages — the same contract as worksheets.ts and puzzles.ts.

import type { BookPage, LineData, PageObject, PageSpace, ShapeKind } from "@/types/editor";
import { makeId, rule, shape, text } from "@/components/editor/pageTemplates";
import { seededRandom } from "@/components/editor/worksheets";
import { geometryFromSpace } from "@/utils/pageGeometry";
import { identityT, type TFunction } from "@/lib/i18n-core";

const INK = "#111827";
const GUIDE_GRAY = "#9aa1ab";
const KID_FONT = '"Fredoka", "Comic Sans MS", cursive';
const PLAIN_FONT = "Arial, Helvetica, sans-serif";
/** Closed shapes a child can tell apart at a glance — also the "digits" of a picture sudoku. */
export const PICTURE_SHAPES: ShapeKind[] = ["circle", "star", "heart", "triangle", "hexagon", "rectangle"];

function blank(space: PageSpace, objects: PageObject[] = [], lines: LineData[] = []): BookPage {
  return { id: makeId("page"), pageNumber: 0, space, objects, lines };
}
const line = (points: number[], strokeWidth: number): LineData => ({ id: makeId("line"), tool: "pen", strokeWidth, points });
const title = (space: PageSpace, label: string, size = 38) => {
  const { safe } = geometryFromSpace(space);
  return text({ text: label, x: safe.left, y: safe.top, width: safe.right - safe.left, fontSize: size, outline: true, fontFamily: KID_FONT });
};
function shuffled<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Sudoku ----------

export type SudokuSize = 4 | 6;
export type SudokuLevel = "easy" | "medium" | "hard";
export const SUDOKU_LEVELS: { value: SudokuLevel; label: string; holes: number }[] = [
  { value: "easy", label: "Easy", holes: 0.38 },
  { value: "medium", label: "Medium", holes: 0.5 },
  { value: "hard", label: "Hard", holes: 0.62 },
];

const boxOf = (size: SudokuSize) => (size === 4 ? { rows: 2, cols: 2 } : { rows: 2, cols: 3 });

/** How many ways the grid (0 = empty) can be completed, counting up to `limit`. */
export function countSolutions(grid: number[][], size: SudokuSize, limit = 2): number {
  const box = boxOf(size);
  const g = grid.map((r) => [...r]);
  let found = 0;
  const fits = (r: number, c: number, v: number) => {
    for (let i = 0; i < size; i++) if (g[r][i] === v || g[i][c] === v) return false;
    const r0 = r - (r % box.rows);
    const c0 = c - (c % box.cols);
    for (let i = 0; i < box.rows; i++) for (let j = 0; j < box.cols; j++) if (g[r0 + i][c0 + j] === v) return false;
    return true;
  };
  const solve = (): void => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r][c]) continue;
        for (let v = 1; v <= size && found < limit; v++) {
          if (!fits(r, c, v)) continue;
          g[r][c] = v;
          solve();
          g[r][c] = 0;
        }
        return;
      }
    }
    found++;
  };
  solve();
  return found;
}

export interface Sudoku {
  size: SudokuSize;
  solution: number[][];
  /** 0 = a cell to fill in. */
  puzzle: number[][];
}

/** A full grid shuffled from the seed, then emptied cell by cell — only while the puzzle keeps exactly one solution. */
export function buildSudoku(size: SudokuSize, level: SudokuLevel, seed: number): Sudoku {
  const rand = seededRandom(seed);
  const box = boxOf(size);
  // Rows/columns may be reordered inside their band/stack, and whole bands/stacks swapped, without breaking the rules.
  const order = (groups: number, per: number) => shuffled([...Array(groups).keys()], rand).flatMap((g) => shuffled([...Array(per).keys()], rand).map((i) => g * per + i));
  const rows = order(size / box.rows, box.rows);
  const cols = order(size / box.cols, box.cols);
  const digits = shuffled([...Array(size).keys()].map((i) => i + 1), rand);
  const solution = rows.map((r) => cols.map((c) => digits[(r * box.cols + Math.floor(r / box.rows) + c) % size]));

  const puzzle = solution.map((r) => [...r]);
  const wanted = Math.round(size * size * (SUDOKU_LEVELS.find((l) => l.value === level)?.holes ?? 0.5));
  let holes = 0;
  for (const cell of shuffled([...Array(size * size).keys()], rand)) {
    if (holes >= wanted) break;
    const r = Math.floor(cell / size);
    const c = cell % size;
    const keep = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, size) === 1) holes++;
    else puzzle[r][c] = keep;
  }
  return { size, solution, puzzle };
}

export function sudokuPages(space: PageSpace, size: SudokuSize, level: SudokuLevel, pictures: boolean, seed: number, tx: TFunction = identityT): { puzzle: BookPage; answers: BookPage } {
  const sudoku = buildSudoku(size, level, seed);
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 70;
  const hintH = 50;
  const side = Math.min(width, safe.bottom - safe.top - titleH - hintH) * 0.92;
  const cell = side / size;
  const left = safe.left + (width - side) / 2;
  const top = safe.top + titleH;
  const box = boxOf(size);

  const symbol = (v: number, r: number, c: number, faint: boolean): PageObject => {
    const x = left + c * cell;
    const y = top + r * cell;
    if (pictures) {
      const pad = cell * 0.2;
      return shape({ shapeKind: PICTURE_SHAPES[v - 1], x: x + pad, y: y + pad, width: cell - pad * 2, height: cell - pad * 2, fill: "#ffffff", stroke: faint ? GUIDE_GRAY : INK, strokeWidth: 3 });
    }
    return text({ text: String(v), x, y: y + cell * 0.17, width: cell, height: cell * 0.7, fontSize: cell * 0.56, fontFamily: KID_FONT, fill: faint ? GUIDE_GRAY : INK });
  };

  const page = (label: string, solved: boolean): BookPage => {
    const objects: PageObject[] = [title(space, label)];
    const lines: LineData[] = [];
    for (let i = 0; i <= size; i++) {
      lines.push(line([left, top + i * cell, left + side, top + i * cell], i % box.rows === 0 ? 4 : 1.5));
      lines.push(line([left + i * cell, top, left + i * cell, top + side], i % box.cols === 0 ? 4 : 1.5));
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (sudoku.puzzle[r][c]) objects.push(symbol(sudoku.puzzle[r][c], r, c, false));
        else if (solved) objects.push(symbol(sudoku.solution[r][c], r, c, true));
      }
    }
    const hint = pictures ? tx("Each picture appears once in every row, column and box.") : tx("Each number from 1 to {n} appears once in every row, column and box.", { n: size });
    objects.push(text({ text: hint, x: safe.left, y: top + side + 16, width, height: 20, fontSize: 14, fontFamily: PLAIN_FONT }));
    return blank(space, objects, lines);
  };
  return { puzzle: page(tx("Sudoku"), false), answers: page(tx("Sudoku — answers"), true) };
}

// ---------- Match the shadow ----------

export type ShadowItem = { kind: "shape"; shapeKind: ShapeKind } | { kind: "picture"; src: string; shadowSrc: string; aspect: number };

/** Pictures down the left, their shadows shuffled down the right, a dot beside each to draw a line between. */
export function shadowMatchPage(space: PageSpace, items: ShadowItem[], seed: number, tx: TFunction = identityT): BookPage | null {
  const list = items.slice(0, 6);
  if (list.length < 3) return null;
  const rand = seededRandom(seed);
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 78;
  const rowH = (safe.bottom - safe.top - titleH) / list.length;
  const size = Math.min(rowH * 0.78, width * 0.3);
  // Shuffle until at least one shadow has moved (a derangement isn't needed — just not the identity).
  let order = shuffled([...list.keys()], rand);
  if (order.every((v, i) => v === i)) order = [...order.slice(1), order[0]];

  const draw = (item: ShadowItem, x: number, y: number, shadow: boolean): PageObject => {
    if (item.kind === "shape") return shape({ shapeKind: item.shapeKind, x, y, width: size, height: size, fill: shadow ? INK : "#ffffff", stroke: INK, strokeWidth: 4 });
    const w = item.aspect >= 1 ? size : size * item.aspect;
    const h = item.aspect >= 1 ? size / item.aspect : size;
    return { kind: "stamp", id: makeId("stamp"), src: shadow ? item.shadowSrc : item.src, x: x + (size - w) / 2, y: y + (size - h) / 2, width: w, height: h, rotation: 0, scaleX: 1, scaleY: 1, filter: "none" };
  };

  const objects: PageObject[] = [title(space, tx("Find the shadow!"))];
  const dot = (x: number, y: number) => shape({ shapeKind: "circle", x: x - 5, y: y - 5, width: 10, height: 10, fill: INK, stroke: INK, strokeWidth: 1 });
  list.forEach((item, i) => {
    const y = safe.top + titleH + i * rowH + (rowH - size) / 2;
    objects.push(draw(item, safe.left, y, false), dot(safe.left + size + 22, y + size / 2));
    objects.push(draw(list[order[i]], safe.right - size, y, true), dot(safe.right - size - 22, y + size / 2));
  });
  return blank(space, objects);
}

// ---------- Copy in the grid ----------

/** The picture under a grid, and an empty grid of the same size below to redraw it square by square. */
export function gridCopyPage(space: PageSpace, image: { src: string; width: number; height: number }, cells: number, tx: TFunction = identityT): BookPage {
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 62;
  const gap = 18;
  const boxH = (safe.bottom - safe.top - titleH - gap) / 2;
  const aspect = image.width / image.height;
  const w = Math.min(width, boxH * aspect);
  const h = w / aspect;
  const left = safe.left + (width - w) / 2;
  const tops = [safe.top + titleH, safe.top + titleH + boxH + gap];
  const cols = Math.max(2, Math.round(cells));
  const step = w / cols;
  // Whole squares down the picture; its bottom edge closes the grid even when the last row is cut short.
  const rows = Math.floor(h / step + 1e-6);
  const lines: LineData[] = [];
  for (const top of tops) {
    for (let c = 0; c <= cols; c++) lines.push(line([left + c * step, top, left + c * step, top + h], c === 0 || c === cols ? 2 : 0.8));
    for (let r = 0; r <= rows; r++) lines.push(line([left, top + r * step, left + w, top + r * step], r === 0 ? 2 : 0.8));
    lines.push(line([left, top + h, left + w, top + h], 2));
  }
  const picture: PageObject = { kind: "stamp", id: makeId("stamp"), src: image.src, x: left, y: tops[0], width: w, height: h, rotation: 0, scaleX: 1, scaleY: 1, filter: "none" };
  return blank(space, [title(space, tx("Draw it square by square!"), 34), picture], lines);
}

// ---------- Word tracing ----------

const WORDS_PER_PAGE = 4;

/** Each word big to colour, then a ruled handwriting row with the word in dashes to trace and room to write it. */
export function wordTracingPages(space: PageSpace, words: string[]): BookPage[] {
  const list = words.map((w) => w.trim()).filter(Boolean);
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const blockH = (safe.bottom - safe.top) / WORDS_PER_PAGE;
  const pages: BookPage[] = [];
  for (let start = 0; start < list.length; start += WORDS_PER_PAGE) {
    const objects: PageObject[] = [];
    list.slice(start, start + WORDS_PER_PAGE).forEach((word, i) => {
      const top = safe.top + i * blockH;
      const chars = [...word].length;
      // Glyphs in the kid font run about 0.62 em wide: size the word so it fits the line.
      const heroSize = Math.min(blockH * 0.36, width / (chars * 0.62));
      objects.push(text({ text: word, x: safe.left, y: top + 4, width, height: heroSize * 1.3, fontSize: heroSize, outline: true, fontFamily: KID_FONT, align: "left" }));
      const rowTop = top + blockH * 0.5;
      const letterH = blockH * 0.3;
      const fontSize = Math.min(letterH * 1.18, width / (chars * 0.62));
      const mid = rule(safe.left, rowTop + letterH / 2, width, 1);
      const topRule = rule(safe.left, rowTop, width, 1.5);
      mid.stroke = GUIDE_GRAY;
      topRule.stroke = GUIDE_GRAY;
      objects.push(topRule, mid, rule(safe.left, rowTop + letterH, width, 2.5));
      const copies = Math.max(1, Math.min(3, Math.floor(width / ((chars + 2) * fontSize * 0.62)) - 1));
      objects.push(text({ text: Array.from({ length: copies }, () => word).join("   "), x: safe.left, y: rowTop + letterH - fontSize * 1.02, width, height: fontSize * 1.4, fontSize, align: "left", fontFamily: KID_FONT, fill: GUIDE_GRAY, dashed: true }));
    });
    pages.push(blank(space, objects));
  }
  return pages;
}

// ---------- Counting ----------

export type CountingKind = "count" | "add";

export interface CountingRow {
  shapeKind: ShapeKind;
  a: number;
  /** Second group — only for sums. */
  b?: number;
}

export function countingRows(kind: CountingKind, rows: number, max: number, seed: number): CountingRow[] {
  const rand = seededRandom(seed);
  const top = Math.max(2, Math.min(10, Math.round(max)));
  const kinds = shuffled(PICTURE_SHAPES, rand);
  let last = 0;
  return Array.from({ length: rows }, (_, i) => {
    if (kind === "count") {
      let a = 1 + Math.floor(rand() * top);
      if (a === last) a = (a % top) + 1; // no two rows in a row with the same answer
      last = a;
      return { shapeKind: kinds[i % kinds.length], a };
    }
    const sum = 2 + Math.floor(rand() * (top - 1));
    const a = 1 + Math.floor(rand() * (sum - 1));
    return { shapeKind: kinds[i % kinds.length], a, b: sum - a };
  });
}

/** Rows of shapes to count (or two groups to add), each ending in an empty box for the answer. */
export function countingPage(space: PageSpace, kind: CountingKind, max: number, seed: number, tx: TFunction = identityT): BookPage {
  const rowsData = countingRows(kind, 6, max, seed);
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 74;
  const rowH = (safe.bottom - safe.top - titleH) / rowsData.length;
  const boxSize = Math.min(rowH * 0.72, 64);
  const objects: PageObject[] = [title(space, kind === "count" ? tx("How many?") : tx("Add them up!"))];
  rowsData.forEach((row, i) => {
    const cy = safe.top + titleH + i * rowH + rowH / 2;
    const total = row.a + (row.b ?? 0);
    const signs = row.b ? 2 : 1; // "+" and "=" (or just "=")
    const room = width - boxSize - 10;
    const size = Math.min(rowH * 0.6, 44, (room - signs * 34) / (total * 1.16));
    let x = safe.left;
    const group = (n: number) => {
      for (let k = 0; k < n; k++) {
        objects.push(shape({ shapeKind: row.shapeKind, x, y: cy - size / 2, width: size, height: size, fill: "#ffffff", stroke: INK, strokeWidth: 3 }));
        x += size * 1.16;
      }
    };
    const sign = (s: string) => {
      objects.push(text({ text: s, x, y: cy - 20, width: 34, height: 40, fontSize: 30, fontFamily: KID_FONT }));
      x += 34;
    };
    group(row.a);
    if (row.b) {
      sign("+");
      group(row.b);
    }
    sign("=");
    objects.push(shape({ shapeKind: "rectangle", x: safe.right - boxSize, y: cy - boxSize / 2, width: boxSize, height: boxSize, fill: "#ffffff", stroke: INK, strokeWidth: 3 }));
  });
  return blank(space, objects);
}
