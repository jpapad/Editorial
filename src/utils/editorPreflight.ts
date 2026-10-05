import type { BookPage, LineData, PageObject } from "@/types/editor";
import { fitInside, objectBounds } from "@/utils/objectGeometry";
import { geometryFromSpace, LEGACY_SPACE, type Rect } from "@/utils/pageGeometry";

// The same safe area the canvas's print-guides overlay draws (0.5in inside
// each page's own trim), so the check and the visual guide always agree.
function safeArea(page: BookPage): Rect {
  return geometryFromSpace(page.space ?? LEGACY_SPACE).safe;
}

// A heuristic, not a sourced print-industry spec: half the editor's own
// default pen width (6pt). Below this, a stroke is visibly thinner than
// what this tool draws by default and worth a warning — this repo's other
// preflight checker (utils/preflightChecker.ts) has a real sourced figure
// (0.75pt) for its own, differently-scaled data model, but that number
// doesn't carry over to this canvas's coordinate space without a real
// pt-per-canvas-unit conversion this app doesn't define.
const THIN_STROKE_THRESHOLD = 3;

export type EditorPreflightSeverity = "blocking" | "warning";
export type EditorPreflightCode = "PAGE_COUNT" | "THIN_STROKE" | "MARGIN_SAFETY";

export interface EditorPreflightIssue {
  id: string;
  severity: EditorPreflightSeverity;
  code: EditorPreflightCode;
  message: string;
  /** The number the message is about (pages, lines…) — lets the UI re-word it in another language. */
  count: number;
  pageIds: string[];
}

/** Page frames deliberately sit in the margin band (see pageTemplates' FRAME_MARGIN), so the safe-area check and its autofix leave them alone. */
function isFrame(obj: PageObject): boolean {
  return obj.kind === "stamp" && obj.isFrame === true;
}

function lineBounds(line: LineData) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < line.points.length; i += 2) {
    const x = line.points[i];
    const y = line.points[i + 1];
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}

/** Saddle stitch's real constraint: total page count must be a multiple of 4. */
function checkPageCount(pages: BookPage[]): EditorPreflightIssue[] {
  if (pages.length === 0 || pages.length % 4 === 0) return [];
  return [
    {
      id: "page-count",
      severity: "blocking",
      code: "PAGE_COUNT",
      message: `Total pages: ${pages.length}. Saddle stitch binding needs a multiple of 4.`,
      count: pages.length,
      pageIds: [],
    },
  ];
}

/**
 * A ruled line — two points, dead straight — is drawn thin on purpose: the
 * grid of a sudoku, a copy-grid, a handwriting row. Hand-drawn strokes
 * always have many points. Rules are neither flagged nor thickened.
 */
function isRule(line: { points: number[] }): boolean {
  return line.points.length <= 4;
}
const isFaint = (l: { tool: string; strokeWidth: number; points: number[] }) => l.tool === "pen" && l.strokeWidth < THIN_STROKE_THRESHOLD && !isRule(l);

/** Pen strokes thinner than THIN_STROKE_THRESHOLD — see its own comment on why this is a heuristic, not a sourced spec. */
function checkThinStrokes(pages: BookPage[]): EditorPreflightIssue[] {
  const flaggedPageIds = pages.filter((p) => p.lines.some(isFaint)).map((p) => p.id);
  if (flaggedPageIds.length === 0) return [];
  const lineCount = pages.reduce((sum, p) => sum + p.lines.filter(isFaint).length, 0);
  return [
    {
      id: "thin-strokes",
      severity: "warning",
      code: "THIN_STROKE",
      message: `${lineCount} line${lineCount === 1 ? "" : "s"} below ${THIN_STROKE_THRESHOLD}pt — may print faint.`,
      count: lineCount,
      pageIds: flaggedPageIds,
    },
  ];
}

function exceedsMargin(b: Rect, safe: Rect): boolean {
  return b.left < safe.left || b.top < safe.top || b.right > safe.right || b.bottom > safe.bottom;
}

/** Placed objects (stamps/shapes/text) or pen strokes extending past the print-margin safe area. */
function checkMarginSafety(pages: BookPage[]): EditorPreflightIssue[] {
  const flaggedPageIds = pages
    .filter((p) => {
      const safe = safeArea(p);
      return p.objects.some((obj) => !obj.hidden && !isFrame(obj) && exceedsMargin(objectBounds(obj), safe)) || p.lines.some((l) => l.tool === "pen" && exceedsMargin(lineBounds(l), safe));
    })
    .map((p) => p.id);
  if (flaggedPageIds.length === 0) return [];
  return [
    {
      id: "margin-safety",
      severity: "warning",
      code: "MARGIN_SAFETY",
      message: `${flaggedPageIds.length} page${flaggedPageIds.length === 1 ? "" : "s"} — content extends past the 0.5in safe margin.`,
      count: flaggedPageIds.length,
      pageIds: flaggedPageIds,
    },
  ];
}

export function runEditorPreflightCheck(pages: BookPage[]): EditorPreflightIssue[] {
  return [...checkPageCount(pages), ...checkThinStrokes(pages), ...checkMarginSafety(pages)];
}

/** Adds blank pages until the count is a multiple of 4 — the page-count issue's real autofix. */
export function pagesNeededForMultipleOf4(count: number): number {
  return count % 4 === 0 ? 0 : 4 - (count % 4);
}

/** Thickens every pen stroke on the given pages up to the threshold — the thin-stroke issue's real autofix. */
export function thickenThinStrokes(pages: BookPage[]): BookPage[] {
  return pages.map((p) => ({
    ...p,
    lines: p.lines.map((l) => (isFaint(l) ? { ...l, strokeWidth: THIN_STROKE_THRESHOLD } : l)),
  }));
}

/** Moves (and if needed, shrinks) every visible object back inside the print-margin safe area — the margin-safety issue's real autofix. Uses the transformed bounds, so rotated/flipped objects land correctly. */
export function clampObjectsToMargin(pages: BookPage[]): BookPage[] {
  return pages.map((p) => {
    const area = safeArea(p);
    return { ...p, objects: p.objects.map((obj) => (obj.hidden || isFrame(obj) ? obj : (fitInside(obj, area) as PageObject))) };
  });
}
