// Export Presets Manager — Sprint 6.
//
// A preset is a named BookSettings variant plus, for digital-only outlets,
// an optional watermark overlay spec. Applying one to a BookState replaces
// its `settings` (and trim-dependent element positions are the AUTHOR'S
// responsibility to re-check afterward — this does not attempt to
// reflow/rescale existing element x/y/width/height for a new trim size;
// see applyExportPreset's own note on why that's out of scope here).

import type { BookSettings, BookState } from "@/types/book";
import { DEFAULT_BOOK_SETTINGS } from "@/types/book";
import { resolveKdpGutterIn } from "@/utils/kdpMath";

export type ExportPresetId = "kdp-paperback" | "spiral-bound" | "etsy-digital-a4" | "etsy-digital-us-letter";

export interface WatermarkSpec {
  text: string;
  /** 0-100. Digital-preview watermarks are typically faint (10-20%) — visible enough to deter reuse, faint enough not to obscure the art being sold. */
  opacityPct: number;
  fontSizePt: number;
  color: string; // hex
  rotationDeg: number;
  /** Tile spacing (inches) between repeated watermark instances — smaller = denser coverage, harder to crop out. */
  spacingIn: number;
}

export const DEFAULT_WATERMARK_SPEC: WatermarkSpec = {
  text: "PREVIEW — NOT FOR PRINT",
  opacityPct: 15,
  fontSizePt: 18,
  color: "#000000",
  rotationDeg: -30,
  spacingIn: 2.5,
};

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  description: string;
  settings: BookSettings;
  /** Only meaningful for the Etsy digital presets below — physically printed KDP/spiral books are the sold product itself, not a preview of one, so they never carry a watermark. */
  watermark: WatermarkSpec | null;
}

/**
 * KDP paperback: standard perfect binding. Gutter is NOT a fixed value —
 * it scales with page count (see resolveKdpGutterIn) since a thicker book
 * needs more spine clearance. `forPageCount` lets a caller get the
 * correctly-scaled preset for their actual book; the exported
 * `KDP_PAPERBACK_PRESET` below uses DEFAULT_BOOK_SETTINGS' gutter as a
 * reasonable initial default (the 24-150 page bracket, this app's typical
 * alphabet-book length) for contexts that just want to list/preview
 * presets without a specific book in hand yet.
 */
export function kdpPaperbackPreset(pageCount: number): ExportPreset {
  return {
    id: "kdp-paperback",
    label: "Amazon KDP — Paperback (8.5\" x 11\")",
    description: "Standard perfect-bound paperback interior. Gutter scales with page count per KDP's published table.",
    settings: { ...DEFAULT_BOOK_SETTINGS, trimWidthIn: 8.5, trimHeightIn: 11, bleedIn: 0.125, gutterIn: resolveKdpGutterIn(pageCount) },
    watermark: null,
  };
}

/**
 * Spiral/coil bound: punched holes run down the spine-side edge, so that
 * margin needs to stay clear of the coil, not just the fold a perfect
 * binding uses — hence a fixed, extra-wide gutter regardless of page
 * count (the spiral mechanism's footprint doesn't scale with page count
 * the way a glued spine's does). Most spiral print vendors also print
 * each sheet as a single flat page rather than a bled, trimmed spread, so
 * bleed is 0 here rather than the 0.125in used for perfect binding.
 */
export const SPIRAL_BOUND_PRESET: ExportPreset = {
  id: "spiral-bound",
  label: "Spiral Bound (Extended Gutter)",
  description: "Coil/spiral binding — wide fixed gutter clears the punched holes; no bleed (single flat sheets, not a trimmed spread).",
  settings: { ...DEFAULT_BOOK_SETTINGS, trimWidthIn: 8.5, trimHeightIn: 11, bleedIn: 0, gutterIn: 0.875 },
  watermark: null,
};

