// Data model for the Coloring & Tracing Book Editor — a print-on-demand
// (KDP-style) activity book made of two-page spreads: a full-page coloring
// illustration on the left, a tracing/practice activity on the right.
//
// Units: every geometric field (x, y, width, height, dotRadius, ...) is in
// INCHES, measured from the page's own top-left trim corner — not pixels.
// Vector content (text, tracing lines, guide letters) is resolution-
// independent, so inches is the only unit that means anything the same way
// on screen and on a printed page; screen rendering converts inches to CSS
// px via a single `pxPerInch` scale factor (see src/lib/kdpPrintSpec.ts).
// Font sizes and stroke weights are the exception and use POINTS (1pt =
// 1/72in) — the standard print-industry unit, and what the Pre-Flight
// Checker's "< 0.75pt" rule is measured against.

export type CanvasElementType =
  | "TITLE_TEXT"
  | "SVG_MAIN_ART"
  | "LETTER_GUIDE"
  | "TRACING_GRID"
  | "SVG_MINI_GROUP"
  | "DOT_TO_DOT"
  | "MAZE_GRID"
  | "WORD_SEARCH"
  | "COLOR_BY_NUMBER"
  | "COUNTING_ACTIVITY";

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
 * The full-page coloring illustration (left page) or a supporting SVG on
 * the right page. `svgMarkup` is expected to already be normalized — see
 * SvgNormalizer — so renderers never have to re-parse/clean it.
 */
