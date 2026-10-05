// "Is this page right for this age?" — a measurement, not AI. It looks at
// the page the way a child with a crayon meets it: the separate areas there
// are to color (the same regions the paint bucket fills, see
// rasterFloodFill.ts) and how thick the lines around them are.
//
// Thresholds are rules of thumb from coloring-book practice, in page points
// (1pt = 1/72in): small hands need big areas and bold outlines; adults are
// fine with fine detail.

import { isWallPixel, type PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

export type AgeGroup = "3-5" | "6-8" | "9+";

export const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: "3-5", label: "Ages 3–5" },
  { value: "6-8", label: "Ages 6–8" },
  { value: "9+", label: "Ages 9+ / adults" },
];

const RULES: Record<AgeGroup, { minArea: number; minLine: number; maxAreas: number }> = {
  // ~0.75in across, bold 0.1in lines, a handful of shapes
  "3-5": { minArea: 54 * 54, minLine: 6, maxAreas: 25 },
  // ~0.4in across
  "6-8": { minArea: 29 * 29, minLine: 3.5, maxAreas: 80 },
  // anything goes; still flag specks nobody can color
  "9+": { minArea: 6 * 6, minLine: 1, maxAreas: Infinity },
};

/** Regions smaller than this are anti-aliasing slivers and corners, not areas anyone sees. */
const IGNORE_BELOW = 20;
const DARKNESS_THRESHOLD = 128;

export interface AgeCheckResult {
  areas: number;
  /** Colorable areas smaller than the age's minimum, with where to point at them. */
  tooSmall: { x: number; y: number; r: number }[];
  /** Typical line thickness in points (median ink run across lines). */
  lineWidth: number;
  verdict: "good" | "some-small" | "too-detailed" | "empty";
  /** What to change, as English i18n keys (see the panel). */
  advice: string[];
}

/** Median horizontal+vertical run length of ink — a robust stand-in for "how thick are the lines". */
function medianLineWidth(wall: Uint8Array, width: number, height: number): number {
  const runs: number[] = [];
  const scan = (get: (i: number, j: number) => number, outer: number, inner: number) => {
    for (let a = 0; a < outer; a += 3) {
      let run = 0;
      for (let b = 0; b < inner; b++) {
        if (get(a, b)) run++;
        else if (run) {
          if (run < 60) runs.push(run); // longer runs are solid fills, not lines
          run = 0;
        }
      }
    }
  };
  scan((y, x) => wall[y * width + x], height, width);
  scan((x, y) => wall[y * width + x], width, height);
  if (runs.length === 0) return 0;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}

export function checkAge(boundary: PixelBuffer, group: AgeGroup): AgeCheckResult {
  const { width, height, data } = boundary;
  const rules = RULES[group];
  const wall = new Uint8Array(width * height);
  let inkPixels = 0;
  for (let i = 0; i < wall.length; i++) {
    if (isWallPixel(data, i * 4, DARKNESS_THRESHOLD)) {
      wall[i] = 1;
      inkPixels++;
    }
  }
  if (inkPixels === 0) return { areas: 0, tooSmall: [], lineWidth: 0, verdict: "empty", advice: ["Draw or place something first."] };

  // Label open regions (4-connected), tracking size, centroid, extent and whether they touch the page edge.
  const labels = new Int32Array(wall.length);
  const stack: number[] = [];
  const regions: { size: number; sx: number; sy: number; minX: number; maxX: number; minY: number; maxY: number; edge: boolean }[] = [];
  for (let start = 0; start < wall.length; start++) {
    if (wall[start] || labels[start]) continue;
    const r = { size: 0, sx: 0, sy: 0, minX: width, maxX: 0, minY: height, maxY: 0, edge: false };
    labels[start] = regions.length + 1;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      r.size++;
      r.sx += x;
      r.sy += y;
      if (x < r.minX) r.minX = x;
      if (x > r.maxX) r.maxX = x;
      if (y < r.minY) r.minY = y;
      if (y > r.maxY) r.maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) r.edge = true;
      const neighbors = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const q of neighbors) {
        if (q < 0 || q >= wall.length || wall[q] || labels[q]) continue;
        labels[q] = regions.length + 1;
        stack.push(q);
      }
    }
    regions.push(r);
  }

  // The page background (touching the edge) is where you color "around" the picture, not an area of it.
  const colorable = regions.filter((r) => !r.edge && r.size >= IGNORE_BELOW);
  const tooSmall = colorable
    .filter((r) => r.size < rules.minArea)
    .map((r) => ({ x: r.sx / r.size, y: r.sy / r.size, r: Math.max(8, Math.max(r.maxX - r.minX, r.maxY - r.minY) / 2 + 5) }));
  const lineWidth = medianLineWidth(wall, width, height);

  const advice: string[] = [];
  if (tooSmall.length) advice.push("Merge or remove the circled areas — they're too small to color at this age.");
  if (lineWidth && lineWidth < rules.minLine) advice.push("Use thicker lines (try the “Ages 3–5” or “Bold” brush).");
  if (colorable.length > rules.maxAreas) advice.push("Simplify: there are more areas than this age will enjoy coloring on one page.");

  const smallShare = colorable.length ? tooSmall.length / colorable.length : 0;
  const verdict = advice.length === 0 ? "good" : smallShare > 0.3 || colorable.length > rules.maxAreas ? "too-detailed" : "some-small";
  return { areas: colorable.length, tooSmall, lineWidth, verdict, advice };
}
