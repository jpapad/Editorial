// "How ready is this book to print?" as one number, from the book's data
// alone (no rendering), so it can show in the editor and on library cards.
// Built on the export preflight (editorPreflight.ts) plus two book-level
// facts. The raster checks (line gaps, age fit) stay on-demand in the
// editor's Page panel and aren't part of the score.

import { runEditorPreflightCheck } from "@/utils/editorPreflight";
import type { BookPage } from "@/types/editor";

/** Amazon KDP's minimum page count for a paperback. */
export const KDP_MIN_PAGES = 24;

export type ReadinessCheck = "min-pages" | "page-count" | "thin-strokes" | "margin" | "empty-pages";
export type ReadinessLevel = "ready" | "almost" | "work";

export interface ReadinessItem {
  id: ReadinessCheck;
  ok: boolean;
  /** Pages, lines… — what the item's message counts. */
  count: number;
  /** Pages this item points at (for "go to page"). */
  pageIds: string[];
  /** Points taken off the score. */
  penalty: number;
}

export interface Readiness {
  score: number;
  level: ReadinessLevel;
  items: ReadinessItem[];
}

const cap = (n: number, per: number, max: number) => Math.min(max, n * per);

function isEmptyPage(p: BookPage): boolean {
  return !p.isBlankBack && p.lines.length === 0 && p.objects.filter((o) => !o.hidden).length === 0 && !p.fillDataUrl;
}

export function bookReadiness(pages: BookPage[]): Readiness {
  const preflight = runEditorPreflightCheck(pages);
  const issue = (code: string) => preflight.find((i) => i.code === code);
  const thin = issue("THIN_STROKE");
  const margin = issue("MARGIN_SAFETY");
  const empty = pages.filter(isEmptyPage).map((p) => p.id);

  const items: ReadinessItem[] = [
    { id: "min-pages", ok: pages.length >= KDP_MIN_PAGES, count: pages.length, pageIds: [], penalty: pages.length >= KDP_MIN_PAGES ? 0 : 10 },
    { id: "page-count", ok: !issue("PAGE_COUNT"), count: pages.length, pageIds: [], penalty: issue("PAGE_COUNT") ? 10 : 0 },
    { id: "thin-strokes", ok: !thin, count: thin?.count ?? 0, pageIds: thin?.pageIds ?? [], penalty: thin ? cap(thin.pageIds.length, 4, 20) : 0 },
    { id: "margin", ok: !margin, count: margin?.count ?? 0, pageIds: margin?.pageIds ?? [], penalty: margin ? cap(margin.pageIds.length, 5, 20) : 0 },
    { id: "empty-pages", ok: empty.length === 0, count: empty.length, pageIds: empty, penalty: cap(empty.length, 5, 20) },
  ];
  const score = pages.length === 0 ? 0 : Math.max(0, 100 - items.reduce((sum, i) => sum + i.penalty, 0));
  const level: ReadinessLevel = score >= 90 ? "ready" : score >= 70 ? "almost" : "work";
  return { score, level, items };
}
