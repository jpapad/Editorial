import SvgNormalizer from "@/components/SvgNormalizer";
import { GridOverlay } from "@/components/GridDrawingComponent";

export interface SymmetryGridBuilderProps {
  /** Same thing SvgNormalizer accepts: a URL/data-URI to fetch, or raw `"<svg>...</svg>"` markup. Should be roughly symmetric art — a lopsided source will produce a lopsided (but still technically valid) activity. */
  svgMarkup: string;
  widthIn: number;
  heightIn: number;
  axis?: "vertical" | "horizontal";
  /** Grid resolution of EACH half (not the whole box). */
  gridCols?: number;
  gridRows?: number;
  strokeWidthPt?: number;
}

const MIRROR_LINE_COLOR = "#f87171"; // red-400 — matches the bleed-guide red used elsewhere, reads as "cut/fold line here"

/**
 * Shows ONE half of a source illustration with a reference grid overlaid,
 * a dashed mirror axis down the middle, and a matching blank grid on the
 * other half — the classic "draw the other half of the picture" symmetry
 * activity. Reuses GridDrawingComponent's GridOverlay (same reference-
 * grid-plus-blank-grid idea, just split down a mirror axis instead of
 * enlarged for a copy activity) rather than a second implementation of
 * grid-line drawing — including its alignment-sensitive sizing/offset
 * math, which is easy to get subtly wrong (see gridOverlayToSvgMarkup's
 * own notes on that).
 *
 * The "half" is produced by clipping, not by cutting the source SVG's
 * geometry in two: the art renders at its FULL target size inside a box
 * exactly half as wide (or tall), so only that half is visible — the
 * source SVG itself is never modified. This only works well for art
 * that's already reasonably symmetric around the chosen axis; nothing
 * here can verify that automatically.
 */
export default function SymmetryGridBuilder({
  svgMarkup,
  widthIn,
  heightIn,
  axis = "vertical",
  gridCols = 4,
  gridRows = 4,
  strokeWidthPt = 3,
}: SymmetryGridBuilderProps) {
  const isVertical = axis === "vertical";
  const halfWidthIn = isVertical ? widthIn / 2 : widthIn;
  const halfHeightIn = isVertical ? heightIn : heightIn / 2;

  return (
    <div
      className={`relative flex ${isVertical ? "flex-row" : "flex-col"} items-center`}
      style={{ width: `${widthIn}in`, height: `${heightIn}in` }}
      role="img"
      aria-label="Symmetry drawing activity: complete the mirror image on the blank half"
    >
      {/* Reference half: the source art clipped to exactly one half of its own box, with a grid on top for cell-by-cell copying. */}
      <div className="relative overflow-hidden" style={{ width: `${halfWidthIn}in`, height: `${halfHeightIn}in` }}>
        <div style={{ width: `${widthIn}in`, height: `${heightIn}in` }}>
          <SvgNormalizer src={svgMarkup} strokeWidthPt={strokeWidthPt} targetWidthIn={widthIn} targetHeightIn={heightIn} />
        </div>
        <GridOverlay widthIn={halfWidthIn} heightIn={halfHeightIn} cols={gridCols} rows={gridRows} />
      </div>

      {/* Dashed mirror axis. */}
      <div
        className="shrink-0 border-dashed"
        style={
          isVertical
            ? { borderLeftWidth: "1.5pt", borderColor: MIRROR_LINE_COLOR, height: `${heightIn}in` }
            : { borderTopWidth: "1.5pt", borderColor: MIRROR_LINE_COLOR, width: `${widthIn}in` }
        }
        aria-hidden
      />

      {/* Blank half: same grid, no art — where the child draws the missing mirror image. */}
      <div className="relative border border-dashed border-slate-300" style={{ width: `${halfWidthIn}in`, height: `${halfHeightIn}in` }}>
        <GridOverlay widthIn={halfWidthIn} heightIn={halfHeightIn} cols={gridCols} rows={gridRows} />
      </div>
    </div>
  );
}
