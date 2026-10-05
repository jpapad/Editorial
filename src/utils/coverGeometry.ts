// KDP paperback cover geometry, in points. The cover is ONE canvas:
//
//   bleed | back cover | spine | front cover | bleed
//
// Figures from KDP's paperback cover guidelines: 0.125in bleed on every
// edge; spine = page count × paper thickness; spine text only on books with
// more than 79 pages; keep text 0.125in inside the trim and 0.0625in inside
// each spine fold; the barcode box sits at the bottom right of the back.

import type { BookPage, CoverDesign, LineData, PageObject, PageSpace, PaperType } from "@/types/editor";
import { getTrimSize } from "@/utils/trimSizes";
import type { Rect } from "@/utils/pageGeometry";

export const COVER_BLEED_PT = 9; // 0.125in
const COVER_SAFE_PT = 9; // 0.125in inside the trim
const SPINE_SAFE_PT = 4.5; // 0.0625in inside each fold
export const MIN_PAGES = 24;
export const SPINE_TEXT_MIN_PAGES = 80;

/** Inches per page (per sheet side), from KDP's spine-width formula. */
const PAPER_THICKNESS_IN: Record<PaperType, number> = {
  white: 0.002252,
  cream: 0.0025,
  color: 0.002347,
};

export const PAPER_OPTIONS: { value: PaperType; label: string }[] = [
  { value: "white", label: "White paper" },
  { value: "cream", label: "Cream paper" },
  { value: "color", label: "Premium color" },
];

export function spineWidthPt(pageCount: number, paper: PaperType): number {
  return Math.max(pageCount, MIN_PAGES) * PAPER_THICKNESS_IN[paper] * 72;
}

export interface CoverLayout {
  space: PageSpace;
  spine: number;
  back: Rect;
  spineRect: Rect;
  front: Rect;
  /** The whole trimmed cover (back + spine + front). */
  trim: Rect;
  barcode: Rect;
  spineTextAllowed: boolean;
}

export function coverLayout(trimSizeId: string | undefined, pageCount: number, paper: PaperType): CoverLayout {
  const t = getTrimSize(trimSizeId);
  const b = COVER_BLEED_PT;
  const spine = spineWidthPt(pageCount, paper);
  const width = 2 * t.widthPt + spine + 2 * b;
  const height = t.heightPt + 2 * b;
  const top = b;
  const bottom = b + t.heightPt;
  const back = { left: b, top, right: b + t.widthPt, bottom };
  const spineRect = { left: back.right, top, right: back.right + spine, bottom };
  const front = { left: spineRect.right, top, right: spineRect.right + t.widthPt, bottom };
  // KDP's barcode area: 2 × 1.2in, 0.25in in from the spine side of the back cover's bottom-right.
  const barcode = { left: back.right - 18 - 144, top: back.bottom - 18 - 86.4, right: back.right - 18, bottom: back.bottom - 18 };
  return {
    space: { width, height, bleed: b },
    spine,
    back,
    spineRect,
    front,
    trim: { left: b, top, right: width - b, bottom },
    barcode,
    spineTextAllowed: pageCount >= SPINE_TEXT_MIN_PAGES,
  };
}

export function coverSafeAreas(layout: CoverLayout): Rect[] {
  const inset = (r: Rect, by: number): Rect => ({ left: r.left + by, top: r.top + by, right: r.right - by, bottom: r.bottom - by });
  const safe = [inset(layout.back, COVER_SAFE_PT), inset(layout.front, COVER_SAFE_PT)];
  // A spine too thin for its own safe area just gets none.
  if (layout.spine > SPINE_SAFE_PT * 2 + 2) safe.push({ ...inset(layout.spineRect, COVER_SAFE_PT), left: layout.spineRect.left + SPINE_SAFE_PT, right: layout.spineRect.right - SPINE_SAFE_PT });
  return safe;
}

/** Which panel an x position sits in — objects move with their panel when the spine changes. */
function panelShift(x: number, oldLayout: { backRight: number; spineRight: number }, delta: number): number {
  if (x < oldLayout.backRight) return 0;
  if (x < oldLayout.spineRight) return delta / 2;
  return delta;
}

function centerX(obj: PageObject): number {
  return obj.x + (obj.width * obj.scaleX) / 2; // rotation ignored: panel membership only needs the rough center
}

function lineCenterX(line: LineData): number {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < line.points.length; i += 2) {
    min = Math.min(min, line.points[i]);
    max = Math.max(max, line.points[i]);
  }
  return (min + max) / 2;
}

/**
 * Re-fits a saved cover to the current spine (page count or paper changed):
 * back-cover content stays put, spine content moves by half the change,
 * front-cover content by all of it — so everything stays on its panel.
 */
export function refitCover(cover: CoverDesign, layout: CoverLayout): CoverDesign {
  const delta = layout.spine - cover.spineWidth;
  const oldSpace = cover.page.space;
  if (Math.abs(delta) < 0.01 && oldSpace && oldSpace.width === layout.space.width && oldSpace.height === layout.space.height) return cover;
  const backRight = layout.back.right;
  const old = { backRight, spineRight: backRight + cover.spineWidth };
  const page: BookPage = {
    ...cover.page,
    space: layout.space,
    objects: cover.page.objects.map((o) => ({ ...o, x: o.x + panelShift(centerX(o), old, delta) })),
    lines: cover.page.lines.map((l) => {
      const dx = panelShift(lineCenterX(l), old, delta);
      return dx ? { ...l, points: l.points.map((v, i) => (i % 2 === 0 ? v + dx : v)) } : l;
    }),
    fillDataUrl: undefined, // the cover has no kids' paint layer
  };
  return { page, spineWidth: layout.spine };
}

export function emptyCover(layout: CoverLayout, id: string): CoverDesign {
  return { page: { id, pageNumber: 0, space: layout.space, lines: [], objects: [], isCover: true, coverBackgroundColor: "#ffffff" }, spineWidth: layout.spine };
}
