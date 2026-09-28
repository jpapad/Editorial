// Page geometry for a book, in points (1/72 in) — the canvas's own units.
//
// A page's canvas is the real trim size (e.g. 612×792 for 8.5×11in), plus
// BLEED_PT on every side when the book prints to the edge. Before this,
// every book was drawn on a fixed 595×842 (A4) canvas and letterboxed into
// the trim at export — pages carrying no `space` were authored that way,
// and convertPage() maps them onto the real geometry with that same
// scale-and-center, so they look exactly as they always exported.

import type { BookPage, LineData, PageObject, PageSpace } from "@/types/editor";
import { getTrimSize } from "@/utils/trimSizes";

/** The old fixed canvas: A4 at 72pt/in. Pages without `space` were drawn on it. */
export const LEGACY_SPACE: PageSpace = { width: 595, height: 842, bleed: 0 };
/** KDP's bleed: 0.125in past the trim on each bleed edge. */
export const BLEED_PT = 9;
/** 0.5in inside the trim — the editor's safe area (KDP's own minimum is 0.25in outside, 0.375in gutter). */
export const SAFE_MARGIN_PT = 36;

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PageGeometry {
  width: number;
  height: number;
  /** Extra canvas past the trim on every side (0 or BLEED_PT). */
  bleed: number;
  /** Where the paper is cut. */
  trim: Rect;
  /** Keep important content inside this. */
  safe: Rect;
}

export function inset(r: Rect, by: number): Rect {
  return { left: r.left + by, top: r.top + by, right: r.right - by, bottom: r.bottom - by };
}

export function geometryFromSpace(space: PageSpace): PageGeometry {
  const trim = { left: space.bleed, top: space.bleed, right: space.width - space.bleed, bottom: space.height - space.bleed };
  return { width: space.width, height: space.height, bleed: space.bleed, trim, safe: inset(trim, SAFE_MARGIN_PT) };
}

/** An interior page for this book's trim size, with or without bleed. */
export function interiorSpace(trimSizeId: string | undefined, bleed: boolean): PageSpace {
  const trim = getTrimSize(trimSizeId);
  const b = bleed ? BLEED_PT : 0;
  return { width: trim.widthPt + 2 * b, height: trim.heightPt + 2 * b, bleed: b };
}

export function interiorGeometry(trimSizeId: string | undefined, bleed: boolean): PageGeometry {
  return geometryFromSpace(interiorSpace(trimSizeId, bleed));
}

export function sameSpace(a: PageSpace, b: PageSpace): boolean {
  return a.width === b.width && a.height === b.height && a.bleed === b.bleed;
}

/**
 * Trim-to-trim mapping between two spaces: uniform scale `k` (largest that
 * fits) and the offset that centers the old trim inside the new one. For a
 * bleed toggle on the same trim size this is k = 1 plus a 9pt shift, so
 * content keeps its place relative to the cut.
 */
export function spaceTransform(from: PageSpace, to: PageSpace): { k: number; dx: number; dy: number } {
  const fw = from.width - 2 * from.bleed;
  const fh = from.height - 2 * from.bleed;
  const tw = to.width - 2 * to.bleed;
  const th = to.height - 2 * to.bleed;
  const k = Math.min(tw / fw, th / fh);
  const dx = to.bleed + (tw - fw * k) / 2 - from.bleed * k;
  const dy = to.bleed + (th - fh * k) / 2 - from.bleed * k;
  return { k, dx, dy };
}

function transformObject(obj: PageObject, k: number, dx: number, dy: number): PageObject {
  return { ...obj, x: dx + obj.x * k, y: dy + obj.y * k, scaleX: obj.scaleX * k, scaleY: obj.scaleY * k };
}

function transformLine(line: LineData, k: number, dx: number, dy: number): LineData {
  return { ...line, strokeWidth: line.strokeWidth * k, points: line.points.map((v, i) => (i % 2 === 0 ? dx + v * k : dy + v * k)) };
}

/** Redraws a page's raster paint layer into the new space. Browser-only (canvas). */
async function transformFill(dataUrl: string, from: PageSpace, to: PageSpace): Promise<string> {
  const { k, dx, dy } = spaceTransform(from, to);
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = to.width;
  canvas.height = to.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.setTransform(k, 0, 0, k, dx, dy);
  ctx.drawImage(img, 0, 0, from.width, from.height);
  return canvas.toDataURL("image/png");
}

/** The page re-expressed in `to` — objects, strokes and the kids' paint layer all move together. */
export async function convertPage(page: BookPage, to: PageSpace): Promise<BookPage> {
  const from = page.space ?? LEGACY_SPACE;
  if (sameSpace(from, to)) return page.space ? page : { ...page, space: to };
  const { k, dx, dy } = spaceTransform(from, to);
  return {
    ...page,
    space: to,
    objects: page.objects.map((o) => transformObject(o, k, dx, dy)),
    lines: page.lines.map((l) => transformLine(l, k, dx, dy)),
    fillDataUrl: page.fillDataUrl ? await transformFill(page.fillDataUrl, from, to).catch(() => undefined) : undefined,
    // The old thumbnail shows the old framing; it's re-captured on the next page switch.
    thumbnailDataUrl: page.thumbnailDataUrl,
  };
}

export function convertPages(pages: BookPage[], to: PageSpace): Promise<BookPage[]> {
  return Promise.all(pages.map((p) => convertPage(p, to)));
}

/** True when any page still needs converting into `to`. */
export function needsConversion(pages: BookPage[], to: PageSpace): boolean {
  return pages.some((p) => !p.space || !sameSpace(p.space, to));
}
