import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import { computeTraceTextPaint } from "@/lib/fontEngine";
import type { StrokeOrderArrow, TraceStyle } from "@/types/kdpBook";

export interface LetterGuideProps {
  width: number; // inches
  height: number; // inches
  letter: string;
  fontFamily: string;
  guideStyle: TraceStyle;
  strokeArrows: StrokeOrderArrow[];
  pxPerInch?: number;
}

const ARROW_COLOR = "#4f46e5"; // indigo-600
const ARROW_PATH = "M -0.05 -0.35 L 0.05 -0.35 L 0.05 -0.15 L 0.11 -0.15 L 0 0 L -0.11 -0.15 L -0.05 -0.15 Z";

type LayoutProps = Omit<LetterGuideProps, "pxPerInch">;

/**
 * A large single-letter tracing guide with numbered stroke-order badges.
 * The letter itself is rendered as real `<text>`, painted via FontEngine's
 * shared trace-style logic so it matches TracingGrid's dashed/dotted/hollow
 * rendering exactly. Arrow positions are authored data (see
 * StrokeOrderArrow), not computed — see the note on LetterGuideElement in
 * kdpBook.ts for why.
 */
export default function LetterGuide({
  width,
  height,
  letter,
  fontFamily,
  guideStyle,
  strokeArrows,
  pxPerInch = SCREEN_PX_PER_INCH,
}: LetterGuideProps) {
  const fontSize = height * 0.85;
  const textPaint = computeTraceTextPaint(guideStyle);

  return (
    <svg
      width={inchesToPx(width, pxPerInch)}
      height={inchesToPx(height, pxPerInch)}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label={`Letter guide for ${letter}`}
    >
      <text
        x={width / 2}
        y={height * 0.9}
        fontFamily={fontFamily}
        fontSize={fontSize}
        textAnchor="middle"
        fill={textPaint.fill}
        stroke={textPaint.stroke}
        strokeWidth={textPaint.strokeWidth}
        strokeDasharray={textPaint.strokeDasharray}
      >
        {letter}
      </text>

      {strokeArrows.map((arrow) => (
        <g key={arrow.order} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotation})`}>
          <path d={ARROW_PATH} fill={ARROW_COLOR} />
          <circle r={0.15} fill={ARROW_COLOR} />
          <text y={0.055} textAnchor="middle" fontSize={0.16} fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontWeight="bold">
            {arrow.order}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Print-export companion: the exact same visual as the component above, as
 * a raw SVG string, so the PDF exporter can rasterize it at 300 DPI instead
 * of approximating the dashed/hollow guide styles with jsPDF's fill-only
 * text drawing (see the equivalent note in TracingGrid.tsx).
 */
export function letterGuideToSvgMarkup(props: LayoutProps): string {
  const { width, height, letter, fontFamily, guideStyle, strokeArrows } = props;
  const fontSize = height * 0.85;
  const textPaint = computeTraceTextPaint(guideStyle);

  const letterMarkup = `<text x="${width / 2}" y="${height * 0.9}" font-family="${fontFamily}" font-size="${fontSize}" text-anchor="middle" fill="${textPaint.fill}" stroke="${textPaint.stroke}" stroke-width="${textPaint.strokeWidth}"${
    textPaint.strokeDasharray ? ` stroke-dasharray="${textPaint.strokeDasharray}"` : ""
  }>${letter}</text>`;

  const arrowsMarkup = strokeArrows
    .map(
      (arrow) => `
      <g transform="translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotation})">
        <path d="${ARROW_PATH}" fill="${ARROW_COLOR}" />
        <circle r="0.15" fill="${ARROW_COLOR}" />
        <text y="0.055" text-anchor="middle" font-size="0.16" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-weight="bold">${arrow.order}</text>
      </g>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${letterMarkup}${arrowsMarkup}</svg>`;
}
