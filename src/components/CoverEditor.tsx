import type { CSSProperties } from "react";
import type { BookSettings } from "@/types/book";
import SvgNormalizer from "@/components/SvgNormalizer";
import {
  calculateCoverDimensions,
  COVER_SAFE_MARGIN_IN,
  ISBN_ZONE_HEIGHT_IN,
  ISBN_ZONE_MARGIN_IN,
  ISBN_ZONE_WIDTH_IN,
  SPINE_FOLD_SAFETY_IN,
  type CoverElement,
  type CoverState,
} from "@/utils/kdpMath";

export interface CoverEditorProps {
  cover: CoverState;
  settings: BookSettings;
  /** Bleed/safe-zone/ISBN guide overlays — screen only, never part of the printed cover. */
  showGuides?: boolean;
}

function CoverElementView({ element }: { element: CoverElement }) {
  const style: CSSProperties = {
    position: "absolute",
    left: `${element.x}in`,
    top: `${element.y}in`,
    width: `${element.width}in`,
    height: `${element.height}in`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
  };

  if (element.kind === "text") {
    return (
      <div style={style}>
        <span
          style={{
            display: "block",
            fontFamily: element.fontFamily,
            fontSize: `${element.fontSize}pt`,
            color: element.fill,
            textAlign: element.align,
          }}
        >
          {element.text}
        </span>
      </div>
    );
  }

  return <SvgNormalizer src={element.svgMarkup} strokeWidthPt={element.strokeWidth} targetWidthIn={element.width} targetHeightIn={element.height} style={style} />;
}

/**
 * Renders the full wraparound cover (back + spine + front) as one
 * continuous canvas, matching how KDP expects a single cover PDF — not
 * three separate images. Bleed only applies to the top/bottom/two outer
 * edges; the spine is a fold, never a cut, so it never bleeds.
 */
export default function CoverEditor({ cover, settings, showGuides = true }: CoverEditorProps) {
  const dims = calculateCoverDimensions(settings, cover.spec.pageCount, cover.spec.paperType);
  const { bleedIn } = settings;

  return (
    <div
      className="relative overflow-hidden shadow-2xl"
      style={{ width: `${dims.fullBleedWidthIn}in`, height: `${dims.fullBleedHeightIn}in` }}
    >
      {/* Panel background fills */}
      <div className="absolute top-0 h-full" style={{ left: 0, width: `${dims.spineX}in`, backgroundColor: cover.spec.backCoverColor }} />
      <div
        className="absolute top-0 h-full"
        style={{ left: `${dims.spineX}in`, width: `${dims.spineWidthIn}in`, backgroundColor: cover.spec.spineColor }}
      />
      <div className="absolute top-0 h-full" style={{ left: `${dims.frontCoverX}in`, right: 0, backgroundColor: cover.spec.frontCoverColor }} />

      {/* Content is clipped to the cover bounds on an inner wrapper, not
          this outer container — the bleed guide below needs to render
          outside of it (negative inset), and clipping the container itself
          would silently clip that guide away too (see TwoPageSpreadEditor
          for the same fix applied there in Sprint 1). */}
      <div className="absolute inset-0 overflow-hidden">
        {cover.elements.map((element) => (
          <CoverElementView key={element.id} element={element} />
        ))}
      </div>

      {cover.spec.includeIsbnZone && (
        <div
          className="absolute flex items-center justify-center border border-slate-400 bg-white/90 text-center text-[9px] leading-tight text-slate-400"
          style={{
            width: `${ISBN_ZONE_WIDTH_IN}in`,
            height: `${ISBN_ZONE_HEIGHT_IN}in`,
            right: `${bleedIn + ISBN_ZONE_MARGIN_IN}in`,
            bottom: `${bleedIn + ISBN_ZONE_MARGIN_IN}in`,
          }}
        >
          ISBN barcode zone
          <br />
          (non-printable)
        </div>
      )}

      {showGuides && (
        <>
          {/* Bleed: content should extend to here on any bleeding edge. */}
          <div className="pointer-events-none absolute border border-dashed border-red-400/70" style={{ inset: `-${bleedIn}in` }} aria-hidden />
          {/* Back-cover safe zone. */}
          <div
            className="pointer-events-none absolute border border-dashed border-sky-400/70"
            style={{
              left: `${bleedIn + COVER_SAFE_MARGIN_IN}in`,
              width: `${dims.spineX - bleedIn - COVER_SAFE_MARGIN_IN - SPINE_FOLD_SAFETY_IN}in`,
              top: `${bleedIn + COVER_SAFE_MARGIN_IN}in`,
              bottom: `${bleedIn + COVER_SAFE_MARGIN_IN}in`,
            }}
            aria-hidden
          />
          {/* Front-cover safe zone. */}
          <div
            className="pointer-events-none absolute border border-dashed border-sky-400/70"
            style={{
              left: `${dims.frontCoverX + SPINE_FOLD_SAFETY_IN}in`,
              right: `${bleedIn + COVER_SAFE_MARGIN_IN}in`,
              top: `${bleedIn + COVER_SAFE_MARGIN_IN}in`,
              bottom: `${bleedIn + COVER_SAFE_MARGIN_IN}in`,
            }}
            aria-hidden
          />
          {/* Spine fold lines. */}
          <div className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-slate-500/70" style={{ left: `${dims.spineX}in` }} aria-hidden />
          <div className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-slate-500/70" style={{ left: `${dims.frontCoverX}in` }} aria-hidden />
        </>
      )}
    </div>
  );
}
