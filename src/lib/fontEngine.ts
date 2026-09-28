import type { CharacterSet, TraceStyle } from "@/types/kdpBook";

/**
 * Single source of truth for how a trace style is painted — used by both
 * TracingGrid and LetterGuide (and any future tracing component) so the
 * four styles read identically everywhere in the book.
 *
 * "dotted" and "dashed" both work by stroking (not filling) the text
 * glyph's outline with a dash pattern — a short dash + long gap reads as a
 * dotted line, a longer dash + shorter gap reads as dashed. Real dotted
 * "trace fonts" used by commercial workbooks (e.g. KG Primary Dots) are
 * purpose-built fonts with a literal dotted stroke baked into the glyphs;
 * that requires embedding a specific licensed font file, so this simulates
 * the same effect with any regular font instead.
 */
export interface TextPaint {
  fill: string;
  stroke: string;
  strokeWidth: number; // inches
  strokeDasharray?: string;
}

const SOLID_COLOR = "#000000";
const TRACE_COLOR = "#94a3b8";

export function computeTraceTextPaint(style: TraceStyle): TextPaint {
  switch (style) {
    case "solid":
      return { fill: SOLID_COLOR, stroke: "none", strokeWidth: 0 };
    case "hollow":
      return { fill: "none", stroke: SOLID_COLOR, strokeWidth: 0.02 };
    case "dashed":
      return { fill: "none", stroke: TRACE_COLOR, strokeWidth: 0.02, strokeDasharray: "0.05 0.04" };
    case "dotted":
      return { fill: "none", stroke: TRACE_COLOR, strokeWidth: 0.022, strokeDasharray: "0.006 0.03" };
  }
}

export interface FontPreset {
  id: string;
  label: string;
  fontFamily: string;
  traceStyle: TraceStyle;
  characterSet: CharacterSet;
}

/** Curated author-facing presets combining a font family + trace style + character set — the four "trace font styles" from the spec (Dotted, Dashed, Primary, Cursive), plus Greek. */
export const FONT_PRESETS: FontPreset[] = [
  { id: "primary-dashed", label: "Primary — Dashed", fontFamily: "Arial, Helvetica, sans-serif", traceStyle: "dashed", characterSet: "latin-upper" },
  { id: "primary-dotted", label: "Primary — Dotted", fontFamily: "Arial, Helvetica, sans-serif", traceStyle: "dotted", characterSet: "latin-upper" },
  { id: "primary-solid", label: "Primary — Solid Model", fontFamily: "Arial, Helvetica, sans-serif", traceStyle: "solid", characterSet: "latin-upper" },
  { id: "cursive-dashed", label: "Cursive — Dashed", fontFamily: "'Brush Script MT', 'Segoe Script', cursive", traceStyle: "dashed", characterSet: "latin-lower" },
  { id: "greek-dashed", label: "Greek Alphabet — Dashed", fontFamily: "Georgia, 'Times New Roman', serif", traceStyle: "dashed", characterSet: "greek-upper" },
];

const GREEK_UPPER = ["Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ", "Ι", "Κ", "Λ", "Μ", "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ", "Τ", "Υ", "Φ", "Χ", "Ψ", "Ω"];
const GREEK_LOWER = ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω"];
const LATIN_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LATIN_LOWER = "abcdefghijklmnopqrstuvwxyz".split("");

export function resolveCharacters(set: CharacterSet): string[] {
  switch (set) {
    case "latin-upper":
      return LATIN_UPPER;
    case "latin-lower":
      return LATIN_LOWER;
    case "greek-upper":
      return GREEK_UPPER;
    case "greek-lower":
      return GREEK_LOWER;
  }
}
