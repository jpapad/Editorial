// Worksheet page generators for teachers and parents: letter and number
// tracing, connect-the-dots, mazes and spot-the-difference. Pure functions
// producing ordinary BookPages (text, shapes and pen lines), laid out from
// the book's real geometry — so everything stays editable afterwards.

import type { BookPage, LineData, PageObject, PageSpace, ShapeData } from "@/types/editor";
import { makeId, rule, shape, text } from "@/components/editor/pageTemplates";
import { polygonPoints } from "@/components/editor/shapeGeometry";
import { hasStrokes, LETTER_STROKES, sampleStroke, type StrokeGlyph } from "@/components/editor/letterStrokes";
import { flippedHorizontally, objectBounds } from "@/utils/objectGeometry";
import { geometryFromSpace, type Rect } from "@/utils/pageGeometry";
import { identityT, type TFunction } from "@/lib/i18n-core";

const INK = "#111827";
const GUIDE_GRAY = "#9aa1ab";
const KID_FONT = '"Fredoka", "Comic Sans MS", cursive';

function blank(space: PageSpace, objects: PageObject[] = [], lines: LineData[] = []): BookPage {
  return { id: makeId("page"), pageNumber: 0, space, objects, lines };
}

function line(points: number[], strokeWidth = 4): LineData {
  return { id: makeId("line"), tool: "pen", strokeWidth, points };
}

/** Deterministic PRNG (mulberry32) — the same seed rebuilds the same maze / differences. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Tracing ----------

/** One handwriting row's three guide lines: top and midline in gray, baseline in ink. */
function guideRules(left: number, top: number, width: number, letterHeight: number): ShapeData[] {
  const topRule = rule(left, top, width, 1.5);
  const mid = rule(left, top + letterHeight / 2, width, 1);
  topRule.stroke = GUIDE_GRAY;
  mid.stroke = GUIDE_GRAY;
  return [topRule, mid, rule(left, top + letterHeight, width, 2.5)];
}

/** Three-line handwriting rows (top, dashed-looking mid in gray, baseline) with dashed glyphs to trace. */
function tracingRows(glyph: string, area: Rect, rows: number): PageObject[] {
  const out: PageObject[] = [];
  const width = area.right - area.left;
  const rowHeight = (area.bottom - area.top) / rows;
  const letterHeight = rowHeight * 0.62;
  const fontSize = letterHeight * 1.18;
  // A glyph plus its separating space runs a little over one em in the kid font; stay under it so the row never wraps.
  const perRow = Math.max(3, Math.floor(width / (fontSize * 1.05)));
  for (let r = 0; r < rows; r++) {
    const top = area.top + r * rowHeight + rowHeight * 0.12;
    out.push(...guideRules(area.left, top, width, letterHeight));
    const glyphs = Array.from({ length: perRow }, () => glyph).join(" ");
    out.push(
      text({
        text: glyphs,
        x: area.left,
        y: top - letterHeight * 0.18,
        width,
        fontSize,
        height: letterHeight * 1.4,
        align: "left",
        fontFamily: KID_FONT,
        fill: GUIDE_GRAY,
        dashed: true,
      })
    );
  }
  return out;
}

/** A letter's strokes as dotted pen lines along their centre; the letter is `h` tall from the top line at `top`. */
function dottedLetter(glyph: StrokeGlyph, x: number, top: number, h: number): { lines: LineData[]; objects: PageObject[] } {
  const dot = Math.max(2.5, h * 0.065);
  const lines = glyph.strokes.map((s) => ({ ...line(sampleStroke(s).map((v, i) => (i % 2 ? top + v * h : x + v * h)), dot), style: "dotted" as const }));
  const r = Math.max(3, h * 0.05);
  const objects = (glyph.dots ?? []).map(([dx, dy]) => shape({ shapeKind: "circle", x: x + dx * h - r, y: top + dy * h - r, width: 2 * r, height: 2 * r, strokeWidth: dot * 0.6 }));
  return { lines, objects };
}

type Pt = { x: number; y: number };