export interface SvgMainArtElement extends BaseCanvasElement {
  type: "SVG_MAIN_ART";
  svgMarkup: string;
  /** pt — the physical line weight it prints at, regardless of the source art's internal viewBox scale (see SvgNormalizer). */
  strokeWeight: number;
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
 * How a traceable letter/word is painted: filled solid (a model to copy),
 * a hollow outline, or a dashed/dotted stroke-only outline (the classic
 * "trace me" look). Shared by LetterGuideElement, TracingGridElement, and
 * any future text-tracing component — see src/lib/fontEngine.ts.
 */
export type TraceStyle = "solid" | "hollow" | "dashed" | "dotted";

/** Which characters a tracing/guide component draws from — see resolveCharacters() in fontEngine.ts. */
export type CharacterSet = "latin-upper" | "latin-lower" | "greek-upper" | "greek-lower";

/**
 * A large single-letter tracing guide with author-placed stroke-order
 * arrows. Arrow positions are authored by hand (like any other canvas
 * object), not derived from font glyph data — genuinely correct handwriting
 * stroke order requires a curated per-letter/per-font dataset that's out of
 * scope here; this renders whatever the author places.
 */
export interface LetterGuideElement extends BaseCanvasElement {
  type: "LETTER_GUIDE";
  letter: string; // single character — Latin or Greek
  fontFamily: string;
  guideStyle: TraceStyle;
  strokeArrows: StrokeOrderArrow[];
}

/**
 * A multi-row practice grid: each row has a top line, a dashed midline, and
 * a baseline, with the letter repeated across the row (first instance solid
 * as a model, the rest in `traceStyle` for tracing) — the classic "trace
 * the line, then write it yourself" layout.
 */
export interface TracingGridElement extends BaseCanvasElement {
  type: "TRACING_GRID";
  letter: string;
  fontFamily: string;
  traceStyle: TraceStyle;
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

/** A cluster of small secondary coloring illustrations (right page filler art). */
export interface SvgMiniGroupElement extends BaseCanvasElement {
  type: "SVG_MINI_GROUP";
  items: SvgMiniItem[];
  strokeWeight: number; // pt
}

export interface DotToDotVertex {
  /** Inches, relative to the DotToDotElement's own box. */
  x: number;
  y: number;
}

/**
 * A numbered dot-to-dot activity. `vertices` are pre-resolved, ordered
 * points — see samplePathToVertices() in DotToDotGenerator.tsx for the
 * authoring-time helper that derives them from an SVG path.
 */
export interface DotToDotElement extends BaseCanvasElement {
  type: "DOT_TO_DOT";
  vertices: DotToDotVertex[];
  /** Editor-only faint guide connecting the dots; never shown in print export. */
  showPreviewPath: boolean;
  dotRadius: number; // inches
}

/**
 * Schema placeholder only — maze generation/rendering is not implemented in
 * this pass (a real maze generator is a substantial algorithmic component
 * in its own right). Included so BookState can round-trip a maze page
 * authored by a future tool without losing data.
 */
export interface MazeGridElement extends BaseCanvasElement {
  type: "MAZE_GRID";
  cols: number;
  rows: number;
  seed?: string;
}

/**
 * A word search grid. `grid`/`placements` are pre-resolved (generated once,
 * deterministically, from `words`+`seed`) and stored — see
 * generateWordSearch() in src/lib/wordSearchGenerator.ts — so re-rendering
 * or exporting never reruns the placement algorithm and risks a different
 * layout.
 */
export interface WordSearchElement extends BaseCanvasElement {
  type: "WORD_SEARCH";
  words: string[];
  gridSize: number;
  grid: string[][];
  placements: WordSearchPlacement[];
  unplacedWords: string[];
}

export interface WordSearchPlacement {
  word: string;
  row: number;
  col: number;
  directionRow: number; // -1 | 0 | 1
  directionCol: number; // -1 | 0 | 1
}

export interface ColorByNumberZone {
  id: string;
  number: number;
  colorHex: string;
  /** Inches, relative to the element's own box — where the number label is drawn. */
  labelX: number;
  labelY: number;
}

/**
 * A coloring page with numbered regions and a color key. `outlineSvgMarkup`
 * is the already-cleaned, fill-none line art (what actually prints as the
 * blank page); `zones` were extracted from the tagged source art once at
 * authoring time — see extractColorByNumberZones() in
 * src/lib/colorByNumberEngine.ts for the tagging convention.
 */
export interface ColorByNumberElement extends BaseCanvasElement {
  type: "COLOR_BY_NUMBER";
  outlineSvgMarkup: string;
  zones: ColorByNumberZone[];
  showColorKey: boolean;
}

export interface CountingGroup {
  id: string;
  /** Pre-normalized (stroke-only) single icon, repeated `count` times. */
  iconSvgMarkup: string;
  count: number;
  /** Inches, relative to the CountingActivityElement's own box. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Auto-generated counting/matching worksheet: N icons per group, with an optional answer box to write the count. */
export interface CountingActivityElement extends BaseCanvasElement {
  type: "COUNTING_ACTIVITY";
  groups: CountingGroup[];
  showAnswerBox: boolean;
}

export type CanvasElement =
  | TitleTextElement
  | SvgMainArtElement
  | LetterGuideElement
  | TracingGridElement
  | SvgMiniGroupElement
  | DotToDotElement
  | MazeGridElement
  | WordSearchElement
  | ColorByNumberElement
  | CountingActivityElement;

export interface PageContent {
  id: string;
  elements: CanvasElement[];
  backgroundColor?: string; // hex; defaults to white
}

/** One physical sheet as it will be bound: a left page and a right page. */
export interface PageSpread {
  id: string;
  spreadNumber: number;
  leftPage: PageContent;
  rightPage: PageContent;
}

export type BookColorMode = "RGB" | "CMYK";

/**
 * KDP interior print specification. Defaults in kdpPrintSpec.ts match
 * Amazon KDP's published guidelines for an 8.5x11in paperback:
 *  - bleed: 0.125in on every bleeding edge
 *  - gutter: extra inner margin near the spine, scales with page count —
 *    0.375in is a safe default for books under ~150 pages
 *  - outerMarginIn: KDP's minimum non-gutter margin (top/bottom/outside)
 *    — not explicitly requested in the original spec, but required by KDP
 *    for content to be accepted; included so this spec is actually usable.
 */
export interface KdpPrintSpec {
  trimWidthIn: number;
  trimHeightIn: number;
  bleedIn: number;
  gutterIn: number;
  outerMarginIn: number;
  dpi: number;
  /** Default stroke weight (pt) suggested to new elements — the historical field name predates the pt-based convention above; the value itself has always meant physical thickness, not CSS pixels. */
  globalStrokeWeightPx: number;
  colorMode: BookColorMode;
}

export interface BookState {
  id: string;
  title: string;
  author?: string;
  printSpec: KdpPrintSpec;
  spreads: PageSpread[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

export type PaperType = "white" | "cream";

export interface CoverSpec {
  paperType: PaperType;
  pageCount: number;
  includeIsbnZone: boolean;
  backCoverColor: string; // hex
  frontCoverColor: string; // hex
  spineColor: string; // hex
}

export interface CoverElementBase {
  id: string;
  /** Which panel this element belongs to — purely organizational; x/y below are already in full-cover coordinates. */
  panel: "back" | "spine" | "front";
}

export type CoverElement =
  | (CoverElementBase & { kind: "text" } & Omit<TitleTextElement, "id" | "type">)
  | (CoverElementBase & { kind: "art" } & Omit<SvgMainArtElement, "id" | "type">);

export interface CoverState {
  spec: CoverSpec;
  elements: CoverElement[];
}

// ---------------------------------------------------------------------------
// Book Wizard
// ---------------------------------------------------------------------------

export interface BookWizardConfig {
  topic: string;
  characterSet: CharacterSet;
  traceStyle: TraceStyle;
  fontFamily: string;
  rows: number;
  repeatsPerRow: number;
}

/** One character's worth of seed content a ContentProvider supplies to the wizard. */
export interface WizardLetterContent {
  character: string;
  vocabWord: string;
  /**
   * Real, ready-to-place line art for this character, or `null` when no
   * curated/generated art exists yet — the wizard renders a clearly labeled
   * placeholder in that case rather than fabricating unrelated art. See
   * src/lib/contentProvider.ts.
   */
  svgMarkup: string | null;
}
