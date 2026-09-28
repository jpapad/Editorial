import { inchesToPx, SCREEN_PX_PER_INCH } from "@/lib/kdpPrintSpec";
import { computeTraceTextPaint } from "@/lib/fontEngine";
import type { TraceStyle } from "@/types/kdpBook";

export interface TracingGridProps {
  width: number; // inches
  height: number; // inches
  letter: string;
  fontFamily: string;
  traceStyle: TraceStyle;
  rows: number;
  repeatsPerRow: number;
  /** The first instance in each row renders solid, as a model to copy — the rest use `traceStyle`. */
  firstInstanceSolid: boolean;
  pxPerInch?: number;
}

const GUIDE_COLOR = "#94a3b8"; // slate-400
const BASELINE_COLOR = "#334155"; // slate-700
const HAIRLINE = 0.01;

interface RowLayout {
  topY: number;
  midY: number;
  baseY: number;
  fontSize: number;
  letters: { cx: number; solid: boolean }[];
}

type LayoutProps = Omit<TracingGridProps, "pxPerInch">;

/**
 * Shared geometry for both the JSX renderer and the SVG-string builder
 * (used by the PDF exporter) — computed once here so the two can never
 * silently drift apart.
 */
function computeRows({ width, height, rows, repeatsPerRow, firstInstanceSolid }: LayoutProps): RowLayout[] {
  const bandHeight = height / rows;
  const colWidth = width / repeatsPerRow;

  return Array.from({ length: rows }, (_, row) => {
    const bandTop = row * bandHeight;
    return {
      topY: bandTop + bandHeight * 0.15,
      midY: bandTop + bandHeight * 0.5,
      baseY: bandTop + bandHeight * 0.85,
      fontSize: bandHeight * 0.6,
      letters: Array.from({ length: repeatsPerRow }, (_, col) => ({
        cx: col * colWidth + colWidth / 2,
        solid: firstInstanceSolid && col === 0,
      })),
    };
  });
}

/**
 * A multi-row handwriting practice grid: each row gets a top line, a dashed
 * midline, and a solid baseline, with the target letter repeated across the
 * row. All units inside the SVG are inches (viewBox = the element's own
 * width/height), so line weights and font sizes stay proportional to the
 * printed page regardless of on-screen zoom.
 */
export default function TracingGrid(props: TracingGridProps) {
  const { width, height, letter, fontFamily, traceStyle, pxPerInch = SCREEN_PX_PER_INCH } = props;
  const rowLayouts = computeRows(props);
  const solidPaint = computeTraceTextPaint("solid");
  const tracePaint = computeTraceTextPaint(traceStyle);

  return (
    <svg
      width={inchesToPx(width, pxPerInch)}
      height={inchesToPx(height, pxPerInch)}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      role="img"
      aria-label={`Tracing grid for the letter ${letter}`}
    >
      {rowLayouts.map((row, i) => (
        <g key={i}>
          <line x1={0} y1={row.topY} x2={width} y2={row.topY} stroke={GUIDE_COLOR} strokeWidth={HAIRLINE} />
          <line
            x1={0}
            y1={row.midY}
            x2={width}
            y2={row.midY}
            stroke={GUIDE_COLOR}
            strokeWidth={HAIRLINE}
            strokeDasharray="0.05 0.05"
          />
          <line x1={0} y1={row.baseY} x2={width} y2={row.baseY} stroke={BASELINE_COLOR} strokeWidth={HAIRLINE * 1.5} />

          {row.letters.map((l, col) => {
            const paint = l.solid ? solidPaint : tracePaint;
            return (
              <text
                key={col}
                x={l.cx}
                y={row.baseY}
                fontFamily={fontFamily}
                fontSize={row.fontSize}
                textAnchor="middle"
                fill={paint.fill}
                stroke={paint.stroke}
                strokeWidth={paint.strokeWidth}
                strokeDasharray={paint.strokeDasharray}
              >
                {letter}
              </text>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/**
 * Print-export companion: the exact same visual as the component above, as
 * a raw SVG string. jsPDF's text drawing can only fill solid glyphs — it
 * has no way to stroke-dash text the way the on-screen dashed/dotted
 * tracing letters need — so the exporter rasterizes this markup at 300 DPI
 * instead of trying to redraw the grid with PDF primitives.
 */
export function tracingGridToSvgMarkup(props: LayoutProps): string {
  const { width, height, letter, fontFamily, traceStyle } = props;
  const rowLayouts = computeRows(props);
  const solidPaint = computeTraceTextPaint("solid");
  const tracePaint = computeTraceTextPaint(traceStyle);

  const body = rowLayouts
    .map((row) => {
      const letters = row.letters
        .map(({ cx, solid }) => {
          const paint = solid ? solidPaint : tracePaint;
          const dash = paint.strokeDasharray ? ` stroke-dasharray="${paint.strokeDasharray}"` : "";
          return `<text x="${cx}" y="${row.baseY}" font-family="${fontFamily}" font-size="${row.fontSize}" text-anchor="middle" fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"${dash}>${letter}</text>`;
        })
        .join("");

      return `
        <line x1="0" y1="${row.topY}" x2="${width}" y2="${row.topY}" stroke="${GUIDE_COLOR}" stroke-width="${HAIRLINE}" />
        <line x1="0" y1="${row.midY}" x2="${width}" y2="${row.midY}" stroke="${GUIDE_COLOR}" stroke-width="${HAIRLINE}" stroke-dasharray="0.05 0.05" />
        <line x1="0" y1="${row.baseY}" x2="${width}" y2="${row.baseY}" stroke="${BASELINE_COLOR}" stroke-width="${HAIRLINE * 1.5}" />
        ${letters}
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`;
}