/** What stroke-order marks keep clear of: dots and arrow points, and the number circles already placed (radius `r`). */
interface Obstacles {
  points: Pt[];
  discs: Pt[];
}

/** Every sampled point of a letter's strokes, on the page. */
function letterPoints(glyph: StrokeGlyph, x: number, top: number, h: number): Pt[] {
  return glyph.strokes.flatMap((s) => {
    const pts = sampleStroke(s);
    return pts.flatMap((v, i) => (i % 2 ? [] : [{ x: x + v * h, y: top + pts[i + 1] * h }]));
  });
}

const nearest = (list: Pt[], p: Pt) => list.reduce((best, o) => Math.min(best, Math.hypot(o.x - p.x, o.y - p.y)), Infinity);

/**
 * Stroke order: a numbered circle beside where each stroke starts and an
 * arrow showing which way to go. Both sit just off the dotted line — pen
 * lines draw above objects, so a number on the line itself would be covered
 * by its dots — on whichever side, slid a little along the stroke if need
 * be, keeps them clearest of the pair's letters and of the marks already
 * placed (each mark is added to `obstacles`).
 */
function strokeOrderMarks(glyph: StrokeGlyph, x: number, top: number, h: number, obstacles: Obstacles): PageObject[] {
  const toPage = (ux: number, uy: number): Pt => ({ x: x + ux * h, y: top + uy * h });
  const strokes = glyph.strokes.map((s) => sampleStroke(s));
  const r = Math.max(5, h * 0.085);
  // How much room is left around a point that is itself `size` wide (a circle's radius, or 0 for a point of an arrow).
  const clearance = (p: Pt, size: number) => Math.min(nearest(obstacles.points, p) - size, nearest(obstacles.discs, p) - r - size);
  const fontSize = r * 1.35;
  const arrowLength = Math.max(22, h * 0.42);
  // Centre of the number circle from the stroke: its radius, the dot's radius (dottedLetter) and a small gap.
  const offset = r + Math.max(2.5, h * 0.065) / 2 + r * 0.4;
  const out: PageObject[] = [];
  const marker = (n: number, at: Pt) => {
    out.push(
      shape({ shapeKind: "circle", x: at.x - r, y: at.y - r, width: 2 * r, height: 2 * r, fill: INK, stroke: INK, strokeWidth: 1 }),
      text({ text: String(n), x: at.x - r, y: at.y - fontSize * 0.5, width: 2 * r, fontSize, fill: "#ffffff", fontFamily: KID_FONT })
    );
  };
  strokes.forEach((pts, k) => {
    // Direction from the start to a point a little way along the stroke.
    let j = 2;
    while (j < pts.length - 2 && Math.hypot(pts[j] - pts[0], pts[j + 1] - pts[1]) < 0.12) j += 2;
    const theta = Math.atan2(pts[j + 1] - pts[1], pts[j] - pts[0]);
    const dir = { x: Math.cos(theta), y: Math.sin(theta) };
    const start = toPage(pts[0], pts[1]);
    const arrowPoints = (at: Pt) => Array.from({ length: 7 }, (_, i) => ({ x: at.x + dir.x * (r * 1.5 + (arrowLength * i) / 6), y: at.y + dir.y * (r * 1.5 + (arrowLength * i) / 6) }));
    let best = { at: start, score: -Infinity };
    for (const side of [1, -1])
      for (let slide = -2; slide < 4; slide++) {
        const at = { x: start.x - dir.y * side * offset + dir.x * slide * r * 1.2, y: start.y + dir.x * side * offset + dir.y * slide * r * 1.2 };
        // How close the circle's edge and the arrow come to anything; sliding away from the start costs a little.
        const score = Math.min(clearance(at, r), ...arrowPoints(at).map((p) => clearance(p, 0))) - Math.abs(slide) * h * 0.02;
        if (score > best.score) best = { at, score };
      }
    const at = best.at;
    marker(k + 1, at);
    // Later marks keep clear of this one.
    obstacles.discs.push(at);
    obstacles.points.push(...arrowPoints(at));
    // The arrow starts just past the number and runs the way the stroke goes.
    const from = { x: at.x + dir.x * r * 1.5, y: at.y + dir.y * r * 1.5 };
    const boxHeight = 10;
    out.push(
      shape({
        shapeKind: "arrow",
        // An open stroke runs from (0, height/2) to (width, height/2) of its box, rotated about the box's corner.
        x: from.x + (boxHeight / 2) * Math.sin(theta),
        y: from.y - (boxHeight / 2) * Math.cos(theta),
        width: arrowLength,
        height: boxHeight,
        rotation: (theta * 180) / Math.PI,
        fill: "transparent",
        strokeWidth: Math.max(1.5, h * 0.025),
      })
    );
  });
  (glyph.dots ?? []).forEach(([dx, dy], k) => {
    const at = toPage(dx - 0.15, dy - 0.05);
    marker(strokes.length + k + 1, at);
    obstacles.discs.push(at);
  });
  return out;
}

