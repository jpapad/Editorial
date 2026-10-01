// Activity-book puzzle pages: word search, crossword and "finish the
// drawing". Like worksheets.ts, pure functions that produce ordinary,
// editable BookPages. The grid builders are separate from the page layout
// so they can be tested on their own.

import type { BookPage, LineData, PageObject, PageSpace } from "@/types/editor";
import { makeId, shape, text } from "@/components/editor/pageTemplates";
import { seededRandom } from "@/components/editor/worksheets";
import { geometryFromSpace } from "@/utils/pageGeometry";
import { identityT, type TFunction } from "@/lib/i18n-core";

const INK = "#111827";
const KID_FONT = '"Fredoka", "Comic Sans MS", cursive';
const GRID_FONT = "Arial, Helvetica, sans-serif";
const GREEK = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function blank(space: PageSpace, objects: PageObject[] = [], lines: LineData[] = []): BookPage {
  return { id: makeId("page"), pageNumber: 0, space, objects, lines };
}

/** Upper case, accents removed (ΓΆΤΑ → ΓΑΤΑ), letters only — how a word sits in a puzzle grid. */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleUpperCase("el")
    .replace(/[^\p{L}]/gu, "");
}

const alphabetFor = (words: string[]) => (words.some((w) => /[Ͱ-Ͽ]/.test(w)) ? GREEK : LATIN);

// ---------- Word search ----------

export interface WordPlacement {
  word: string;
  row: number;
  col: number;
  dRow: number;
  dCol: number;
}

export interface WordGrid {
  size: number;
  grid: string[][];
  placements: WordPlacement[];
  /** Words that didn't fit (too long, or no free spot). */
  skipped: string[];
}

/** Words run left→right, top→bottom or diagonally down-right — the directions young readers can follow. */
const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
];

export function buildWordGrid(rawWords: string[], size: number, seed: number): WordGrid {
  const rand = seededRandom(seed);
  const words = [...new Set(rawWords.map(normalizeWord).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length);
  const grid: string[][] = Array.from({ length: size }, () => Array<string>(size).fill(""));
  const placements: WordPlacement[] = [];
  const skipped: string[] = [];

  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const [dRow, dCol] = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)];
      const maxRow = size - (dRow ? word.length : 1);
      const maxCol = size - (dCol ? word.length : 1);
      if (maxRow < 0 || maxCol < 0) break;
      const row = Math.floor(rand() * (maxRow + 1));
      const col = Math.floor(rand() * (maxCol + 1));
      const fits = [...word].every((ch, i) => {
        const cell = grid[row + dRow * i][col + dCol * i];
        return cell === "" || cell === ch;
      });
      if (!fits) continue;
      [...word].forEach((ch, i) => (grid[row + dRow * i][col + dCol * i] = ch));
      placements.push({ word, row, col, dRow, dCol });
      placed = true;
    }
    if (!placed) skipped.push(word);
  }

  const alphabet = alphabetFor(words);
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = alphabet[Math.floor(rand() * alphabet.length)];
  return { size, grid, placements, skipped };
}

export interface PuzzlePages {
  puzzle: BookPage;
  answers: BookPage;
  /** Words left out because they didn't fit. */
  skipped: string[];
}

export function wordSearchPages(space: PageSpace, rawWords: string[], seed: number, tx: TFunction = identityT): PuzzlePages | null {
  const words = rawWords.map(normalizeWord).filter((w) => w.length >= 2);
  if (words.length === 0) return null;
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.min(16, Math.max(10, longest + 1, Math.ceil(Math.sqrt(words.join("").length * 1.8))));
  const built = buildWordGrid(words, size, seed);
  if (built.placements.length === 0) return null;

  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 64;
  const listRows = Math.ceil(built.placements.length / 3);
  const listH = listRows * 24 + 16;
  const side = Math.min(width, safe.bottom - safe.top - titleH - listH);
  const cell = side / size;
  const left = safe.left + (width - side) / 2;
  const top = safe.top + titleH;

  const page = (title: string, withAnswers: boolean): BookPage => {
    const objects: PageObject[] = [
      text({ text: title, x: safe.left, y: safe.top, width, fontSize: 38, outline: true, fontFamily: KID_FONT }),
      shape({ shapeKind: "rectangle", x: left, y: top, width: side, height: side, fill: "#ffffff", stroke: INK, strokeWidth: 2.5 }),
    ];
    built.grid.forEach((row, r) =>
      row.forEach((ch, c) => objects.push(text({ text: ch, x: left + c * cell, y: top + r * cell + cell * 0.16, width: cell, height: cell * 0.7, fontSize: cell * 0.56, fontFamily: GRID_FONT })))
    );
    const colW = width / 3;
    [...built.placements]
      .sort((a, b) => a.word.localeCompare(b.word, "el"))
      .forEach((p, i) => objects.push(text({ text: p.word, x: safe.left + (i % 3) * colW, y: top + side + 14 + Math.floor(i / 3) * 24, width: colW, height: 20, fontSize: 15, fontFamily: GRID_FONT })));
    const lines: LineData[] = withAnswers
      ? built.placements.map((p) => {
          const end = p.word.length - 1;
          const cx = (c: number) => left + (c + 0.5) * cell;
          const cy = (r: number) => top + (r + 0.5) * cell;
          return { id: makeId("line"), tool: "pen" as const, strokeWidth: 2.5, points: [cx(p.col), cy(p.row), cx(p.col + p.dCol * end), cy(p.row + p.dRow * end)] };
        })
      : [];
    return blank(space, objects, lines);
  };

  return { puzzle: page(tx("Word search"), false), answers: page(tx("Word search — answers"), true), skipped: built.skipped };
}

