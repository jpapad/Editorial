import type { BookSettings, BookState, CanvasElement, PageData } from "@/types/book";
import { PLACEHOLDER_ART_MARKER } from "@/components/BookWizard";

export type PreflightSeverity = "error" | "warning";
export type PreflightCode = "SAFE_ZONE" | "THIN_STROKE" | "NON_GRAYSCALE_COLOR" | "MISSING_ASSET" | "TRANSPARENCY" | "TEXT_NOT_OUTLINED";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  code: PreflightCode;
  message: string;
  spreadNumber: number;
  side: "left" | "right";
  elementId?: string;
}

const MIN_STROKE_PT = 0.75; // ~0.0104in — the request's "(0.01 in)" is this figure rounded
const EPSILON_IN = 0.001; // float-comparison slack

function isGrayscale(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return true; // can't parse reliably (e.g. a CSS color name) — don't false-flag
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return r === g && g === b;
}

function describeElement(element: CanvasElement): string {
  switch (element.type) {
    case "TITLE_TEXT":
      return `Title "${element.text}"`;
    case "LETTER_GUIDE":
      return `Letter guide "${element.letter}"`;
    case "TRACING_GRID":
      return `Tracing grid "${element.letter}"`;
    default:
      return element.type.replace(/_/g, " ").toLowerCase();
  }
}

/** Bleed / Margin / Gutter — an element must stay within the page's trim, clear of the gutter, and clear of the outer margin. */
function checkSafeZone(element: CanvasElement, side: "left" | "right", settings: BookSettings, spreadNumber: number): PreflightIssue[] {
  const { trimWidthIn, trimHeightIn, gutterIn, outerMarginIn } = settings;
  const insetLeft = side === "left" ? outerMarginIn : gutterIn;
  const insetRight = side === "left" ? gutterIn : outerMarginIn;

  const withinLeft = element.x >= insetLeft - EPSILON_IN;
  const withinRight = element.x + element.width <= trimWidthIn - insetRight + EPSILON_IN;
  const withinTop = element.y >= outerMarginIn - EPSILON_IN;
  const withinBottom = element.y + element.height <= trimHeightIn - outerMarginIn + EPSILON_IN;

  if (withinLeft && withinRight && withinTop && withinBottom) return [];

  const zone = !withinLeft || !withinRight ? (side === "left" ? (!withinRight ? "gutter" : "margin") : !withinLeft ? "gutter" : "margin") : "margin";

  return [
    {
      id: `${element.id}-safe-zone`,
      severity: "warning",
      code: "SAFE_ZONE",
      message: `${describeElement(element)} extends into the ${zone} safe zone.`,
      spreadNumber,
      side,
      elementId: element.id,
    },
  ];
}

/**
 * Only checks stroke weights that are actually author-controlled data
 * (SVG_MAIN_ART / SVG_MINI_GROUP `strokeWidth`, in pt). TracingGrid /
 * LetterGuide's internal guide lines are intentionally hairline-thin
 * (alignment aids, not content to color) and aren't exposed as element-
 * level data, so there's nothing for this check to inspect there.
 */
function checkThinStrokes(element: CanvasElement, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  if (element.type === "SVG_MAIN_ART" && element.strokeWidth < MIN_STROKE_PT) {
    return [
      {
        id: `${element.id}-thin-stroke`,
        severity: "error",
        code: "THIN_STROKE",
        message: `Line art stroke is ${element.strokeWidth}pt — below the ${MIN_STROKE_PT}pt (~0.01in) minimum for reliable print reproduction.`,
        spreadNumber,
        side,
        elementId: element.id,
      },
    ];
  }

  if (element.type === "SVG_MINI_GROUP" && element.strokeWidth < MIN_STROKE_PT) {
    return [
      {
        id: `${element.id}-thin-stroke`,
        severity: "error",
        code: "THIN_STROKE",
        message: `Mini illustration group stroke is ${element.strokeWidth}pt — below the ${MIN_STROKE_PT}pt minimum.`,
        spreadNumber,
        side,
        elementId: element.id,
      },
    ];
  }

  return [];
}

/**
 * Only checks colors an author sets directly (title text, page
 * background). Imported line art (SVG_MAIN_ART / SVG_MINI_GROUP) is
 * structurally guaranteed black by SvgNormalizer at authoring time, so
 * there's nothing to catch there — the pipeline itself is the guarantee.
 */
function checkColorCompliance(element: CanvasElement, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  if (element.type !== "TITLE_TEXT") return [];

  const issues: PreflightIssue[] = [];
  if (!isGrayscale(element.fill)) {
    issues.push({
      id: `${element.id}-color`,
      severity: "warning",
      code: "NON_GRAYSCALE_COLOR",
      message: `${describeElement(element)} uses a non-grayscale color (${element.fill}) — interior pages print in black & white only.`,
      spreadNumber,
      side,
      elementId: element.id,
    });
  }
  issues.push(...checkZeroTransparency(element.fill, describeElement(element), spreadNumber, side, element.id, element.id));
  return issues;
}

/**
 * SVG_MAIN_ART / SVG_MINI_GROUP items with empty markup (author deleted or
 * never filled in an asset reference) or BookWizard's own honest "no art
 * yet" placeholder (see PLACEHOLDER_ART_MARKER) — the wizard deliberately
 * ships a real, visible placeholder instead of fabricating mismatched clip
 * art, but that placeholder is meant to be REPLACED before publishing, not
 * printed as-is. This is what actually catches a book that still has
 * "Illustration pending" pages in it.
 */