/**
 * Like a printed handwriting book: the letter pair big and hollow to color,
 * then two rows of dotted letters to trace (the first pair numbered with
 * arrows for the stroke order) and two empty rows to write on. Letters
 * without stroke data (Greek, for now) keep the font-traced layout.
 */
export function letterTracingPage(space: PageSpace, letter: string): BookPage {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const upper = letter.toLocaleUpperCase();
  const lower = letter.toLocaleLowerCase();
  const pair = upper === lower ? upper : `${upper}${lower}`;
  if (hasStrokes(upper) && hasStrokes(lower) && upper !== lower) return strokeTracingPage(space, upper, lower);
  const heroHeight = (safe.bottom - safe.top) * 0.32;
  return blank(space, [
    text({ text: pair, x: safe.left, y: safe.top, width, fontSize: heroHeight * 0.9, height: heroHeight, outline: true, fontFamily: KID_FONT }),
    ...tracingRows(upper, { ...safe, top: safe.top + heroHeight + 10, bottom: safe.top + heroHeight + 10 + (safe.bottom - safe.top - heroHeight) / 2 }, 2),
    ...(upper === lower ? [] : tracingRows(lower, { ...safe, top: safe.top + heroHeight + 10 + (safe.bottom - safe.top - heroHeight) / 2 }, 2)),
  ]);
}

function strokeTracingPage(space: PageSpace, upper: string, lower: string): BookPage {
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const heroHeight = (safe.bottom - safe.top) * 0.28;
  const rowsTop = safe.top + heroHeight + 10;
  const rows = 4;
  const rowHeight = (safe.bottom - rowsTop) / rows;
  const h = rowHeight * 0.62;
  const big = LETTER_STROKES[upper];
  const small = LETTER_STROKES[lower];
  // In letter heights: the gap inside a pair (room for the stroke-order arrows between the two) and between pairs.
  const inner = 0.45;
  const between = 0.7;
  const pairWidth = big.w + inner + small.w;
  const perRow = Math.max(1, Math.floor((width + between * h) / ((pairWidth + between) * h)));
  const rowWidth = perRow * pairWidth * h + (perRow - 1) * between * h;
  const left = safe.left + (width - rowWidth) / 2;

  const objects: PageObject[] = [text({ text: `${upper}${lower}`, x: safe.left, y: safe.top, width, fontSize: heroHeight * 0.9, height: heroHeight, outline: true, fontFamily: KID_FONT })];
  const lines: LineData[] = [];
  for (let r = 0; r < rows; r++) {
    const top = rowsTop + r * rowHeight + rowHeight * 0.12;
    objects.push(...guideRules(safe.left, top, width, h));
    if (r >= 2) continue; // the last two rows are left empty to write on
    for (let c = 0; c < perRow; c++) {
      const x = left + c * (pairWidth + between) * h;
      const pair = [[big, x], [small, x + (big.w + inner) * h]] as const;
      // The first pair shows the stroke order; its marks keep clear of both letters and of each other.
      const obstacles = r === 0 && c === 0 ? { points: pair.flatMap(([glyph, gx]) => letterPoints(glyph, gx, top, h)), discs: [] } : null;
      for (const [glyph, gx] of pair) {
        const letter = dottedLetter(glyph, gx, top, h);
        lines.push(...letter.lines);
        objects.push(...letter.objects);
        if (obstacles) objects.push(...strokeOrderMarks(glyph, gx, top, h, obstacles));
      }
    }
  }
  return blank(space, objects, lines);
}