/**
 * Etsy digital printables: a home-printed or copy-shop-printed PDF, not a
 * bound book — no gutter (nothing is bound), no bleed (a home printer
 * can't print to the edge of the sheet anyway), and a wider outer margin
 * than the print presets above as a safety margin against inexpensive
 * printers' inconsistent borderless handling. `includeWatermark: true`
 * attaches DEFAULT_WATERMARK_SPEC, meant for the LISTING PREVIEW images
 * only — the actual paid download should go through the same preset with
 * `includeWatermark: false`.
 */
function etsyDigitalPreset(id: "etsy-digital-a4" | "etsy-digital-us-letter", label: string, trimWidthIn: number, trimHeightIn: number, includeWatermark: boolean): ExportPreset {
  return {
    id,
    label,
    description: `Digital download, ${label.includes("A4") ? "A4" : "US Letter"} — no bleed/gutter (unbound, home-printed).${includeWatermark ? " Preview watermark applied." : ""}`,
    settings: { ...DEFAULT_BOOK_SETTINGS, trimWidthIn, trimHeightIn, bleedIn: 0, gutterIn: 0, outerMarginIn: 0.4 },
    watermark: includeWatermark ? DEFAULT_WATERMARK_SPEC : null,
  };
}

export const ETSY_DIGITAL_A4_PRESET = etsyDigitalPreset("etsy-digital-a4", "Etsy Digital Printable (A4)", 8.27, 11.69, true);
export const ETSY_DIGITAL_US_LETTER_PRESET = etsyDigitalPreset("etsy-digital-us-letter", "Etsy Digital Printable (US Letter)", 8.5, 11, true);

export const KDP_PAPERBACK_PRESET: ExportPreset = kdpPaperbackPreset(100);

export const EXPORT_PRESETS: Record<ExportPresetId, ExportPreset> = {
  "kdp-paperback": KDP_PAPERBACK_PRESET,
  "spiral-bound": SPIRAL_BOUND_PRESET,
  "etsy-digital-a4": ETSY_DIGITAL_A4_PRESET,
  "etsy-digital-us-letter": ETSY_DIGITAL_US_LETTER_PRESET,
};

/**
 * Swaps a book's settings for a preset's. Deliberately does NOT touch
 * `spreads` — existing element x/y/width/height were authored against the
 * OLD trim size, and a preset with a different trim (e.g. switching from
 * KDP's 8.5x11 to Etsy's A4) will leave them mis-fitted until re-laid-out.
 * A full auto-reflow (rescaling every element proportionally to the new
 * trim) is a real, separate feature — silently doing a naive proportional
 * rescale here would produce plausible-looking but unreviewed layouts,
 * which is worse than leaving the mismatch visible for an author to fix
 * (the existing Pre-Flight checker will flag anything that ends up
 * outside the new safe zone).
 */
export function applyExportPreset(book: BookState, presetId: ExportPresetId, pageCount?: number): BookState {
  const preset = presetId === "kdp-paperback" && pageCount !== undefined ? kdpPaperbackPreset(pageCount) : EXPORT_PRESETS[presetId];
  return { ...book, settings: preset.settings, updatedAt: new Date().toISOString() };
}

/**
 * Pure SVG-string builder for a tiled, semi-transparent, rotated watermark
 * — same "isomorphic string function" shape as svgOptimizer.ts, so it can
 * be dropped into a browser preview overlay OR (later) a digital-preview
 * export path without a DOMParser dependency either way.
 */
export function watermarkOverlayToSvgMarkup(spec: WatermarkSpec, widthIn: number, heightIn: number): string {
  const { text, opacityPct, fontSizePt, color, rotationDeg, spacingIn } = spec;
  const fontSizeIn = fontSizePt / 72;
  const cols = Math.ceil(widthIn / spacingIn) + 2;
  const rows = Math.ceil(heightIn / spacingIn) + 2;

  const instances: string[] = [];
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * spacingIn;
      const y = row * spacingIn;
      instances.push(
        `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSizeIn}" fill="${color}" fill-opacity="${opacityPct / 100}" transform="rotate(${rotationDeg} ${x} ${y})">${text}</text>`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthIn} ${heightIn}" width="${widthIn}in" height="${heightIn}in">${instances.join("")}</svg>`;
}
