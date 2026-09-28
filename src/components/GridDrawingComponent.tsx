import SvgNormalizer from "@/components/SvgNormalizer";

export interface GridDrawingComponentProps {
  /** Same thing SvgNormalizer accepts: a URL/data-URI to fetch, or raw `"<svg>...</svg>"` markup. */
  svgMarkup: string;
  /** Size of the small reference box (with the art visible, grid overlaid). */
  referenceWidthIn: number;
  referenceHeightIn: number;
  /** How much bigger the blank practice grid is than the reference — e.g. 2 doubles both dimensions. */
  practiceScale?: number;
  gridCols: number;
  gridRows: number;
  strokeWidthPt?: number;
  gapIn?: number;
}

const GRID_LINE_COLOR = "#94a3b8"; // slate-400
const LABEL_COLOR = "#64748b"; // slate-500
const HAIRLINE = 0.008;
const LABEL_MARGIN_IN = 0.18;

const COLUMN_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Pure SVG-string builder for the grid overlay — kept separate from the
 * component (same split TracingGrid uses for its *ToSvgMarkup companion)
 * so the grid lines can be produced without a browser DOMParser, and so
 * reference/practice grids can't visually drift apart from sharing one
 * layout function.
 */
export function gridOverlayToSvgMarkup(widthIn: number, heightIn: number, cols: number, rows: number, labeled: boolean): string {
  const cellW = widthIn / cols;
  const cellH = heightIn / rows;
  const lines: string[] = [];

  for (let c = 0; c <= cols; c++) {
    const x = c * cellW;
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${heightIn}" stroke="${GRID_LINE_COLOR}" stroke-width="${HAIRLINE}" />`);
  }
  for (let r = 0; r <= rows; r++) {
    const y = r * cellH;
    lines.push(`<line x1="0" y1="${y}" x2="${widthIn}" y2="${y}" stroke="${GRID_LINE_COLOR}" stroke-width="${HAIRLINE}" />`);
  }

  const labels: string[] = [];
  if (labeled) {
    const fontSize = Math.min(cellW, cellH) * 0.22;
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + cellW / 2;
      labels.push(
        `<text x="${x}" y="${-fontSize * 0.4}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${LABEL_COLOR}">${COLUMN_LABELS[c % COLUMN_LABELS.length]}</text>`
      );
    }
    for (let r = 0; r < rows; r++) {
      const y = r * cellH + cellH / 2;
      labels.push(
        `<text x="${-fontSize * 0.6}" y="${y + fontSize * 0.35}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${LABEL_COLOR}">${r + 1}</text>`
      );
    }
  }

  // viewBox and width/height must describe the SAME physical size (1 user
  // unit = 1in) so the grid lines land exactly on the art beneath them —
  // if the viewBox were larger than the width/height attributes (e.g. to
  // "make room" for the labels) the browser would scale the whole thing
  // down to fit, throwing the grid out of alignment with the underlying
  // SvgNormalizer art, which is sized to widthIn x heightIn with no such
  // scale-down. Room for labels instead comes from the negative viewBox
  // origin below, matched by GridOverlay's outer size/offset.
  const boxW = widthIn + LABEL_MARGIN_IN;
  const boxH = heightIn + LABEL_MARGIN_IN;
  // Units matter here, unlike TracingGrid's tracingGridToSvgMarkup (which
  // stays unitless for PDFKit embedding): this function's only caller
  // right now is GridOverlay below, which injects the string straight
  // into the browser DOM via dangerouslySetInnerHTML. A bare number on an
  // SVG width/height attribute means CSS px, not inches — that silently
  // shrank the whole overlay to a couple of visible pixels the first time
  // this ran. Kept the physical widthIn/heightIn units so this still
  // renders correctly if reused as a PDFKit-embedded companion later.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-LABEL_MARGIN_IN} ${-LABEL_MARGIN_IN} ${boxW} ${boxH}" width="${boxW}in" height="${boxH}in" overflow="visible">${lines.join("")}${labels.join("")}</svg>`;
}

/** Exported so SymmetryGridBuilder can reuse the exact same alignment-correct overlay technique instead of re-deriving it (see gridOverlayToSvgMarkup's unit/margin notes above — easy to get subtly wrong). */
export function GridOverlay({ widthIn, heightIn, cols, rows }: { widthIn: number; heightIn: number; cols: number; rows: number }) {
  const markup = gridOverlayToSvgMarkup(widthIn, heightIn, cols, rows, true);
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: `-${LABEL_MARGIN_IN}in`, top: `-${LABEL_MARGIN_IN}in`, width: `${widthIn + LABEL_MARGIN_IN}in`, height: `${heightIn + LABEL_MARGIN_IN}in` }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

/**
 * A "copy the picture, square by square" grid activity: a small reference
 * box shows the source art with a lettered/numbered grid overlaid, and a
 * larger blank grid (same cell count, `practiceScale`x the size) sits next
 * to it for the child to redraw each cell freehand. Genuine per-pixel
 * rasterization/sampling of arbitrary SVG art is out of scope — this
 * overlays a real reference grid on the actual art instead, which is the
 * standard version of this activity in printed workbooks.
 */
export default function GridDrawingComponent({
  svgMarkup,
  referenceWidthIn,
  referenceHeightIn,
  practiceScale = 2,
  gridCols,
  gridRows,
  strokeWidthPt = 3,
  gapIn = 0.5,
}: GridDrawingComponentProps) {
  const practiceWidthIn = referenceWidthIn * practiceScale;
  const practiceHeightIn = referenceHeightIn * practiceScale;
  const totalHeightIn = Math.max(referenceHeightIn, practiceHeightIn);

  return (
    <div
      className="relative flex items-start"
      style={{ width: `${referenceWidthIn + gapIn + practiceWidthIn}in`, height: `${totalHeightIn}in`, gap: `${gapIn}in` }}
      role="img"
      aria-label="Grid copy activity: redraw the reference picture square by square"
    >
      <div className="relative" style={{ width: `${referenceWidthIn}in`, height: `${referenceHeightIn}in` }}>
        <SvgNormalizer src={svgMarkup} strokeWidthPt={strokeWidthPt} targetWidthIn={referenceWidthIn} targetHeightIn={referenceHeightIn} />
        <GridOverlay widthIn={referenceWidthIn} heightIn={referenceHeightIn} cols={gridCols} rows={gridRows} />
      </div>

      <div className="relative border border-dashed border-slate-300" style={{ width: `${practiceWidthIn}in`, height: `${practiceHeightIn}in` }}>
        <GridOverlay widthIn={practiceWidthIn} heightIn={practiceHeightIn} cols={gridCols} rows={gridRows} />
      </div>
    </div>
  );
}