export function numberTracingPage(space: PageSpace, n: number): BookPage {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const heroHeight = (safe.bottom - safe.top) * 0.26;
  // n circles to color, in rows of up to 5
  const count = Math.min(n, 20);
  const perRow = 5;
  const d = Math.min(46, width / (perRow * 1.5));
  const dotsTop = safe.top + heroHeight + 6;
  const dots = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.min(perRow, count - row * perRow);
    const rowWidth = rowCount * d * 1.5 - d * 0.5;
    return shape({ shapeKind: "circle", x: safe.left + (width - rowWidth) / 2 + col * d * 1.5, y: dotsTop + row * d * 1.3, width: d, height: d });
  });
  const dotRows = Math.ceil(count / perRow);
  const rowsTop = dotsTop + Math.max(1, dotRows) * d * 1.3 + 16;
  return blank(space, [
    text({ text: String(n), x: safe.left, y: safe.top, width, fontSize: heroHeight * 0.95, height: heroHeight, outline: true, fontFamily: KID_FONT }),
    ...dots,
    ...tracingRows(String(n), { ...safe, top: rowsTop }, 3),
  ]);
}

// ---------- Connect the dots ----------

export type DotsDesign = "star" | "heart" | "house" | "fish" | "butterfly";

export const DOTS_DESIGNS: { value: DotsDesign; label: string }[] = [
  { value: "star", label: "Star" },
  { value: "heart", label: "Heart" },
  { value: "house", label: "House" },
  { value: "fish", label: "Fish" },
  { value: "butterfly", label: "Butterfly" },
];

/** Closed outlines in a unit box, clockwise from the top. */
function designOutline(design: DotsDesign): number[] {
  switch (design) {
    case "star":
      return polygonPoints("star", 1, 1);
    case "heart": {
      // Start the numbering at the top dip rather than the side.
      const pts = polygonPoints("heart", 1, 1);
      const shift = Math.floor(pts.length / 4) * 2; // half the points, kept on an x/y pair boundary
      return [...pts.slice(shift), ...pts.slice(0, shift)];
    }
    case "house":
      return [0.5, 0.06, 0.92, 0.44, 0.84, 0.44, 0.84, 0.95, 0.16, 0.95, 0.16, 0.44, 0.08, 0.44];
    case "fish":
      return [0.62, 0.2, 0.8, 0.36, 0.97, 0.18, 0.95, 0.5, 0.97, 0.82, 0.8, 0.64, 0.62, 0.8, 0.35, 0.82, 0.12, 0.66, 0.03, 0.5, 0.12, 0.34, 0.35, 0.18];
    case "butterfly":
      return [0.5, 0.22, 0.34, 0.06, 0.1, 0.1, 0.06, 0.34, 0.26, 0.5, 0.1, 0.68, 0.14, 0.92, 0.38, 0.9, 0.5, 0.66, 0.62, 0.9, 0.86, 0.92, 0.9, 0.68, 0.74, 0.5, 0.94, 0.34, 0.9, 0.1, 0.66, 0.06];
  }
}

/** Dots on every corner, plus evenly spaced extras along long edges, up to about `target` in total. */
function sampleOutline(pts: number[], target: number): [number, number][] {
  let verts: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) verts.push([pts[i], pts[i + 1]]);
  // A smooth outline (the heart is 72 samples) has more corners than dots wanted: keep every n-th.
  if (verts.length > target) {
    const step = verts.length / target;
    verts = Array.from({ length: target }, (_, i) => verts[Math.floor(i * step)]);
  }
  const edges = verts.map((v, i) => {
    const w = verts[(i + 1) % verts.length];
    return { from: v, to: w, len: Math.hypot(w[0] - v[0], w[1] - v[1]) };
  });
  const perimeter = edges.reduce((s, e) => s + e.len, 0);
  const spacing = perimeter / Math.max(target, verts.length);
  const out: [number, number][] = [];
  for (const e of edges) {
    const k = Math.max(1, Math.round(e.len / spacing));
    for (let j = 0; j < k; j++) out.push([e.from[0] + ((e.to[0] - e.from[0]) * j) / k, e.from[1] + ((e.to[1] - e.from[1]) * j) / k]);
  }
  return out;
}