// ---------- Crossword ----------

export interface CrosswordEntry {
  word: string;
  clue: string;
}

export interface CrosswordWord extends CrosswordEntry {
  row: number;
  col: number;
  across: boolean;
  number: number;
}

export interface Crossword {
  rows: number;
  cols: number;
  /** "row,col" → letter */
  cells: Map<string, string>;
  words: CrosswordWord[];
  skipped: string[];
}

const MAX_CROSSWORD_SPAN = 15;
const key = (r: number, c: number) => `${r},${c}`;

/**
 * Greedy crossword: longest word first, then each word where it crosses
 * the most letters already down. A word never touches another alongside
 * it, so every run of letters in the grid is exactly one answer.
 */
export function buildCrossword(entries: CrosswordEntry[], seed: number): Crossword {
  const rand = seededRandom(seed);
  const list = entries
    .map((e) => ({ word: normalizeWord(e.word), clue: e.clue.trim() }))
    .filter((e, i, all) => e.word.length >= 2 && all.findIndex((o) => o.word === e.word) === i)
    .sort((a, b) => b.word.length - a.word.length);
  // Where a word goes decides which later words still fit, so lay the grid
  // out several ways and keep the one that uses the most words (then the most compact).
  let best: Crossword | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const order = attempt === 0 ? list : [...list].sort(() => rand() - 0.5);
    const candidate = layoutCrossword(order, rand);
    if (!best || candidate.words.length > best.words.length || (candidate.words.length === best.words.length && candidate.rows * candidate.cols < best.rows * best.cols)) best = candidate;
    if (best.skipped.length === 0 && attempt >= 8) break;
  }
  return best!;
}

