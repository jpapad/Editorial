import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import type { KdpPrintSpec, PageContent, PageSpread } from "@/types/kdpBook";
import CanvasElementRenderer from "@/components/kdp-editor/CanvasElementRenderer";

export interface TwoPageSpreadEditorProps {
  spread: PageSpread;
  printSpec: KdpPrintSpec;
  pxPerInch?: number;
  /** Show the bleed / trim / safe-margin guide overlays (screen only — never part of the printed page). */
  showGuides?: boolean;
}

function Page({
  page,
  side,
  printSpec,
  pxPerInch,
  showGuides,
}: {
  page: PageContent;
  side: "left" | "right";
  printSpec: KdpPrintSpec;
  pxPerInch: number;
  showGuides: boolean;
}) {
  const { trimWidthIn, trimHeightIn, bleedIn, gutterIn, outerMarginIn } = printSpec;
  const pageWidthPx = inchesToPx(trimWidthIn, pxPerInch);
  const pageHeightPx = inchesToPx(trimHeightIn, pxPerInch);
  const bleedPx = inchesToPx(bleedIn, pxPerInch);

  // The gutter (extra margin near the spine) sits on the inner edge of each
  // page — the right edge of the left page, the left edge of the right page.
  const insetLeft = inchesToPx(side === "left" ? outerMarginIn : gutterIn, pxPerInch);
  const insetRight = inchesToPx(side === "left" ? gutterIn : outerMarginIn, pxPerInch);
  const insetVertical = inchesToPx(outerMarginIn, pxPerInch);

  return (
    <div
      className="relative shrink-0 overflow-hidden shadow-lg"
      style={{ width: pageWidthPx, height: pageHeightPx, backgroundColor: page.backgroundColor ?? "#ffffff" }}
    >
      {page.elements.map((element) => (
        <CanvasElementRenderer key={element.id} element={element} pxPerInch={pxPerInch} />
      ))}

      {showGuides && (
        <>
          {/* Bleed: content in this zone extends past the trim edge and gets cut off — nothing important should stop short of it. */}
          <div
            className="pointer-events-none absolute border border-dashed border-red-400/70"
            style={{ inset: -bleedPx }}
            aria-hidden
          />
          {/* Safe area: keep text/important content inside this line, clear of the gutter and outer trim. */}
          <div
            className="pointer-events-none absolute border border-dashed border-sky-400/70"
            style={{ top: insetVertical, bottom: insetVertical, left: insetLeft, right: insetRight }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}

/**
 * Renders one physical spread (left + right page) at true relative size,
 * with KDP bleed/safe-margin guide overlays. Purely a layout renderer —
 * driven entirely by `spread` data, with no built-in drag/select/edit
 * interaction (that's a separate concern from the print-layout structure
 * this component is responsible for).
 */
export default function TwoPageSpreadEditor({
  spread,
  printSpec,
  pxPerInch = SCREEN_PX_PER_INCH,
  showGuides = true,
}: TwoPageSpreadEditorProps) {
  return (
    <div className="inline-flex gap-px bg-slate-900 p-8 shadow-2xl">
      <Page page={spread.leftPage} side="left" printSpec={printSpec} pxPerInch={pxPerInch} showGuides={showGuides} />
      <Page page={spread.rightPage} side="right" printSpec={printSpec} pxPerInch={pxPerInch} showGuides={showGuides} />
    </div>
  );
}
