import { inchesToPx, ptToInches, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import { calculateCoverDimensions, ISBN_ZONE_HEIGHT_IN, ISBN_ZONE_MARGIN_IN, ISBN_ZONE_WIDTH_IN } from "@/lib/coverSpec";
import type { CoverElement, CoverState, KdpPrintSpec } from "@/types/kdpBook";
import SvgNormalizer from "@/components/kdp-editor/SvgNormalizer";

export interface CoverCanvasProps {
  cover: CoverState;
  printSpec: KdpPrintSpec;
  pxPerInch?: number;
  showGuides?: boolean;
}

const SPINE_FOLD_SAFETY_IN = 0.125; // extra clearance from each spine fold, beyond the normal safe margin

function CoverElementView({ element, pxPerInch }: { element: CoverElement; pxPerInch: number }) {
  const style = {
    position: "absolute" as const,
    left: inchesToPx(element.x, pxPerInch),
    top: inchesToPx(element.y, pxPerInch),
    width: inchesToPx(element.width, pxPerInch),
    height: inchesToPx(element.height, pxPerInch),
  };

  if (element.kind === "text") {
    return (
      <div style={style}>
        <span
          style={{
            display: "block",
            fontFamily: element.fontFamily,
            fontSize: inchesToPx(ptToInches(element.fontSize), pxPerInch),
            color: element.fill,
            textAlign: element.align,
          }}
        >
          {element.text}
        </span>
      </div>
    );
  }

  return (
    <SvgNormalizer
      svgMarkup={element.svgMarkup}
      strokeWeightPt={element.strokeWeight}
      targetWidthIn={element.width}
      targetHeightIn={element.height}
      style={style}
    />
  );
}

/** Renders the full wraparound cover (back + spine + front) as one continuous canvas, matching how KDP expects a single cover PDF. */
export default function CoverCanvas({ cover, printSpec, pxPerInch = SCREEN_PX_PER_INCH, showGuides = true }: CoverCanvasProps) {
  const dims = calculateCoverDimensions(printSpec, cover.spec);
  const { bleedIn, outerMarginIn } = printSpec;

  const widthPx = inchesToPx(dims.fullBleedWidthIn, pxPerInch);
  const heightPx = inchesToPx(dims.fullBleedHeightIn, pxPerInch);

  const backSafe = {
    left: inchesToPx(bleedIn + outerMarginIn, pxPerInch),
    right: inchesToPx(dims.fullBleedWidthIn - dims.spineX - SPINE_FOLD_SAFETY_IN, pxPerInch),
  };
  const frontSafe = {
    left: inchesToPx(dims.frontCoverX + SPINE_FOLD_SAFETY_IN, pxPerInch),
    right: inchesToPx(dims.fullBleedWidthIn - bleedIn - outerMarginIn, pxPerInch),
  };
  const safeTop = inchesToPx(bleedIn + outerMarginIn, pxPerInch);
  const safeBottom = inchesToPx(dims.fullBleedHeightIn - bleedIn - outerMarginIn, pxPerInch);

  return (
    <div className="relative overflow-hidden shadow-2xl" style={{ width: widthPx, height: heightPx }}>
      {/* Panel background fills */}
      <div
        className="absolute top-0"
        style={{ left: 0, width: inchesToPx(dims.spineX, pxPerInch), height: heightPx, backgroundColor: cover.spec.backCoverColor }}
      />
      <div
        className="absolute top-0"
        style={{ left: inchesToPx(dims.spineX, pxPerInch), width: inchesToPx(dims.spineWidthIn, pxPerInch), height: heightPx, backgroundColor: cover.spec.spineColor }}
      />
      <div
        className="absolute top-0"
        style={{ left: inchesToPx(dims.frontCoverX, pxPerInch), right: 0, height: heightPx, backgroundColor: cover.spec.frontCoverColor }}
      />

      {cover.elements.map((el) => (
        <CoverElementView key={el.id} element={el} pxPerInch={pxPerInch} />
      ))}

      {cover.spec.includeIsbnZone && (
        <div
          className="absolute flex items-center justify-center border border-slate-400 bg-white/90 text-[10px] text-slate-400"
          style={{
            width: inchesToPx(ISBN_ZONE_WIDTH_IN, pxPerInch),
            height: inchesToPx(ISBN_ZONE_HEIGHT_IN, pxPerInch),
            right: inchesToPx(printSpec.bleedIn + ISBN_ZONE_MARGIN_IN, pxPerInch),
            bottom: inchesToPx(printSpec.bleedIn + ISBN_ZONE_MARGIN_IN, pxPerInch),
          }}
        >
          ISBN barcode zone
        </div>
      )}

      {showGuides && (
        <>
          <div className="pointer-events-none absolute border border-dashed border-red-400/70" style={{ inset: 0 }} aria-hidden />
          <div
            className="pointer-events-none absolute border border-dashed border-slate-500/50"
            style={{
              left: inchesToPx(bleedIn, pxPerInch),
              right: inchesToPx(bleedIn, pxPerInch),
              top: inchesToPx(bleedIn, pxPerInch),
              bottom: inchesToPx(bleedIn, pxPerInch),
            }}
            aria-hidden
          />
          {/* Spine fold lines */}
          <div
            className="pointer-events-none absolute border-l border-dashed border-slate-500/70"
            style={{ left: inchesToPx(dims.spineX, pxPerInch), top: 0, bottom: 0 }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute border-l border-dashed border-slate-500/70"
            style={{ left: inchesToPx(dims.frontCoverX, pxPerInch), top: 0, bottom: 0 }}
            aria-hidden
          />
          {/* Safe zone, back panel */}
          <div
            className="pointer-events-none absolute border border-dashed border-sky-400/70"
            style={{ left: backSafe.left, right: widthPx - backSafe.right, top: safeTop, bottom: heightPx - safeBottom }}
            aria-hidden
          />
          {/* Safe zone, front panel */}
          <div
            className="pointer-events-none absolute border border-dashed border-sky-400/70"
            style={{ left: frontSafe.left, right: widthPx - frontSafe.right, top: safeTop, bottom: heightPx - safeBottom }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
