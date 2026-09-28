// Core data model for the coloring book editor.

// "fill" added for Color mode's raster bucket-fill (merged Pagewright
// editor) — a click paints a flood-filled region on the paint layer
// beneath the ink, rather than drawing a line.
// "brush" paints freehand on that same paint layer (under the ink, like a
// marker that can't cover the outlines).
export type DrawingTool = "pen" | "eraser" | "select" | "stamp" | "shape" | "text" | "fill" | "brush";

/** What the paint bucket lays down: flat color, or a two-tone pattern in that color. */
export type FillStyle = "solid" | "stars" | "stripes" | "dots" | "hearts";

export interface LineData {
  id: string;
  // A line is only ever produced by the pen (draws ink) or the eraser
  // (punches through ink via destination-out compositing).
  tool: Extract<DrawingTool, "pen" | "eraser">;
  strokeWidth: number;
  points: number[]; // flattened [x1, y1, x2, y2, ...], Konva's native Line format
}

// Every placeable object shares position/rotation/scale so a single
// Transformer instance can resize, rotate, and move any of them uniformly.
interface Placeable {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number; // negative = flipped horizontally (see EditorShell's flip handlers)
  scaleY: number; // negative = flipped vertically
  locked?: boolean; // can't be selected/moved on the canvas — only from the Layers list
  hidden?: boolean; // not rendered, so not exported either
  groupId?: string; // objects sharing a groupId select and move together
}

// "lineArt" runs Konva's Grayscale + Threshold filter pipeline on the image
// node (cached once, re-used every frame) to turn a photo/colored upload
// into printable black-and-white line art.
export type StampFilter = "none" | "lineArt";

export interface StampData extends Placeable {
  kind: "stamp";
  src: string; // image src — a data URI for built-in/uploaded SVG or PNG art
  filter?: StampFilter;
  threshold?: number; // 0-1, only meaningful when filter is "lineArt"
  isFrame?: boolean; // a page frame from the Frames picker — at most one per page, always kept at the back
  frameId?: string; // which frameLibrary frame, so the picker can show it as selected
}

// Every kind is drawn inside its own width x height box (see
// shapeGeometry.ts), so the shared Transformer/preflight/clamp math treats
// them all the same way. "line"/"arrow" are open strokes: they ignore `fill`.
export type ShapeKind = "rectangle" | "circle" | "triangle" | "star" | "heart" | "hexagon" | "line" | "arrow";

export interface ShapeData extends Placeable {
  kind: "shape";
  shapeKind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export type TextAlign = "left" | "center" | "right";

export interface TextData extends Placeable {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  align: TextAlign;
  fill: string;
  isDragging: boolean;
  outline?: boolean; // hollow "colorable" letters: white fill with a `fill`-colored outline
  dashed?: boolean; // tracing letters: a dashed outline only (worksheets)
}

// Everything a user can click-select, resize, rotate, and reorder on a page.
export type PageObject = StampData | ShapeData | TextData;

/** The canvas a page was drawn on, in points (see utils/pageGeometry.ts). Absent = the old fixed 595×842 canvas. */
export interface PageSpace {
  width: number;
  height: number;
  /** Canvas extending past the trim on every side (0 = no bleed). */
  bleed: number;
}

export interface BookPage {
  id: string;
  pageNumber: number;
  space?: PageSpace;
  lines: LineData[];
  objects: PageObject[]; // stamps/shapes/text, in z-order — index 0 is the back
  backgroundPatternId?: string | null; // preset tiled pattern behind everything else
  isCover?: boolean; // page 1 can be flagged as the book's front cover
  coverBackgroundColor?: string; // solid RGB fill, only used while isCover is true
  fillDataUrl?: string; // Color mode's raster paint layer (rasterFloodFill.ts), serialized as a PNG data URL so it survives page navigation/reload/autosave
  completedAt?: string; // the child tapped "I'm done!" in the coloring view — earns a sticker, shows in their gallery
  isBlankBack?: boolean; // an intentionally empty reverse side (single-sided coloring pages) — inserted/removed as a set by the filmstrip's "Blank backs" action
  thumbnailDataUrl?: string; // Low-res snapshot of the full rendered page (ink + fills + objects), captured on page-switch/export — real preview art for Library/Assemble instead of the striped placeholder
}

export type PageTemplate = "blank" | "storybook" | "border-frame" | "belongs-to" | "color-test" | "copyright";

/** Mirror drawing for the pen/eraser: every stroke is repeated across the page's center axes or rotated around its center. */
export type SymmetryMode = "off" | "mirror-x" | "mirror-y" | "quad" | "radial-6" | "radial-8";

// What the Sidebar has "armed" for the next canvas click to place.
export type PendingPlacement =
  | { kind: "stamp"; src: string; naturalSize?: { width: number; height: number }; filter?: StampFilter; threshold?: number }
  | { kind: "shape"; shapeKind: ShapeKind }
  | { kind: "text"; fontFamily: string; fontSize: number; fill?: string };

/** Any subset of a placed object's editable fields — one entry of a batched canvas update (a multi-object drag/transform commits as a single undo step). */
export type ObjectChanges = Partial<Omit<StampData, "kind" | "id">> & Partial<Omit<ShapeData, "kind" | "id">> & Partial<Omit<TextData, "kind" | "id">>;

export interface ObjectUpdate {
  id: string;
  changes: ObjectChanges;
}

/** KDP paper stock — sets the spine width (see utils/coverGeometry.ts). */
export type PaperType = "white" | "cream" | "color";

/**
 * The wrap-around paperback cover: one canvas spanning back + spine + front
 * (+ bleed). `spineWidth` records the spine it was laid out for, so content
 * can follow when the page count (and so the spine) changes.
 */
export interface CoverDesign {
  page: BookPage;
  spineWidth: number;
}
