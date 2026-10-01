// "How ready is this book to print?" as one number, from the book's data
// alone (no rendering), so it can show in the editor and on library cards.
// Built on the export preflight (editorPreflight.ts) plus two book-level
// facts. The raster checks (line gaps, age fit) stay on-demand in the
// editor's Page panel and aren't part of the score.

import { runEditorPreflightCheck } from "@/utils/editorPreflight";
import type { BookPage } from "@/types/editor";

/** Amazon KDP's minimum page count for a paperback. */
export const KDP_MIN_PAGES = 24;

export type ReadinessCheck = "min-pages" | "page-count" | "thin-strokes" | "margin" | "empty-pages" | "duplicates";
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

function hash(text: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return h;
}

/**
 * What a page shows, as one number: its pictures, shapes, text and strokes
 * with positions rounded to 2pt — ids, page numbers and elements repeated
 * on every page left out. Two pages with the same signature print the same.
 */
export function pageSignature(page: BookPage): number {
  const cached = signatures.get(page);
  if (cached !== undefined) return cached;
  const value = computeSignature(page);
  signatures.set(page, value);
  return value;
}

// Pages are replaced, never mutated, so a signature can be remembered per page object —
// the score is recomputed on every editor render.
const signatures = new WeakMap<BookPage, number>();

/** A picture's data URL can be megabytes: its length, both ends and a sparse sample tell pictures apart. */
function sampleSrc(src: string): string {
  if (src.length <= 400) return src;
  let sample = `${src.length}|${src.slice(0, 120)}|${src.slice(-120)}|`;
  const step = Math.ceil(src.length / 200);
  for (let i = 0; i < src.length; i += step) sample += src[i];
  return sample;
}

function computeSignature(page: BookPage): number {
  const r = (v: number) => Math.round(v / 2);
  let h = hash(page.backgroundPatternId ?? "", 7);
  for (const o of page.objects) {
    if (o.hidden || o.role === "pageNumber" || o.repeatId) continue;
    h = hash(`${o.kind}|${r(o.x)}|${r(o.y)}|${r(o.width * o.scaleX)}|${r(o.height * o.scaleY)}|${r(o.rotation)}`, h);
    h = hash(o.kind === "stamp" ? sampleSrc(o.src) : o.kind === "text" ? `${o.text}|${o.fontFamily}|${o.fontSize}` : `${o.shapeKind}|${o.fill}`, h);
  }
  for (const l of page.lines) h = hash(`${l.tool}|${r(l.strokeWidth)}|${l.points.map(r).join(",")}`, h);
  return h;
}

/** Pages that repeat an earlier page exactly — KDP treats repeated content as low quality. */
export function duplicatePages(pages: BookPage[]): string[] {
  const seen = new Set<number>();
  const out: string[] = [];
  for (const page of pages) {
    if (page.isBlankBack || isEmptyPage(page)) continue;
    const sig = pageSignature(page);
    if (seen.has(sig)) out.push(page.id);
    else seen.add(sig);
  }
  return out;
}

export function bookReadiness(pages: BookPage[]): Readiness {
  const preflight = runEditorPreflightCheck(pages);
  const issue = (code: string) => preflight.find((i) => i.code === code);
  const thin = issue("THIN_STROKE");
  const margin = issue("MARGIN_SAFETY");
  const empty = pages.filter(isEmptyPage).map((p) => p.id);
  const duplicates = duplicatePages(pages);

  const items: ReadinessItem[] = [
    { id: "min-pages", ok: pages.length >= KDP_MIN_PAGES, count: pages.length, pageIds: [], penalty: pages.length >= KDP_MIN_PAGES ? 0 : 10 },
    { id: "page-count", ok: !issue("PAGE_COUNT"), count: pages.length, pageIds: [], penalty: issue("PAGE_COUNT") ? 10 : 0 },
    { id: "thin-strokes", ok: !thin, count: thin?.count ?? 0, pageIds: thin?.pageIds ?? [], penalty: thin ? cap(thin.pageIds.length, 4, 20) : 0 },
    { id: "margin", ok: !margin, count: margin?.count ?? 0, pageIds: margin?.pageIds ?? [], penalty: margin ? cap(margin.pageIds.length, 5, 20) : 0 },
    { id: "empty-pages", ok: empty.length === 0, count: empty.length, pageIds: empty, penalty: cap(empty.length, 5, 20) },
    { id: "duplicates", ok: duplicates.length === 0, count: duplicates.length, pageIds: duplicates, penalty: cap(duplicates.length, 5, 20) },
  ];
  const score = pages.length === 0 ? 0 : Math.max(0, 100 - items.reduce((sum, i) => sum + i.penalty, 0));
  const level: ReadinessLevel = score >= 90 ? "ready" : score >= 70 ? "almost" : "work";
  return { score, level, items };
}