function layoutCrossword(list: CrosswordEntry[], rand: () => number): Crossword {
  if (list.length === 0) return { rows: 0, cols: 0, cells: new Map(), words: [], skipped: [] };
  const cells = new Map<string, string>();
  const placed: { word: string; clue: string; row: number; col: number; across: boolean }[] = [];
  const skipped: string[] = [];

  const bounds = () => {
    const rs = [...cells.keys()].map((k) => Number(k.split(",")[0]));
    const cs = [...cells.keys()].map((k) => Number(k.split(",")[1]));
    return { minR: Math.min(...rs), maxR: Math.max(...rs), minC: Math.min(...cs), maxC: Math.max(...cs) };
  };

  /** Crossings made by placing `word` there, or -1 if it's not allowed. */
  const score = (word: string, row: number, col: number, across: boolean): number => {
    const dr = across ? 0 : 1;
    const dc = across ? 1 : 0;
    if (cells.has(key(row - dr, col - dc)) || cells.has(key(row + dr * word.length, col + dc * word.length))) return -1;
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = cells.get(key(r, c));
      if (existing) {
        if (existing !== word[i]) return -1;
        // Must be a real crossing: the existing letter belongs to a perpendicular word.
        if (placed.some((p) => p.across === across && (across ? p.row === r && c >= p.col && c < p.col + p.word.length : p.col === c && r >= p.row && r < p.row + p.word.length))) return -1;
        crossings++;
      } else if (cells.has(key(r + dc, c + dr)) || cells.has(key(r - dc, c - dr))) {
        return -1; // would run alongside another word
      }
    }
    if (cells.size > 0) {
      const b = bounds();
      const rows = Math.max(b.maxR, row + dr * (word.length - 1)) - Math.min(b.minR, row) + 1;
      const cols = Math.max(b.maxC, col + dc * (word.length - 1)) - Math.min(b.minC, col) + 1;
      if (rows > MAX_CROSSWORD_SPAN || cols > MAX_CROSSWORD_SPAN) return -1;
    }
    return crossings;
  };

  const put = (e: { word: string; clue: string }, row: number, col: number, across: boolean) => {
    [...e.word].forEach((ch, i) => cells.set(key(row + (across ? 0 : i), col + (across ? i : 0)), ch));
    placed.push({ ...e, row, col, across });
  };

  let queue = list.filter((e) => e.word.length <= MAX_CROSSWORD_SPAN);
  skipped.push(...list.filter((e) => e.word.length > MAX_CROSSWORD_SPAN).map((e) => e.word));
  if (queue.length) put(queue.shift()!, 0, 0, true);
  // Words that can't cross anything yet get another chance once more letters are down.
  for (let pass = 0; pass < 3 && queue.length; pass++) {
    const next: typeof queue = [];
    for (const e of queue) {
      let best: { row: number; col: number; across: boolean; score: number } | null = null;
      for (const p of placed) {
        for (let i = 0; i < p.word.length; i++) {
          for (let j = 0; j < e.word.length; j++) {
            if (p.word[i] !== e.word[j]) continue;
            const across = !p.across;
            const row = p.across ? p.row - j : p.row + i;
            const col = p.across ? p.col + i : p.col - j;
            const s = score(e.word, row, col, across);
            if (s > 0 && (!best || s > best.score || (s === best.score && rand() < 0.4))) best = { row, col, across, score: s };
          }
        }
      }
      if (best) put(e, best.row, best.col, best.across);
      else next.push(e);
    }
    queue = next;
  }
  skipped.push(...queue.map((e) => e.word));

  // Shift so the grid starts at 0,0, then number the starts in reading order.
  const b = bounds();
  const shifted = new Map<string, string>();
  for (const [k, v] of cells) {
    const [r, c] = k.split(",").map(Number);
    shifted.set(key(r - b.minR, c - b.minC), v);
  }
  const moved = placed.map((p) => ({ ...p, row: p.row - b.minR, col: p.col - b.minC }));
  const starts = [...new Set(moved.map((p) => key(p.row, p.col)))].sort((x, y) => {
    const [xr, xc] = x.split(",").map(Number);
    const [yr, yc] = y.split(",").map(Number);
    return xr - yr || xc - yc;
  });
  const words = moved.map((p) => ({ ...p, number: starts.indexOf(key(p.row, p.col)) + 1 })).sort((x, y) => x.number - y.number);
  return { rows: b.maxR - b.minR + 1, cols: b.maxC - b.minC + 1, cells: shifted, words, skipped };
}

export function crosswordPages(space: PageSpace, entries: CrosswordEntry[], seed: number, tx: TFunction = identityT): PuzzlePages | null {
  const cw = buildCrossword(entries, seed);
  if (cw.words.length < 2) return null;
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 64;
  const across = cw.words.filter((w) => w.across);
  const down = cw.words.filter((w) => !w.across);
  const clueH = (Math.max(across.length, down.length) + 1) * 20 + 14;
  const cell = Math.min(52, width / cw.cols, (safe.bottom - safe.top - titleH - clueH) / cw.rows);
  const left = safe.left + (width - cell * cw.cols) / 2;
  const top = safe.top + titleH;

  const page = (title: string, withAnswers: boolean): BookPage => {
    const objects: PageObject[] = [text({ text: title, x: safe.left, y: safe.top, width, fontSize: 38, outline: true, fontFamily: KID_FONT })];
    for (const [k, letter] of cw.cells) {
      const [r, c] = k.split(",").map(Number);
      objects.push(shape({ shapeKind: "rectangle", x: left + c * cell, y: top + r * cell, width: cell, height: cell, fill: "#ffffff", stroke: INK, strokeWidth: 1.5 }));
      if (withAnswers) objects.push(text({ text: letter, x: left + c * cell, y: top + r * cell + cell * 0.2, width: cell, height: cell * 0.7, fontSize: cell * 0.52, fontFamily: GRID_FONT }));
    }
    for (const start of new Map(cw.words.map((w) => [w.number, w])).values()) {
      objects.push(text({ text: String(start.number), x: left + start.col * cell + 2.5, y: top + start.row * cell + 1.5, width: cell * 0.5, height: cell * 0.32, fontSize: Math.max(7, cell * 0.24), fontFamily: GRID_FONT, align: "left" }));
    }
    const clueTop = top + cw.rows * cell + 14;
    const colW = width / 2 - 8;
    const column = (heading: string, list: typeof cw.words, x: number) => {
      objects.push(text({ text: heading, x, y: clueTop, width: colW, height: 18, fontSize: 14, fontFamily: KID_FONT, align: "left" }));
      list.forEach((w, i) =>
        objects.push(text({ text: `${w.number}. ${w.clue || tx("{n} letters", { n: w.word.length })}`, x, y: clueTop + 20 + i * 20, width: colW, height: 16, fontSize: 11.5, fontFamily: GRID_FONT, align: "left" }))
      );
    };
    column(tx("Across"), across, safe.left);
    column(tx("Down"), down, safe.left + colW + 16);
    return blank(space, objects);
  };

  return { puzzle: page(tx("Crossword"), false), answers: page(tx("Crossword — answers"), true), skipped: cw.skipped };
}

