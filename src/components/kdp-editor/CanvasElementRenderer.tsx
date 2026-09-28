import { inchesToPx, ptToInches, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import type { CanvasElement } from "@/types/kdpBook";
import SvgNormalizer from "@/components/kdp-editor/SvgNormalizer";
import TracingGrid from "@/components/kdp-editor/TracingGrid";
import LetterGuide from "@/components/kdp-editor/LetterGuide";
import DotToDotGenerator from "@/components/kdp-editor/DotToDotGenerator";
import WordSearchGrid from "@/components/kdp-editor/WordSearchGrid";
import ColorByNumberRenderer from "@/components/kdp-editor/ColorByNumberRenderer";
import CountingActivity from "@/components/kdp-editor/CountingActivity";

export interface CanvasElementRendererProps {
  element: CanvasElement;
  pxPerInch?: number;
}

/** Positions one CanvasElement on its page and dispatches to the renderer for its type. */
export default function CanvasElementRenderer({ element, pxPerInch = SCREEN_PX_PER_INCH }: CanvasElementRendererProps) {
  const positionStyle = {
    position: "absolute" as const,
    left: inchesToPx(element.x, pxPerInch),
    top: inchesToPx(element.y, pxPerInch),
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
  };

  switch (element.type) {
    case "TITLE_TEXT":
      return (
        <div style={{ ...positionStyle, width: inchesToPx(element.width, pxPerInch) }}>
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

    case "SVG_MAIN_ART":
      return (
        <SvgNormalizer
          svgMarkup={element.svgMarkup}
          strokeWeightPt={element.strokeWeight}
          targetWidthIn={element.width}
          targetHeightIn={element.height}
          pxPerInch={pxPerInch}
          style={positionStyle}
        />
      );

    case "LETTER_GUIDE":
      return (
        <div style={positionStyle}>
          <LetterGuide
            width={element.width}
            height={element.height}
            letter={element.letter}
            fontFamily={element.fontFamily}
            guideStyle={element.guideStyle}
            strokeArrows={element.strokeArrows}
            pxPerInch={pxPerInch}
          />
        </div>
      );

    case "TRACING_GRID":
      return (
        <div style={positionStyle}>
          <TracingGrid
            width={element.width}
            height={element.height}
            letter={element.letter}
            fontFamily={element.fontFamily}
            traceStyle={element.traceStyle}
            rows={element.rows}
            repeatsPerRow={element.repeatsPerRow}
            firstInstanceSolid={element.firstInstanceSolid}
            pxPerInch={pxPerInch}
          />
        </div>
      );

    case "SVG_MINI_GROUP":
      return (
        <div style={{ ...positionStyle, width: inchesToPx(element.width, pxPerInch), height: inchesToPx(element.height, pxPerInch) }}>
          {element.items.map((item) => (
            <SvgNormalizer
              key={item.id}
              svgMarkup={item.svgMarkup}
              strokeWeightPt={element.strokeWeight}
              targetWidthIn={item.width}
              targetHeightIn={item.height}
              pxPerInch={pxPerInch}
              style={{
                position: "absolute",
                left: inchesToPx(item.x, pxPerInch),
                top: inchesToPx(item.y, pxPerInch),
              }}
            />
          ))}
        </div>
      );

    case "DOT_TO_DOT":
      return (
        <div style={positionStyle}>
          <DotToDotGenerator
            width={element.width}
            height={element.height}
            vertices={element.vertices}
            showPreviewPath={element.showPreviewPath}
            dotRadius={element.dotRadius}
            pxPerInch={pxPerInch}
          />
        </div>
      );

    case "WORD_SEARCH":
      return (
        <div style={positionStyle}>
          <WordSearchGrid
            width={element.width}
            height={element.height}
            grid={element.grid}
            words={element.words}
            placements={element.placements}
            pxPerInch={pxPerInch}
          />
        </div>
      );

    case "COLOR_BY_NUMBER":
      return (
        <div style={positionStyle}>
          <ColorByNumberRenderer
            width={element.width}
            height={element.height}
            outlineSvgMarkup={element.outlineSvgMarkup}
            zones={element.zones}
            showColorKey={element.showColorKey}
            pxPerInch={pxPerInch}
          />
        </div>
      );

    case "COUNTING_ACTIVITY":
      return (
        <div style={positionStyle}>
          <CountingActivity
            width={element.width}
            height={element.height}
            groups={element.groups}
            showAnswerBox={element.showAnswerBox}
            pxPerInch={pxPerInch}
          />
        </div>
      );

    case "MAZE_GRID":
      return (
        <div
          style={{ ...positionStyle, width: inchesToPx(element.width, pxPerInch), height: inchesToPx(element.height, pxPerInch) }}
          className="flex items-center justify-center rounded border border-dashed border-slate-300 text-center text-xs text-slate-400"
        >
          Maze generator not yet implemented
          <br />({element.cols}×{element.rows})
        </div>
      );

    default:
      return null;
  }
}
