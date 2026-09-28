// Pagewright data model — scoped entirely to src/components/studio/*.
//
// Deliberately separate from src/types/book.ts (the earlier SVG print
// module's BookState/PageSpread/CanvasElement). The two model genuinely
// different things despite similar-sounding names: that module composes
// print-ready pages from typed elements (TITLE_TEXT, TRACING_GRID, ...)
// with no freehand drawing at all; this one models a layered drawing
// surface (Draw/Color/Assemble modes, pointer-pressure pen, flood fill)
// that doesn't exist there. Reusing one for the other would force an
// awkward, inaccurate fit in both directions — matches the "new,
// self-contained module" decision already made for this whole handoff.
//
// Shape transcribed directly from the README's "State" section.

export type EditorMode = "draw" | "color" | "assemble";

export type ToolId = "select" | "shape" | "pen" | "mask" | "fill" | "eraser" | "reorder" | "insert" | "ai";

export type LayerKind = "lineart" | "flat" | "texture" | "guides";

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  /** 0-100. */
  opacity: number;
  locked: boolean;
  visible: boolean;
  /** Swatch shown next to the layer name in the Layers card — a real thumbnail later, a flat color for now (see Thumbnail's striped-placeholder note for the same "no art supplied" reasoning). */
  previewColor: string;
}

export type PageKind = "art" | "blank" | "cover";

export interface BookPage {
  id: string;
  kind: PageKind;
  /** Image slot — undefined renders the striped placeholder (see ui/Thumbnail.tsx's PLACEHOLDER_ART_PATTERN). No generated SVG art per the handoff's fidelity rule. */
  artRef?: string;
  layers: Layer[];
  flags: string[];
}

export interface TrimSize {
  widthIn: number;
  heightIn: number;
  label: string; // e.g. "8.5x11 IN" — the mono line in the top bar wants a pre-formatted string, not a computed one, since KDP/spiral/digital trims each have their own conventional label
}

export interface Book {
  id: string;
  title: string;
  trimSize: TrimSize;
  bleedIn: number;
  binding: "perfect" | "spiral" | "saddle-stitch" | "digital";
  pages: BookPage[];
}

export interface PaletteSwatch {
  hex: string;
  cmyk: [number, number, number, number];
}

export interface Palette {
  id: string;
  name: string;
  swatches: PaletteSwatch[];
  usageCount: number;
}

export interface EditorState {
  mode: EditorMode;
  activeTool: ToolId;
  strokeWidthPt: number;
  smoothingPct: number;
  symmetry: boolean;
  zoom: number;
  activePageId: string;
  activeLayerId: string;
  activeSwatchHex: string;
}
