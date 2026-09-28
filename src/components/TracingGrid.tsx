export interface TracingGridProps {
  widthIn: number;
  heightIn: number;
  /** What each repetition displays — e.g. "A a" or "Α α". Pair formatting is the caller's choice, not enforced here. */
  letter: string;
  fontFamily: string;
  rows: number;
  repeatsPerRow: number;
  /** The first instance in each row renders solid, as a model to copy — the rest render dashed for tracing. */
  firstInstanceSolid?: boolean;
}

const GUIDE_COLOR = "#94a3b8"; // slate-400 — top line, dashed midline, bottom line
const BASELINE_COLOR = "#334155"; // slate-700 — baseline is the one line kids actually anchor writing to, so it's darker
const SOLID_COLOR = "#000000";
const TRACE_COLOR = "#94a3b8";
const HAIRLINE = 0.01;

interface RowLayout {
  topY: number;
  midY: number;
  baseY: number;
  bottomY: number;
  fontSize: number;
  letters: { cx: number; solid: boolean }[];
}

function computeRows(widthIn: number, heightIn: number, rows: number, repeatsPerRow: number, firstInstanceSolid: boolean): RowLayout[] {
  const bandHeight = heightIn / rows;
  const colWidth = widthIn / repeatsPerRow;

  // Classic 4-line handwriting practice system: top/capline (ascender
  // height), a dashed midline (x-height, where lowercase letters top out),
  // the baseline (where letters sit), and a bottom line below it for
  // descenders (g, y, p, q, j).
  return Array.from({ length: rows }, (_, row) => {
    const bandTop = row * bandHeight;
    return {
      topY: bandTop + bandHeight * 0.08,
      midY: bandTop + bandHeight * 0.45,
      baseY: bandTop + bandHeight * 0.7,
      bottomY: bandTop + bandHeight * 0.92,
      fontSize: bandHeight * 0.55,
      letters: Array.from({ length: repeatsPerRow }, (_, col) => ({
        cx: col * colWidth + colWidth / 2,
        solid: firstInstanceSolid && col === 0,
      })),
    };
  });
}

/**
 * A multi-row handwriting practice grid: each row gets a top line, dashed
 * midline, baseline, and bottom line, with the target letter(s) repeated
 * across the row (first instance solid as a model, the rest dashed for
 * tracing). All units inside the SVG are inches (viewBox = widthIn x
 * heightIn), so line weights and font sizes stay proportional to the
 * printed page regardless of on-screen zoom.
 */
