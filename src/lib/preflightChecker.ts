import type { BookState, CanvasElement, KdpPrintSpec, PageContent } from "@/types/kdpBook";

export type PreflightSeverity = "error" | "warning";
export type PreflightCode = "SAFE_ZONE_INTRUSION" | "THIN_STROKE" | "NON_GRAYSCALE_COLOR";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  code: PreflightCode;
  message: string;
  spreadNumber: number;
  side: "left" | "right";
  elementId?: string;
}

const MIN_STROKE_PT = 0.75;
const EPSILON_IN = 0.001; // float-comparison slack

function isGrayscale(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length < 6) return true; // can't parse reliably (e.g. a CSS name) — don't false-flag
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return r === g && g === b;
}

function describeElement(el: CanvasElement): string {
  switch (el.type) {
    case "TITLE_TEXT":
      return `Title "${el.text}"`;
    case "LETTER_GUIDE":
      return `Letter guide "${el.letter}"`;
    case "TRACING_GRID":
      return `Tracing grid "${el.letter}"`;
    default:
      return el.type.replace(/_/g, " ").toLowerCase();
  }
}

function checkSafeZone(el: CanvasElement, side: "left" | "right", spec: KdpPrintSpec, spreadNumber: number): PreflightIssue[] {
  const { trimWidthIn, trimHeightIn, gutterIn, outerMarginIn } = spec;
  const insetLeft = side === "left" ? outerMarginIn : gutterIn;
  const insetRight = side === "left" ? gutterIn : outerMarginIn;

  const withinLeft = el.x >= insetLeft - EPSILON_IN;
  const withinRight = el.x + el.width <= trimWidthIn - insetRight + EPSILON_IN;
  const withinTop = el.y >= outerMarginIn - EPSILON_IN;
  const withinBottom = el.y + el.height <= trimHeightIn - outerMarginIn + EPSILON_IN;

  if (withinLeft && withinRight && withinTop && withinBottom) return [];

  return [
    {
      id: `${el.id}-safe-zone`,
      severity: "warning",
      code: "SAFE_ZONE_INTRUSION",
      message: `${describeElement(el)} extends into the gutter/margin safe zone.`,
      spreadNumber,
      side,
      elementId: el.id,
    },
  ];
}

/**
 * Only checks stroke weights that are actually author-controlled data
 * (SVG_MAIN_ART / SVG_MINI_GROUP `strokeWeight`, in pt). TracingGrid/
 * LetterGuide's internal guide lines are intentionally hairline-thin
 * (they're alignment aids, not content to color) and aren't exposed as
 * element-level data, so there's nothing for this check to inspect there.
 */
function checkThinStrokes(el: CanvasElement, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  if (el.type === "SVG_MAIN_ART" && el.strokeWeight < MIN_STROKE_PT) {
    issues.push({
      id: `${el.id}-thin-stroke`,
      severity: "error",
      code: "THIN_STROKE",
      message: `Line art stroke is ${el.strokeWeight}pt — below the ${MIN_STROKE_PT}pt minimum for reliable print reproduction.`,
      spreadNumber,
      side,
      elementId: el.id,
    });
  }

  if (el.type === "SVG_MINI_GROUP" && el.strokeWeight < MIN_STROKE_PT) {
    issues.push({
      id: `${el.id}-thin-stroke`,
      severity: "error",
      code: "THIN_STROKE",
      message: `Mini illustration group stroke is ${el.strokeWeight}pt — below the ${MIN_STROKE_PT}pt minimum.`,
      spreadNumber,
      side,
      elementId: el.id,
    });
  }

  return issues;
}

/**
 * Only checks colors an author sets directly (title text, page background).
 * Imported line art (SVG_MAIN_ART / SVG_MINI_GROUP / TRACING_GRID /
 * LETTER_GUIDE) is structurally guaranteed black by SvgNormalizer /
 * FontEngine at authoring time, so there's nothing to catch there — the
 * pipeline itself is the guarantee. Color-by-Number zone colors are exempt
 * on purpose: they're a printed color key, not interior line art.
 */
function checkColorCompliance(el: CanvasElement, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  if (el.type === "TITLE_TEXT" && !isGrayscale(el.fill)) {
    return [
      {
        id: `${el.id}-color`,
        severity: "warning",
        code: "NON_GRAYSCALE_COLOR",
        message: `${describeElement(el)} uses a non-grayscale color (${el.fill}) — interior pages print in black & white only.`,
        spreadNumber,
        side,
        elementId: el.id,
      },
    ];
  }
  return [];
}

function checkPageBackground(page: PageContent, side: "left" | "right", spreadNumber: number): PreflightIssue[] {
  if (page.backgroundColor && !isGrayscale(page.backgroundColor)) {
    return [
      {
        id: `${page.id}-bg-color`,
        severity: "warning",
        code: "NON_GRAYSCALE_COLOR",
        message: `Page background (${page.backgroundColor}) is non-grayscale — interior pages print in black & white only.`,
        spreadNumber,
        side,
      },
    ];
  }
  return [];
}

export function runPreflightCheck(book: BookState): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  for (const spread of book.spreads) {
    for (const side of ["left", "right"] as const) {
      const page = side === "left" ? spread.leftPage : spread.rightPage;
      issues.push(...checkPageBackground(page, side, spread.spreadNumber));

      for (const el of page.elements) {
        issues.push(...checkSafeZone(el, side, book.printSpec, spread.spreadNumber));
        issues.push(...checkThinStrokes(el, side, spread.spreadNumber));
        issues.push(...checkColorCompliance(el, side, spread.spreadNumber));
      }
    }
  }

  return issues;
}
