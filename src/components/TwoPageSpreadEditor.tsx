import type { CSSProperties } from "react";
import { cn } from "@/utils/cn";
import type { BookSettings, CanvasElement, PageData, PageSpread } from "@/types/book";
import SvgNormalizer from "@/components/SvgNormalizer";
import TracingGrid from "@/components/TracingGrid";
import LetterGuide from "@/components/LetterGuide";
import DotToDotGenerator from "@/components/DotToDotGenerator";
import SvgMiniGroup from "@/components/SvgMiniGroup";

export interface TwoPageSpreadEditorProps {
  spread: PageSpread;
  settings: BookSettings;
  /** Bleed/gutter guide overlays — screen only, never part of the printed page. */
  showGuides?: boolean;
  className?: string;
}

/** Composes rotation with an optional content mirror (flipX/flipY) into one transform, in the order flip-then-rotate so a rotated+flipped element still reads correctly (CSS applies transforms right-to-left). */
function buildTransform(element: CanvasElement): string | undefined {
  const parts: string[] = [];
  if (element.rotation) parts.push(`rotate(${element.rotation}deg)`);
  if (element.flipX || element.flipY) parts.push(`scale(${element.flipX ? -1 : 1}, ${element.flipY ? -1 : 1})`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function renderElement(element: CanvasElement) {
  const positionStyle: CSSProperties = {
    position: "absolute",
    left: `${element.x}in`,
    top: `${element.y}in`,
    transform: buildTransform(element),
    transformOrigin: "center",
  };

  switch (element.type) {
    case "TITLE_TEXT":
      return (
        <div key={element.id} style={{ ...positionStyle, width: `${element.width}in` }}>
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

    case "SVG_MAIN_ART":
      return (
        <SvgNormalizer
          key={element.id}
          src={element.svgMarkup}
          strokeWidthPt={element.strokeWidth}
          targetWidthIn={element.width}
          targetHeightIn={element.height}
          style={positionStyle}
        />
      );

    case "SVG_MINI_GROUP":
      return (
        <div key={element.id} style={{ ...positionStyle, width: `${element.width}in`, height: `${element.height}in` }}>
          <SvgMiniGroup widthIn={element.width} heightIn={element.height} items={element.items} strokeWidthPt={element.strokeWidth} />
        </div>
      );

    case "LETTER_GUIDE":
      return (
        <div key={element.id} style={positionStyle}>
          <LetterGuide
            widthIn={element.width}
            heightIn={element.height}
            letter={element.letter}
            fontFamily={element.fontFamily}
            guideStyle={element.guideStyle}
            strokeArrows={element.strokeArrows}
          />
        </div>
      );

    case "TRACING_GRID":
      return (
        <div key={element.id} style={positionStyle}>
          <TracingGrid
            widthIn={element.width}
            heightIn={element.height}
            letter={element.letter}
            fontFamily={element.fontFamily}
            rows={element.rows}
            repeatsPerRow={element.repeatsPerRow}
            firstInstanceSolid={element.firstInstanceSolid}
          />
        </div>
      );

    case "DOT_TO_DOT":
      return (
        <div key={element.id} style={positionStyle}>
          <DotToDotGenerator
            widthIn={element.width}
            heightIn={element.height}
            vertices={element.vertices}
            dotRadius={element.dotRadius}
            showPreviewPath={element.showPreviewPath}
          />
        </div>
      );

    default:
      return null;
  }
}

function Page({
  page,
  side,
  settings,
  showGuides,
}: {
  page: PageData;
  side: "left" | "right";
  settings: BookSettings;
  showGuides: boolean;
}) {
  const { trimWidthIn, trimHeightIn, bleedIn, gutterIn } = settings;

  return (
    <div
      className="relative shrink-0 shadow-lg"
      style={{ width: `${trimWidthIn}in`, height: `${trimHeightIn}in`, backgroundColor: page.backgroundColor ?? "#ffffff" }}
    >
      {/* Content is clipped to the page bounds here, on an inner wrapper —
          NOT on this outer container, which the bleed guide below needs to
          render outside of (via a negative inset). Clipping the container
          itself would silently clip the guide away too. */}
      <div className="absolute inset-0 overflow-hidden">{page.elements.map(renderElement)}</div>

      {showGuides && (
        <>
          {/* Bleed: content should extend to here on any bleeding edge — anything short of it risks a white sliver after trimming. */}
          <div className="pointer-events-none absolute border border-dashed border-red-400/70" style={{ inset: `-${bleedIn}in` }} aria-hidden />
          {/* Gutter: the extra inner margin near the spine — keep important content clear of it. */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-0 border-r border-dashed border-sky-400/70"
            style={side === "left" ? { right: `${gutterIn}in` } : { left: `${gutterIn}in` }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}

/**
 * Renders one physical spread (left + right page) at true relative size,
 * with KDP bleed/gutter guide overlays. A pure layout renderer driven by
 * `spread` data — no built-in drag/select/edit interaction.
 */
export default function TwoPageSpreadEditor({ spread, settings, showGuides = true, className }: TwoPageSpreadEditorProps) {
  return (
    <div className={cn("inline-flex gap-px bg-slate-900 p-8 shadow-2xl", className)}>
      <Page page={spread.leftPage} side="left" settings={settings} showGuides={showGuides} />
      <Page page={spread.rightPage} side="right" settings={settings} showGuides={showGuides} />
    </div>
  );
}