// ---------- Finish the drawing ----------

/** The part of a polyline with x ≤ `limit`, cut exactly at the limit — may split into several strokes. */
export function clipLeft(points: number[], limit: number): number[][] {
  const out: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    const inside = x <= limit;
    if (i > 0) {
      const px = points[i - 2];
      const py = points[i - 1];
      if (px <= limit !== inside) {
        const t = (limit - px) / (x - px);
        const iy = py + (y - py) * t;
        if (inside) current = [limit, iy];
        else {
          current.push(limit, iy);
          if (current.length >= 4) out.push(current);
          current = [];
        }
      }
    }
    if (inside) current.push(x, y);
  }
  if (current.length >= 4) out.push(current);
  return out;
}

/**
 * "Finish the picture": the left half of `source` (cut at the page's
 * vertical centre) with a dashed mirror line and a light grid on the
 * empty half to copy onto. Best for drawings made with the Mirror tool.
 * Null when the left half is empty.
 */
export function finishDrawingPage(source: BookPage, space: PageSpace, tx: TFunction = identityT): BookPage | null {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const titleH = 60;
  const src = source.space ? geometryFromSpace(source.space).trim : geo.trim;
  const srcW = src.right - src.left;
  const srcH = src.bottom - src.top;
  const availH = safe.bottom - safe.top - titleH;
  const k = Math.min(width / srcW, availH / srcH);
  const offX = safe.left + (width - srcW * k) / 2 - src.left * k;
  const offY = safe.top + titleH + (availH - srcH * k) / 2 - src.top * k;
  const srcCenter = (src.left + src.right) / 2;
  const centerX = offX + srcCenter * k;
  const top = offY + src.top * k;
  const bottom = offY + src.bottom * k;

  const lines: LineData[] = source.lines.flatMap((l) =>
    clipLeft(l.points, srcCenter).map((pts) => ({ ...l, id: makeId("line"), strokeWidth: l.strokeWidth * k, points: pts.map((v, i) => (i % 2 === 0 ? offX + v * k : offY + v * k)) }))
  );
  // Objects can't be cut in half: keep the ones whose centre is on the left.
  const objects: PageObject[] = source.objects
    .filter((o) => !o.hidden && !(o.kind === "stamp" && o.isFrame) && o.x + (o.width * o.scaleX) / 2 <= srcCenter)
    .map((o) => ({ ...o, id: makeId(o.kind), x: offX + o.x * k, y: offY + o.y * k, scaleX: o.scaleX * k, scaleY: o.scaleY * k, locked: false, groupId: undefined }));
  if (lines.filter((l) => l.tool === "pen").length === 0 && objects.length === 0) return null;

  const guides: LineData[] = [];
  const step = Math.max(24, ((offX + src.right * k - centerX) / 6) | 0);
  for (let x = centerX + step; x <= offX + src.right * k + 0.5; x += step) guides.push({ id: makeId("line"), tool: "pen", strokeWidth: 0.6, points: [x, top, x, bottom] });
  for (let y = top; y <= bottom + 0.5; y += step) guides.push({ id: makeId("line"), tool: "pen", strokeWidth: 0.6, points: [centerX, y, offX + src.right * k, y] });
  const mirror: LineData = { id: makeId("line"), tool: "pen", strokeWidth: 2, style: "dashed", points: [centerX, top, centerX, bottom] };

  const title = text({ text: tx("Finish the picture!"), x: safe.left, y: safe.top, width, fontSize: 38, outline: true, fontFamily: KID_FONT });
  return blank(space, [title, ...objects], [...guides, mirror, ...lines]);
}
