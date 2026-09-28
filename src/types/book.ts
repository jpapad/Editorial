// Sprint 1 data model for the Children's Coloring & Tracing Book Editor.
//
// Units: every geometric field (x, y, width, height, dotRadius, ...) is in
// INCHES, measured from the page's own top-left trim corner — not pixels.
// This is deliberate: vector content (text, tracing lines, guide letters)
// is resolution-independent, so inches is the only unit that means the
// same thing on screen and on a printed page. Screen rendering can use
// CSS's native `in` unit directly (e.g. `width: "6.5in"`), so no px
// conversion helper is needed for Sprint 1.
//
// Font sizes and stroke widths are the exception and use POINTS (1pt =
// 1/72in) — the standard print-industry unit.

export type CanvasElementType =
  | "TITLE_TEXT"
  | "SVG_MAIN_ART"
  | "LETTER_GUIDE"
  | "TRACING_GRID"
  | "SVG_MINI_GROUP"
  | "DOT_TO_DOT";

interface BaseCanvasElement {
  id: string;
  type: CanvasElementType;
  /** Inches, from the page's top-left trim corner. */
  x: number;
  y: number;
  /** Inches. */
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotation: number;
  /**
   * Sprint 6 — mirrors the element's own content within its box (not its
   * position on the page; use utils/layoutTools.ts's alignElements /
   * distributeElements for position). Optional and defaulted to falsy
   * everywhere it's read, so every element from every earlier sprint
   * remains valid without touching existing data.
   */
  flipX?: boolean;
  flipY?: boolean;
}

export type TextAlign = "left" | "center" | "right";

/** "X is for..." style page heading. */
export interface TitleTextElement extends BaseCanvasElement {
  type: "TITLE_TEXT";
  text: string;
  fontFamily: string;
  fontSize: number; // pt
  align: TextAlign;
  fill: string; // hex
}

/**
 * The full-page coloring illustration (left page) or supporting art on the
 * right page. `svgMarkup` is raw source — SvgNormalizer is what turns it
 * into clean line art at render time, so this element just carries
 * whatever was imported plus the physical stroke weight it should print at.
 */
export interface SvgMainArtElement extends BaseCanvasElement {
  type: "SVG_MAIN_ART";
  svgMarkup: string;
  strokeWidth: number; // pt
}

export interface StrokeOrderArrow {
  order: number;
  /** Inches, relative to the LetterGuide element's own box (not the page). */
  x: number;
  y: number;
  /** Degrees; 0 = pointing up. */
  rotation: number;
}

/**
 * A large single-letter tracing guide with author-placed stroke-order
 * arrows. Data model only in Sprint 1 — see TwoPageSpreadEditor's inline
 * placeholder for why a dedicated visual renderer is out of scope here.
 */
export interface LetterGuideElement extends BaseCanvasElement {
  type: "LETTER_GUIDE";
  letter: string; // single character
  fontFamily: string;
  guideStyle: "solid" | "hollow" | "dashed";
  strokeArrows: StrokeOrderArrow[];
}

/**
 * A multi-row practice grid: each row repeats the target letter (first
 * instance solid as a model, the rest for tracing). Data model only in
 * Sprint 1 — see the note on LetterGuideElement above.
 */
export interface TracingGridElement extends BaseCanvasElement {
  type: "TRACING_GRID";
  letter: string;
  fontFamily: string;
  rows: number;
  repeatsPerRow: number;
  firstInstanceSolid: boolean;
}

export interface SvgMiniItem {
  id: string;
  svgMarkup: string;
  /** Inches, relative to the SvgMiniGroupElement's own box. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A cluster of small secondary coloring illustrations (right-page filler art). */
export interface SvgMiniGroupElement extends BaseCanvasElement {
  type: "SVG_MINI_GROUP";
  items: SvgMiniItem[];
  strokeWidth: number; // pt
}

export interface DotToDotVertex {
  /** Inches, relative to the DotToDotElement's own box. */
  x: number;
  y: number;
}

/** A numbered dot-to-dot activity. Data model only in Sprint 1 — see the note on LetterGuideElement above. */
export interface DotToDotElement extends BaseCanvasElement {
  type: "DOT_TO_DOT";
  vertices: DotToDotVertex[];
  dotRadius: number; // inches
  /** Editor-only faint guide connecting the dots; never shown in print export. */
  showPreviewPath: boolean;
}

export type CanvasElement =
  | TitleTextElement
  | SvgMainArtElement
  | LetterGuideElement
  | TracingGridElement
  | SvgMiniGroupElement
  | DotToDotElement;

export interface PageData {
  id: string;
  elements: CanvasElement[];
  backgroundColor?: string; // hex; defaults to white
}

/** One physical sheet as it will be bound: a left page and a right page. */
export interface PageSpread {
  id: string;
  spreadNumber: number;
  leftPage: PageData;
  rightPage: PageData;
}

/**
 * KDP interior print settings for an 8.5x11in paperback.
 *
 * `outerMarginIn` was deferred in Sprint 1 (flagged there as a gap —
 * without it, only the gutter/spine-side margin was well-defined). Sprint 3
 * adds it: the Pre-Flight Checker's "Margin" safe-zone rule needs a real
 * top/bottom/outer bound to check elements against, distinct from the
 * gutter.
 */
export interface BookSettings {
  trimWidthIn: number;
  trimHeightIn: number;
  bleedIn: number;
  gutterIn: number;
  outerMarginIn: number;
  globalStrokeWidthPt: number;
  exportDpi: number;
}

export const DEFAULT_BOOK_SETTINGS: BookSettings = {
  trimWidthIn: 8.5,
  trimHeightIn: 11,
  bleedIn: 0.125,
  gutterIn: 0.375,
  outerMarginIn: 0.25,
  globalStrokeWidthPt: 3,
  exportDpi: 300,
};

export interface BookState {
  id: string;
  title: string;
  author?: string;
  settings: BookSettings;
  spreads: PageSpread[];
  createdAt: string;
  updatedAt: string;
}
