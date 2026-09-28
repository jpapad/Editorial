// Real KDP interior trim sizes — plain data, no side effects, safe to
// import from both the browser (Onboarding's picker, EditorShell) and
// Node (rasterPdfExporter.ts's Route Handler). The editor's own drawing
// canvas stays a fixed 595x842pt working surface (CanvasEditor.tsx) —
// changing THAT per book would mean threading page dimensions through
// dozens of call sites (Stage sizing, pointer math, print-margin overlay,
// stamp defaults, flood-fill's pixel buffers) for a benefit that only
// matters at final print output. Trim size is applied at export time
// instead: the exporter fits the captured page image into the chosen
// print page size (PDFKit's `fit`, letterboxed, never stretched/distorted)
// — a real, KDP-meaningful page-size difference in the PDF you get out,
// without touching the live editing surface's already-tested geometry.

export interface TrimSize {
  id: string;
  label: string;
  widthPt: number;
  heightPt: number;
}

// 1in = 72pt.
export const TRIM_SIZES: TrimSize[] = [
  { id: "8.5x11", label: "8.5 × 11 in (US Letter)", widthPt: 612, heightPt: 792 },
  { id: "8x10", label: "8 × 10 in", widthPt: 576, heightPt: 720 },
  { id: "6x9", label: "6 × 9 in", widthPt: 432, heightPt: 648 },
];

export const DEFAULT_TRIM_SIZE_ID = "8.5x11";

/** "8.5 × 11 in" — the label without its nickname, for tight spots. */
export function trimShortLabel(id: string | undefined): string {
  return getTrimSize(id).label.replace(/\s*\(.*\)\s*$/, "");
}

export function getTrimSize(id: string | undefined): TrimSize {
  return TRIM_SIZES.find((t) => t.id === id) ?? TRIM_SIZES.find((t) => t.id === DEFAULT_TRIM_SIZE_ID) ?? TRIM_SIZES[0];
}