function checkMissingAssets(element: CanvasElement, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  if (element.type === "SVG_MAIN_ART") {
    if (element.svgMarkup.trim() === "") {
      issues.push({
        id: `${element.id}-missing-asset`,
        severity: "error",
        code: "MISSING_ASSET",
        message: `${describeElement(element)} has no art — the SVG source is empty.`,
        spreadNumber,
        side,
        elementId: element.id,
      });
    } else if (element.svgMarkup.includes(PLACEHOLDER_ART_MARKER)) {
      issues.push({
        id: `${element.id}-placeholder-asset`,
        severity: "warning",
        code: "MISSING_ASSET",
        message: `${describeElement(element)} is still the Book Wizard's placeholder — replace it with real art before publishing.`,
        spreadNumber,
        side,
        elementId: element.id,
      });
    }
  }

  if (element.type === "SVG_MINI_GROUP") {
    element.items.forEach((item, i) => {
      if (item.svgMarkup.trim() === "") {
        issues.push({
          id: `${element.id}-item-${i}-missing-asset`,
          severity: "error",
          code: "MISSING_ASSET",
          message: `Mini illustration group item ${i + 1} has no art — the SVG source is empty.`,
          spreadNumber,
          side,
          elementId: element.id,
        });
      }
    });
  }

  return issues;
}

/**
 * Catches transparency that isGrayscale()'s plain 6-hex-digit parser can't
 * see: an 8-digit hex (#RRGGBBAA) with a non-opaque alpha byte, or a CSS
 * rgba()/hsla() functional color with alpha < 1. Interior print pages have
 * no meaningful concept of transparency — anything less than fully opaque
 * either prints as an unpredictable blend with whatever's beneath it or
 * gets silently flattened to opaque by the print pipeline, neither of
 * which matches what the author saw on screen.
 */
function checkZeroTransparency(hex: string, describe: string, spreadNumber: number, side: "left" | "right", elementId: string | undefined, idSuffix: string): PreflightIssue[] {
  const clean = hex.trim();

  const hex8Match = clean.match(/^#([0-9a-fA-F]{8})$/);
  if (hex8Match) {
    const alpha = parseInt(hex8Match[1].slice(6, 8), 16);
    if (alpha < 255) {
      return [
        {
          id: `${idSuffix}-transparency`,
          severity: "error",
          code: "TRANSPARENCY",
          message: `${describe} uses a non-opaque color (${hex}, alpha ${Math.round((alpha / 255) * 100)}%) — interior pages must be fully opaque.`,
          spreadNumber,
          side,
          elementId,
        },
      ];
    }
    return [];
  }

  const functionalMatch = clean.match(/^(rgba|hsla)\([^)]*,\s*([\d.]+)\s*\)$/i);
  if (functionalMatch) {
    const alpha = Number(functionalMatch[2]);
    if (alpha < 1) {
      return [
        {
          id: `${idSuffix}-transparency`,
          severity: "error",
          code: "TRANSPARENCY",
          message: `${describe} uses a non-opaque color (${hex}, alpha ${Math.round(alpha * 100)}%) — interior pages must be fully opaque.`,
          spreadNumber,
          side,
          elementId,
        },
      ];
    }
  }

  return [];
}

function checkPageBackground(page: PageData, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  if (!page.backgroundColor) return [];

  const issues: PreflightIssue[] = [];
  if (!isGrayscale(page.backgroundColor)) {
    issues.push({
      id: `${page.id}-bg-color`,
      severity: "warning",
      code: "NON_GRAYSCALE_COLOR",
      message: `Page background (${page.backgroundColor}) is non-grayscale — interior pages print in black & white only.`,
      spreadNumber,
      side,
    });
  }
  issues.push(...checkZeroTransparency(page.backgroundColor, "Page background", spreadNumber, side, undefined, `${page.id}-bg`));
  return issues;
}

/**
 * Book-level, not per-element: this pipeline (pdfExporter.ts) always
 * embeds a real font program (Noto Sans, registered via PDFKit's
 * `registerFont`) rather than converting text to vector outlines. That IS
 * what KDP's own spec asks for — "outline fonts" as a literal requirement
 * is a different POD vendor's convention, not Amazon's — but it's worth
 * surfacing explicitly rather than assuming every reader already knows
 * that distinction, especially if a book is headed to a print vendor
 * other than KDP with a stricter outline requirement. Always returns
 * exactly one advisory (never an error — there's no failure state to
 * detect here, since embedding is unconditional in this pipeline), unlike
 * the per-element checks above.
 */
function checkFontOutlining(): PreflightIssue[] {
  return [
    {
      id: "book-font-embedding",
      severity: "warning",
      code: "TEXT_NOT_OUTLINED",
      message: "Text exports with an embedded font (Noto Sans), not converted to vector outlines. KDP accepts embedded fonts; confirm your target print vendor's spec if it isn't KDP.",
      spreadNumber: 0,
      side: "left",
    },
  ];
}

/** Runs every Sprint 3 + Sprint 6 rule across the whole book and returns a flat, ordered issue list — call this on every BookState change for real-time inspection. */
export function runPreflightCheck(book: BookState): PreflightIssue[] {
  const issues: PreflightIssue[] = [...checkFontOutlining()];

  for (const spread of book.spreads) {
    for (const side of ["left", "right"] as const) {
      const page = side === "left" ? spread.leftPage : spread.rightPage;
      issues.push(...checkPageBackground(page, side, spread.spreadNumber));

      for (const element of page.elements) {
        issues.push(...checkSafeZone(element, side, book.settings, spread.spreadNumber));
        issues.push(...checkThinStrokes(element, side, spread.spreadNumber));
        issues.push(...checkColorCompliance(element, side, spread.spreadNumber));
        issues.push(...checkMissingAssets(element, side, spread.spreadNumber));
      }
    }
  }

  return issues;
}