export default function TracingGrid({ widthIn, heightIn, letter, fontFamily, rows, repeatsPerRow, firstInstanceSolid = true }: TracingGridProps) {
  const rowLayouts = computeRows(widthIn, heightIn, rows, repeatsPerRow, firstInstanceSolid);

  return (
    <svg
      width={`${widthIn}in`}
      height={`${heightIn}in`}
      viewBox={`0 0 ${widthIn} ${heightIn}`}
      className="block"
      role="img"
      aria-label={`Tracing grid for ${letter}`}
    >
      {rowLayouts.map((row, i) => (
        <g key={i}>
          <line x1={0} y1={row.topY} x2={widthIn} y2={row.topY} stroke={GUIDE_COLOR} strokeWidth={HAIRLINE} />
          <line
            x1={0}
            y1={row.midY}
            x2={widthIn}
            y2={row.midY}
            stroke={GUIDE_COLOR}
            strokeWidth={HAIRLINE}
            strokeDasharray="0.05 0.05"
          />
          <line x1={0} y1={row.baseY} x2={widthIn} y2={row.baseY} stroke={BASELINE_COLOR} strokeWidth={HAIRLINE * 1.5} />
          <line x1={0} y1={row.bottomY} x2={widthIn} y2={row.bottomY} stroke={GUIDE_COLOR} strokeWidth={HAIRLINE} />

          {row.letters.map((l, col) => (
            <text
              key={col}
              x={l.cx}
              y={row.baseY}
              fontFamily={fontFamily}
              fontSize={row.fontSize}
              textAnchor="middle"
              fill={l.solid ? SOLID_COLOR : "none"}
              stroke={l.solid ? "none" : TRACE_COLOR}
              strokeWidth={l.solid ? 0 : 0.012}
              strokeDasharray={l.solid ? undefined : "0.03 0.025"}
            >
              {letter}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/**
 * Print-export companion: the exact same visual as the component above, as
 * a raw SVG string. Neither jsPDF nor PDFKit's native text API can stroke-
 * dash text the way the on-screen dashed tracing letters need — so the
 * PDF exporter embeds this markup as true vector (via svg-to-pdfkit)
 * instead of trying to redraw the grid with PDF text primitives, which
 * would lose the dashed effect entirely.
 */
export function tracingGridToSvgMarkup(props: Omit<TracingGridProps, "firstInstanceSolid"> & { firstInstanceSolid: boolean }): string {
  const { widthIn, heightIn, letter, fontFamily, rows, repeatsPerRow, firstInstanceSolid } = props;
  const rowLayouts = computeRows(widthIn, heightIn, rows, repeatsPerRow, firstInstanceSolid);

  const body = rowLayouts
    .map((row) => {
      const letters = row.letters
        .map(({ cx, solid }) =>
          solid
            ? `<text x="${cx}" y="${row.baseY}" font-family="${fontFamily}" font-size="${row.fontSize}" text-anchor="middle" fill="${SOLID_COLOR}">${letter}</text>`
            : `<text x="${cx}" y="${row.baseY}" font-family="${fontFamily}" font-size="${row.fontSize}" text-anchor="middle" fill="none" stroke="${TRACE_COLOR}" stroke-width="0.012" stroke-dasharray="0.03 0.025">${letter}</text>`
        )
        .join("");

      return `
        <line x1="0" y1="${row.topY}" x2="${widthIn}" y2="${row.topY}" stroke="${GUIDE_COLOR}" stroke-width="${HAIRLINE}" />
        <line x1="0" y1="${row.midY}" x2="${widthIn}" y2="${row.midY}" stroke="${GUIDE_COLOR}" stroke-width="${HAIRLINE}" stroke-dasharray="0.05 0.05" />
        <line x1="0" y1="${row.baseY}" x2="${widthIn}" y2="${row.baseY}" stroke="${BASELINE_COLOR}" stroke-width="${HAIRLINE * 1.5}" />
        <line x1="0" y1="${row.bottomY}" x2="${widthIn}" y2="${row.bottomY}" stroke="${GUIDE_COLOR}" stroke-width="${HAIRLINE}" />
        ${letters}
      `;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthIn} ${heightIn}" width="${widthIn}" height="${heightIn}">${body}</svg>`;
}

// --- Alphabet + font helpers -------------------------------------------
// Not part of the data model (TracingGridElement.letter is just a display
// string) — these are authoring-time conveniences for building rows across
// an alphabet, formatted as "Uppercase lowercase" pairs to match the "A a"
// / "Α α" style requested.

function pairUpperLower(upper: string[], lower: string[]): string[] {
  return upper.map((u, i) => `${u} ${lower[i]}`);
}

const ENGLISH_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ENGLISH_LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
const GREEK_UPPER = ["Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ", "Ι", "Κ", "Λ", "Μ", "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ", "Τ", "Υ", "Φ", "Χ", "Ψ", "Ω"];
const GREEK_LOWER = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω"];

export const ENGLISH_ALPHABET_PAIRS: string[] = pairUpperLower(ENGLISH_UPPER, ENGLISH_LOWER);
export const GREEK_ALPHABET_PAIRS: string[] = pairUpperLower(GREEK_UPPER, GREEK_LOWER);

export interface TracingFontPreset {
  label: string;
  fontFamily: string;
}

export const TRACING_FONT_PRESETS: TracingFontPreset[] = [
  { label: "Arial (Primary)", fontFamily: "Arial, Helvetica, sans-serif" },
  { label: "Comic Sans (Kid-friendly)", fontFamily: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: "Georgia (Serif)", fontFamily: "Georgia, 'Times New Roman', serif" },
];
