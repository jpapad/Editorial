import type { BookSettings, TextAlign } from "@/types/book";

export type PaperType = "white" | "cream";

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

export function calculateSpineWidth(pageCount: number, paperType: PaperType): number {
  const raw = pageCount * SPINE_WIDTH_PER_PAGE_IN[paperType];
  return Math.round(raw * 10000) / 10000;
}

/** KDP won't reliably print legible spine text below ~100 pages — the spine still physically exists, it's just too thin for text. */
export const MIN_PAGE_COUNT_FOR_SPINE_TEXT = 100;

/**
 * KDP's published minimum interior gutter widens in steps as page count
 * grows — a thicker book needs more clearance near the spine or the
 * binding eats into content. Same disclosure as SPINE_WIDTH_PER_PAGE_IN
 * above: the publicly documented figures as of this writing, confirm
 * against KDP's current spec page before a real submission. Sorted
 * ascending by page-count threshold; the first row whose threshold the
 * book meets or exceeds (checked from the top) wins.
 */
const KDP_GUTTER_TABLE: { minPages: number; gutterIn: number }[] = [
  { minPages: 701, gutterIn: 0.875 },
  { minPages: 501, gutterIn: 0.75 },
  { minPages: 301, gutterIn: 0.625 },
  { minPages: 151, gutterIn: 0.5 },
  { minPages: 0, gutterIn: 0.375 },
];

export function resolveKdpGutterIn(pageCount: number): number {
  return (KDP_GUTTER_TABLE.find((row) => pageCount >= row.minPages) ?? KDP_GUTTER_TABLE[KDP_GUTTER_TABLE.length - 1]).gutterIn;
}

// KDP's cover safety margin and spine-fold clearance are their own spec,
// distinct from BookSettings.gutterIn — that field is specifically the
// interior page's binding margin, not the cover's.
export const COVER_SAFE_MARGIN_IN = 0.25;
export const SPINE_FOLD_SAFETY_IN = 0.125;

export const ISBN_ZONE_WIDTH_IN = 2;
export const ISBN_ZONE_HEIGHT_IN = 1.2;
export const ISBN_ZONE_MARGIN_IN = 0.25;

export interface CoverDimensions {
  spineWidthIn: number;
  panelWidthIn: number; // one trim panel (back or front)
  panelHeightIn: number;
  /** back + spine + front, no bleed. */
  totalCoverWidthIn: number;
  /** + left/right bleed — the actual page size to submit. Bleed only applies to the two outer edges (and top/bottom); the spine is a fold, not a cut, and never bleeds. */
  fullBleedWidthIn: number;
  fullBleedHeightIn: number;
  spineTextRecommended: boolean;
  /** X offset (inches, from the bleed-inclusive left edge) where each panel starts. */
  backCoverX: number;
  spineX: number;
  frontCoverX: number;
}

export function calculateCoverDimensions(settings: BookSettings, pageCount: number, paperType: PaperType): CoverDimensions {
  const spineWidthIn = calculateSpineWidth(pageCount, paperType);
  const panelWidthIn = settings.trimWidthIn;
  const panelHeightIn = settings.trimHeightIn;
  const totalCoverWidthIn = panelWidthIn * 2 + spineWidthIn;

  return {
    spineWidthIn,
    panelWidthIn,
    panelHeightIn,
    totalCoverWidthIn,
    fullBleedWidthIn: totalCoverWidthIn + settings.bleedIn * 2,
    fullBleedHeightIn: panelHeightIn + settings.bleedIn * 2,
    spineTextRecommended: pageCount >= MIN_PAGE_COUNT_FOR_SPINE_TEXT,
    backCoverX: settings.bleedIn,
    spineX: settings.bleedIn + panelWidthIn,
    frontCoverX: settings.bleedIn + panelWidthIn + spineWidthIn,
  };
}

// --- Cover content model -------------------------------------------------
// Kept alongside the math rather than in types/book.ts: a cover is a
// physically different artifact from an interior PageSpread (one
// continuous back/spine/front canvas, not two independent pages), so it
// doesn't extend BookState's page model — it's its own small, self-
// contained shape.

export interface CoverElementBase {
  id: string;
  /** Which panel this sits on — organizational only; x/y below are already in full-cover coordinates. */
  panel: "back" | "spine" | "front";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface CoverTextElement extends CoverElementBase {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number; // pt
  align: TextAlign;
  fill: string;
}

export interface CoverArtElement extends CoverElementBase {
  kind: "art";
  svgMarkup: string;
  strokeWidth: number; // pt
}

export type CoverElement = CoverTextElement | CoverArtElement;

export interface CoverSpec {
  paperType: PaperType;
  pageCount: number;
  includeIsbnZone: boolean;
  backCoverColor: string;
  frontCoverColor: string;
  spineColor: string;
}

export interface CoverState {
  spec: CoverSpec;
  elements: CoverElement[];
}

export const DEFAULT_COVER_SPEC: CoverSpec = {
  paperType: "white",
  pageCount: 24,
  includeIsbnZone: true,
  backCoverColor: "#ffffff",
  frontCoverColor: "#ffffff",
  spineColor: "#ffffff",
};
