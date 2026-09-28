import type { StrokeOrderArrow } from "@/types/book";

export interface LetterGuideProps {
  widthIn: number;
  heightIn: number;
  letter: string; // a single character — English or Greek
  fontFamily: string;
  guideStyle: "solid" | "hollow" | "dashed";
  strokeArrows: StrokeOrderArrow[];
}

const ARROW_COLOR = "#4f46e5"; // indigo-600
const ARROW_PATH = "M -0.05 -0.35 L 0.05 -0.35 L 0.05 -0.15 L 0.11 -0.15 L 0 0 L -0.11 -0.15 L -0.05 -0.15 Z";

function computeGuidePaint(style: LetterGuideProps["guideStyle"]) {
  if (style === "solid") return { fill: "#000000", stroke: "none", strokeWidth: 0, strokeDasharray: undefined as string | undefined };
  if (style === "hollow") return { fill: "none", stroke: "#000000", strokeWidth: 0.02, strokeDasharray: undefined as string | undefined };
  return { fill: "none", stroke: "#94a3b8", strokeWidth: 0.02, strokeDasharray: "0.05 0.04" };
}

/**
 * A large single-letter tracing guide with numbered stroke-order badges.
 * The letter is real `<text>` (not a pre-baked glyph path), so it works
 * for any installed font and any character, English or Greek, without an
 * SVG font trace.
 *
 * Arrow positions are authored data (StrokeOrderArrow), not computed —
 * deriving genuinely correct handwriting stroke order from arbitrary font
 * glyphs would need a curated per-letter/per-font dataset, which is well
 * beyond a rendering component's job. This renders whatever arrows it's
 * given, positioned/rotated by the author like any other canvas object.
 */
export default function LetterGuide({ widthIn, heightIn, letter, fontFamily, guideStyle, strokeArrows }: LetterGuideProps) {
  const fontSize = heightIn * 0.85;
  const paint = computeGuidePaint(guideStyle);

  return (
    <svg
      width={`${widthIn}in`}
      height={`${heightIn}in`}
      viewBox={`0 0 ${widthIn} ${heightIn}`}
      className="block"
      role="img"
      aria-label={`Letter guide for ${letter}`}
    >
      <text
        x={widthIn / 2}
        y={heightIn * 0.9}
        fontFamily={fontFamily}
        fontSize={fontSize}
        textAnchor="middle"
        fill={paint.fill}
        stroke={paint.stroke}
        strokeWidth={paint.strokeWidth}
        strokeDasharray={paint.strokeDasharray}
      >
        {letter}
      </text>

      {strokeArrows.map((arrow) => (
        <g key={arrow.order} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotation})`}>
          <path d={ARROW_PATH} fill={ARROW_COLOR} />
          <circle r={0.15} fill={ARROW_COLOR} />
          <text
            y={0.055}
            textAnchor="middle"
            fontSize={0.16}
            fill="#ffffff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="bold"
          >
            {arrow.order}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Print-export companion: the exact same visual as the component above, as
 * a raw SVG string, so the PDF exporter can embed it as true vector (via
 * svg-to-pdfkit) instead of approximating the dashed/hollow guide styles
 * with fill-only PDF text drawing (see the equivalent note in
 * TracingGrid.tsx).
 */
export function letterGuideToSvgMarkup(props: LetterGuideProps): string {
  const { widthIn, heightIn, letter, fontFamily, guideStyle, strokeArrows } = props;
  const fontSize = heightIn * 0.85;
  const paint = computeGuidePaint(guideStyle);

  const letterMarkup = `<text x="${widthIn / 2}" y="${heightIn * 0.9}" font-family="${fontFamily}" font-size="${fontSize}" text-anchor="middle" fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"${
    paint.strokeDasharray ? ` stroke-dasharray="${paint.strokeDasharray}"` : ""
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthIn} ${heightIn}" width="${widthIn}" height="${heightIn}">${letterMarkup}${arrowsMarkup}</svg>`;
}
