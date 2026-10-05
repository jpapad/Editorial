// How a page *looks*, measured from its small preview picture: a
// map of where its ink is, for "these two pages are nearly the same", plus how much ink
// it carries and how thick its lines are for "this page doesn't match the
// rest of the book". Pure maths on a PixelBuffer — the browser part that
// loads thumbnails lives in lib/usePageLooks.ts.

import type { PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

export interface PageLook {
  /** Where the ink is: a 24×30 grid, 1 for every cell that has some. */
  ink: Uint8Array;
  /** Share of the page that is ink, 0–1. */
  density: number;
  /** Typical line thickness in preview pixels (median run of ink). */
  lineWidth: number;
}

const GRID_W = 24;
const GRID_H = 30;
const DARK = 140;

const grey = (d: Uint8ClampedArray, o: number) => 255 - (d[o + 3] / 255) * (255 - (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114));

export function lookOf(image: PixelBuffer): PageLook {
  const { width, height, data } = image;
  const ink = new Uint8Array(GRID_W * GRID_H);
  let dark = 0;
  const runs: number[] = [];
  for (let y = 0; y < height; y++) {
    const cy = Math.min(GRID_H - 1, Math.floor((y * GRID_H) / height));
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (grey(data, (y * width + x) * 4) < DARK) {
        dark++;
        run++;
        ink[cy * GRID_W + Math.min(GRID_W - 1, Math.floor((x * GRID_W) / width))] = 1;
      } else if (run) {
        runs.push(run);
        run = 0;
      }
    }
    if (run) runs.push(run);
  }
  runs.sort((a, b) => a - b);
  return { ink, density: dark / (width * height || 1), lineWidth: runs.length ? runs[Math.floor(runs.length / 2)] : 0 };
}

/**
 * How much two pages' ink lies in the same places, 0–1 (cells inked on
 * both ÷ cells inked on either). Line art is mostly white, so comparing
 * where the ink *is* tells pages apart far better than comparing whole
 * pictures: the same small drawing in another spot scores near 0.
 */
export function inkOverlap(a: Uint8Array, b: Uint8Array): number {
  let both = 0;
  let either = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) both++;
    if (a[i] || b[i]) either++;
  }
  return either ? both / either : 0;
}

/** Pages with almost nothing on them have no look to compare. */
const MIN_DENSITY = 0.002;
/** The same picture nudged or lightly edited overlaps more than this; different pictures rarely pass half. */
export const SIMILAR_OVERLAP = 0.8;

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** Pages that look nearly the same as an earlier page (ids of the later ones). */
export function lookAlikes(looks: { id: string; look: PageLook }[]): string[] {
  const out: string[] = [];
  const seen: PageLook[] = [];
  for (const { id, look } of looks) {
    if (look.density < MIN_DENSITY) continue;
    if (seen.some((s) => inkOverlap(s.ink, look.ink) >= SIMILAR_OVERLAP && Math.abs(s.density - look.density) <= Math.max(s.density, look.density) * 0.25)) out.push(id);
    else seen.push(look);
  }
  return out;
}

/** Needs this many drawn pages before "typical for this book" means anything. */
const MIN_PAGES_FOR_STYLE = 5;

/** Pages whose lines are far thicker/thinner, or far busier/emptier, than is typical for the book. */
export function offStyle(looks: { id: string; look: PageLook }[]): string[] {
  const drawn = looks.filter((l) => l.look.density >= MIN_DENSITY && l.look.lineWidth > 0);
  if (drawn.length < MIN_PAGES_FOR_STYLE) return [];
  const width = median(drawn.map((l) => l.look.lineWidth));
  const density = median(drawn.map((l) => l.look.density));
  return drawn
    .filter(({ look }) => look.lineWidth >= width * 2.2 || look.lineWidth <= width / 2.2 || look.density >= density * 4 || look.density <= density / 4)
    .map((l) => l.id);
}
