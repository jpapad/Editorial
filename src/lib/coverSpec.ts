import type { CoverSpec, KdpPrintSpec, PaperType } from "@/types/kdpBook";

/**
 * Amazon KDP's published per-page spine thickness factors for paperback
 * interiors (inches per page). Cream paper is physically thicker than
 * white, so the same page count needs a wider spine. These are the
 * publicly documented figures as of this writing — confirm against KDP's
 * current spec page before a real submission, since printers occasionally
 * revise them.
 */
export const SPINE_WIDTH_PER_PAGE_IN: Record<PaperType, number> = {
  white: 0.002252,
  cream: 0.0025,
};

/** KDP won't reliably print legible spine text below ~100 pages — the spine still physically exists, it's just too thin for text. */
export const MIN_PAGE_COUNT_FOR_SPINE_TEXT = 100;

export const ISBN_ZONE_WIDTH_IN = 2;
export const ISBN_ZONE_HEIGHT_IN = 1.2;
export const ISBN_ZONE_MARGIN_IN = 0.25; // from the back cover's trim edges

export function calculateSpineWidthIn(pageCount: number, paperType: PaperType): number {
  const raw = pageCount * SPINE_WIDTH_PER_PAGE_IN[paperType];
  return Math.round(raw * 10000) / 10000;
}

export interface CoverDimensions {
  spineWidthIn: number;
  panelWidthIn: number; // one trim panel (back or front)
  panelHeightIn: number;
  /** back + spine + front, no bleed. */
  totalCoverWidthIn: number;
  /** + left/right bleed — the actual PDF page size to submit. Bleed only applies to the two outer edges (and top/bottom); the spine is a fold, not a cut, and never bleeds. */
  fullBleedWidthIn: number;
  fullBleedHeightIn: number;
  spineTextRecommended: boolean;
  /** X offset (inches, from the bleed-inclusive left edge) where each panel starts. */
  backCoverX: number;
  spineX: number;
  frontCoverX: number;
}

export function calculateCoverDimensions(printSpec: KdpPrintSpec, coverSpec: CoverSpec): CoverDimensions {
  const spineWidthIn = calculateSpineWidthIn(coverSpec.pageCount, coverSpec.paperType);
  const panelWidthIn = printSpec.trimWidthIn;
  const panelHeightIn = printSpec.trimHeightIn;
  const totalCoverWidthIn = panelWidthIn * 2 + spineWidthIn;

  return {
    spineWidthIn,
    panelWidthIn,
    panelHeightIn,
    totalCoverWidthIn,
    fullBleedWidthIn: totalCoverWidthIn + printSpec.bleedIn * 2,
    fullBleedHeightIn: panelHeightIn + printSpec.bleedIn * 2,
    spineTextRecommended: coverSpec.pageCount >= MIN_PAGE_COUNT_FOR_SPINE_TEXT,
    backCoverX: printSpec.bleedIn,
    spineX: printSpec.bleedIn + panelWidthIn,
    frontCoverX: printSpec.bleedIn + panelWidthIn + spineWidthIn,
  };
}

export const DEFAULT_COVER_SPEC: CoverSpec = {
  paperType: "white",
  pageCount: 52,
  includeIsbnZone: true,
  backCoverColor: "#ffffff",
  frontCoverColor: "#ffffff",
  spineColor: "#ffffff",
};