export function connectDotsPage(space: PageSpace, design: DotsDesign, dotCount: number, tx: TFunction = identityT): BookPage {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const titleH = 70;
  const size = Math.min(width, safe.bottom - safe.top - titleH - 20) * 0.92;
  const left = safe.left + (width - size) / 2;
  const top = safe.top + titleH + 10;
  const dots = sampleOutline(designOutline(design), dotCount);
  const objects: PageObject[] = [text({ text: tx("Connect the dots!"), x: safe.left, y: safe.top, width, fontSize: 40, outline: true, fontFamily: KID_FONT })];
  dots.forEach(([u, v], i) => {
    const x = left + u * size;
    const y = top + v * size;
    const r = i === 0 ? 6 : 4;
    objects.push(shape({ shapeKind: "circle", x: x - r, y: y - r, width: r * 2, height: r * 2, fill: INK, stroke: INK, strokeWidth: 1 }));
    // Numbers sit outside the outline: push them away from the design's center.
    const dx = u - 0.5;
    const dy = v - 0.5;
    const m = Math.hypot(dx, dy) || 1;
    objects.push(text({ text: String(i + 1), x: x + (dx / m) * 14 - 15, y: y + (dy / m) * 14 - 7, width: 30, height: 14, fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif", align: "center" }));
  });
  return blank(space, objects);
}

/** Total length of a flattened polyline. */
function pathLength(pts: number[]): number {
  let len = 0;
  for (let i = 2; i + 1 < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return len;
}

/**
 * One continuous path out of a page's pen strokes: starts from the longest
 * stroke and keeps attaching whichever stroke begins (or ends) nearest to
 * either end of the path, while one is within `reach`. Strokes drawn apart
 * from the main outline (eyes, details) are left out.
 */
export function chainStrokes(strokes: number[][], reach: number): number[] {
  const rest = strokes.filter((s) => s.length >= 4).sort((a, b) => pathLength(b) - pathLength(a));
  if (rest.length === 0) return [];
  let chain = [...rest.shift()!];
  const reversed = (s: number[]) => {
    const out: number[] = [];
    for (let i = s.length - 2; i >= 0; i -= 2) out.push(s[i], s[i + 1]);
    return out;
  };
  for (;;) {
    let best: { index: number; d: number; atEnd: boolean; flip: boolean } | null = null;
    const [sx, sy] = chain;
    const ex = chain[chain.length - 2];
    const ey = chain[chain.length - 1];
    rest.forEach((s, index) => {
      const head: [number, number] = [s[0], s[1]];
      const tail: [number, number] = [s[s.length - 2], s[s.length - 1]];
      const options = [
        { d: Math.hypot(head[0] - ex, head[1] - ey), atEnd: true, flip: false },
        { d: Math.hypot(tail[0] - ex, tail[1] - ey), atEnd: true, flip: true },
        { d: Math.hypot(tail[0] - sx, tail[1] - sy), atEnd: false, flip: false },
        { d: Math.hypot(head[0] - sx, head[1] - sy), atEnd: false, flip: true },
      ];
      for (const o of options) if (o.d <= reach && (!best || o.d < best.d)) best = { index, ...o };
    });
    if (!best) break;
    const pick = best as { index: number; d: number; atEnd: boolean; flip: boolean };
    const stroke = pick.flip ? reversed(rest[pick.index]) : rest[pick.index];
    chain = pick.atEnd ? [...chain, ...stroke] : [...stroke, ...chain];
    rest.splice(pick.index, 1);
  }
  return chain;
}

/** `count` points evenly spaced along a polyline (both ends included). */
export function resamplePath(pts: number[], count: number): [number, number][] {
  const total = pathLength(pts);
  if (total === 0 || count < 2) return [];
  const out: [number, number][] = [[pts[0], pts[1]]];
  const step = total / (count - 1);
  let walked = 0;
  let next = step;
  for (let i = 2; i + 1 < pts.length && out.length < count - 1; i += 2) {
    const seg = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    while (seg > 0 && walked + seg >= next && out.length < count - 1) {
      const t = (next - walked) / seg;
      out.push([pts[i - 2] + (pts[i] - pts[i - 2]) * t, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * t]);
      next += step;
    }
    walked += seg;
  }
  out.push([pts[pts.length - 2], pts[pts.length - 1]]);
  return out;
}

/**
 * Connect-the-dots from the user's own drawing: the page's pen outline
 * (see chainStrokes) becomes numbered dots, scaled to fill the page.
 * Null when there is no stroke long enough to make a picture of.
 */
export function connectDotsFromPage(source: BookPage, space: PageSpace, dotCount: number, tx: TFunction = identityT): BookPage | null {
  const strokes = source.lines.filter((l) => l.tool === "pen" && !l.style).map((l) => l.points);
  const path = chainStrokes(strokes, 30);
  if (path.length < 4 || pathLength(path) < 120) return null;
  let dots = resamplePath(path, dotCount);
  // A closed outline ends where it began: one dot there, not two on top of each other.
  const first = dots[0];
  const lastDot = dots[dots.length - 1];
  if (Math.hypot(first[0] - lastDot[0], first[1] - lastDot[1]) < 12) dots = dots.slice(0, -1);

  const xs = dots.map((d) => d[0]);
  const ys = dots.map((d) => d[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - minX);
  const h = Math.max(1, Math.max(...ys) - minY);
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const titleH = 70;
  const pad = 24; // room for the numbers outside the outline
  const availW = width - pad * 2;
  const availH = safe.bottom - safe.top - titleH - pad * 2;
  const k = Math.min(availW / w, availH / h);
  const left = safe.left + pad + (availW - w * k) / 2;
  const top = safe.top + titleH + pad + (availH - h * k) / 2;
  const cx = left + (w * k) / 2;
  const cy = top + (h * k) / 2;

  const objects: PageObject[] = [text({ text: tx("Connect the dots!"), x: safe.left, y: safe.top, width, fontSize: 40, outline: true, fontFamily: KID_FONT })];
  dots.forEach(([px, py], i) => {
    const x = left + (px - minX) * k;
    const y = top + (py - minY) * k;
    const r = i === 0 ? 6 : 4;
    objects.push(shape({ shapeKind: "circle", x: x - r, y: y - r, width: r * 2, height: r * 2, fill: INK, stroke: INK, strokeWidth: 1 }));
    const m = Math.hypot(x - cx, y - cy) || 1;
    objects.push(text({ text: String(i + 1), x: x + ((x - cx) / m) * 14 - 15, y: y + ((y - cy) / m) * 14 - 7, width: 30, height: 14, fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif", align: "center" }));
  });
  return blank(space, objects);
}

// ---------- Maze ----------

export type MazeLevel = "easy" | "medium" | "hard";
export const MAZE_LEVELS: { value: MazeLevel; label: string; cols: number }[] = [
  { value: "easy", label: "Easy", cols: 7 },
  { value: "medium", label: "Medium", cols: 12 },
  { value: "hard", label: "Hard", cols: 18 },
];

/** Perfect maze (exactly one path between any two cells) by recursive backtracking. Returns which walls remain. */
export function generateMaze(cols: number, rows: number, rand: () => number): { right: boolean[]; bottom: boolean[] } {
  const right = new Array(cols * rows).fill(true);
  const bottom = new Array(cols * rows).fill(true);
  const seen = new Uint8Array(cols * rows);
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const x = cell % cols;
    const y = Math.floor(cell / cols);
    const options = [
      x > 0 && !seen[cell - 1] ? cell - 1 : -1,
      x < cols - 1 && !seen[cell + 1] ? cell + 1 : -1,
      y > 0 && !seen[cell - cols] ? cell - cols : -1,
      y < rows - 1 && !seen[cell + cols] ? cell + cols : -1,
    ].filter((c) => c >= 0);
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(rand() * options.length)];
    if (next === cell + 1) right[cell] = false;
    else if (next === cell - 1) right[next] = false;
    else if (next === cell + cols) bottom[cell] = false;
    else bottom[next] = false;
    seen[next] = 1;
    stack.push(next);
  }
  return { right, bottom };
}

export function mazePage(space: PageSpace, level: MazeLevel, seed: number, tx: TFunction = identityT): BookPage {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const titleH = 64;
  const cols = MAZE_LEVELS.find((l) => l.value === level)?.cols ?? 12;
  const cell = width / cols;
  const rows = Math.max(3, Math.floor((safe.bottom - safe.top - titleH - 40) / cell));
  const left = safe.left;
  const top = safe.top + titleH + 20;
  const { right, bottom } = generateMaze(cols, rows, seededRandom(seed));
  const sw = level === "hard" ? 3 : 4.5;
  const lines: LineData[] = [];
  // Outer walls, with the entrance (top-left) and exit (bottom-right) left open.
  lines.push(line([left + cell, top, left + cols * cell, top], sw));
  lines.push(line([left, top, left, top + rows * cell], sw));
  lines.push(line([left, top + rows * cell, left + (cols - 1) * cell, top + rows * cell], sw));
  lines.push(line([left + cols * cell, top, left + cols * cell, top + rows * cell], sw));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (right[i] && x < cols - 1) lines.push(line([left + (x + 1) * cell, top + y * cell, left + (x + 1) * cell, top + (y + 1) * cell], sw));
      if (bottom[i] && y < rows - 1) lines.push(line([left + x * cell, top + (y + 1) * cell, left + (x + 1) * cell, top + (y + 1) * cell], sw));
    }
  }
  return blank(
    space,
    [
      text({ text: tx("Find the way out!"), x: safe.left, y: safe.top, width, fontSize: 40, outline: true, fontFamily: KID_FONT }),
      text({ text: `${tx("START")} ↓`, x: left, y: top - 20, width: 80, height: 16, fontSize: 12, align: "left", fontFamily: "Arial, Helvetica, sans-serif" }),
      text({ text: `↓ ${tx("FINISH")}`, x: left + cols * cell - 90, y: top + rows * cell + 4, width: 90, height: 16, fontSize: 12, align: "right", fontFamily: "Arial, Helvetica, sans-serif" }),
    ],
    lines
  );
}

// ---------- Spot the difference ----------

export interface SpotResult {
  puzzle: BookPage;
  answers: BookPage;
  /** How many differences were actually made (fewer if the source page is sparse). */
  made: number;
}

/**
 * Two copies of `source` stacked (top: original, bottom: changed) plus an
 * answer page circling each change. Changes are whole objects or strokes:
 * removed, mirrored, enlarged or tilted — each clearly visible at print size.
 */
export function spotTheDifference(source: BookPage, space: PageSpace, wanted: number, seed: number, tx: TFunction = identityT): SpotResult | null {
  const rand = seededRandom(seed);
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const titleH = 56;
  const half = (safe.bottom - safe.top - titleH - 24) / 2;
  const src = source.space ? geometryFromSpace(source.space).trim : geo.trim;
  const k = Math.min(width / (src.right - src.left), half / (src.bottom - src.top));
  const offX = safe.left + (width - (src.right - src.left) * k) / 2 - src.left * k;
  const topY = safe.top + titleH - src.top * k;
  const bottomY = topY + half + 24;

  const content = source.objects.filter((o) => !o.hidden && !(o.kind === "stamp" && o.isFrame));
  // Whole objects make the clearest differences; strokes only fill in, and
  // only ones big enough to notice (a short maze wall isn't).
  const shuffle = <T,>(xs: T[]): T[] => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  };
  const lineSize = (l: LineData) => {
    const xs = l.points.filter((_, i) => i % 2 === 0);
    const ys = l.points.filter((_, i) => i % 2 === 1);
    return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  };
  const pens = source.lines.filter((l) => l.tool === "pen");
  const objectPicks = shuffle(content.map((_, index) => ({ kind: "object" as const, index })));
  const linePicks = shuffle(pens.map((l, index) => ({ kind: "line" as const, index, size: lineSize(l) })).filter((l) => l.size >= 60));
  const candidates: ({ kind: "object"; index: number } | { kind: "line"; index: number })[] = [...objectPicks, ...linePicks];
  if (content.length + pens.length < 2 || candidates.length === 0) return null;
  const picked = candidates.slice(0, Math.min(wanted, candidates.length));

  const place = (o: PageObject, y: number): PageObject => ({ ...o, id: makeId(o.kind), x: offX + o.x * k, y: y + o.y * k, scaleX: o.scaleX * k, scaleY: o.scaleY * k, locked: false, groupId: undefined });
  const placeLine = (l: LineData, y: number): LineData => ({ ...l, id: makeId("line"), strokeWidth: l.strokeWidth * k, points: l.points.map((v, i) => (i % 2 === 0 ? offX + v * k : y + v * k)) });
  const topObjects = content.map((o) => place(o, topY));
  const topLines = pens.map((l) => placeLine(l, topY));
  // Kept index-aligned with `content` (null = removed) until every change is applied.
  const bottomObjects: (PageObject | null)[] = content.map((o) => place(o, bottomY));
  let bottomLines = pens.map((l) => placeLine(l, bottomY));
  const circles: Rect[] = [];

  for (const c of picked) {
    if (c.kind === "line") {
      const l = bottomLines[c.index];
      const xs = l.points.filter((_, i) => i % 2 === 0);
      const ys = l.points.filter((_, i) => i % 2 === 1);
      circles.push({ left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) });
      bottomLines = bottomLines.map((x, i) => (i === c.index ? { ...x, points: [] } : x));
      continue;
    }
    const o = bottomObjects[c.index];
    if (!o) continue;
    const before = objectBounds(o);
    const change = Math.floor(rand() * 4);
    let next: PageObject | null = o;
    if (change === 0) next = null; // removed
    else if (change === 1) next = { ...o, ...flippedHorizontally(o) } as PageObject;
    else if (change === 2) {
      const cx = (before.left + before.right) / 2;
      const cy = (before.top + before.bottom) / 2;
      next = { ...o, scaleX: o.scaleX * 1.3, scaleY: o.scaleY * 1.3, x: cx + (o.x - cx) * 1.3, y: cy + (o.y - cy) * 1.3 };
    } else next = { ...o, rotation: o.rotation + 25 };
    circles.push(before);
    bottomObjects[c.index] = next;
  }
  const changedObjects = bottomObjects.filter((x): x is PageObject => x !== null);
  bottomLines = bottomLines.filter((l) => l.points.length > 0);

  const title = text({ text: tx("Find {n} differences!", { n: picked.length }), x: safe.left, y: safe.top, width, fontSize: 36, outline: true, fontFamily: KID_FONT });
  const divider = rule(safe.left, topY + src.top * k + half + 12, width, 2);
  const puzzle = blank(space, [title, divider, ...topObjects, ...changedObjects], [...topLines, ...bottomLines]);
  const answerCircles = circles.map((r) => {
    const pad = 10;
    return shape({ shapeKind: "circle", x: r.left - pad, y: r.top - pad, width: r.right - r.left + pad * 2, height: r.bottom - r.top + pad * 2, fill: "transparent", stroke: "#c4453f", strokeWidth: 3 });
  });
  const answers = blank(
    space,
    [text({ text: tx("Answers"), x: safe.left, y: safe.top, width, fontSize: 36, fontFamily: KID_FONT }), divider, ...topObjects.map((o) => ({ ...o, id: makeId(o.kind) })), ...changedObjects.map((o) => ({ ...o, id: makeId(o.kind) })), ...answerCircles],
    [...topLines, ...bottomLines].map((l) => ({ ...l, id: makeId("line") }))
  );
  return { puzzle, answers, made: picked.length };
}
