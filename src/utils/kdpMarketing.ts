// KDP Metadata & Marketing Copy Generator — Sprint 5.
//
// Deliberately deterministic and synchronous: everything here is *derived*
// from the actual BookState JSON (title, page count, trim size, which
// activity types are present, vocabulary words scraped out of "X is for
// Y" titles) rather than an LLM call. That keeps it testable without an
// API key and reproducible between runs — a "Generate Metadata" click
// shouldn't return different keywords each time. Callers who want an
// AI-polished description can pass `enhanceDescription`, which runs after
// the deterministic draft is built (see generateAPlusContentHtml) — e.g.
// wiring in aiGenerator.ts's OpenAI chat call. That's optional, not a hard
// dependency of this module.

import type { BookState, CanvasElementType } from "@/types/book";

export interface KdpMetadata {
  title: string;
  subtitle: string;
  /** Exactly 7 — KDP's backend keyword field count. */
  keywords: string[];
  aPlusContentHtml: string;
}

/** KDP's per-keyword-field character limit. */
export const KDP_KEYWORD_MAX_LENGTH = 50;
export const KDP_KEYWORD_SLOT_COUNT = 7;

const TITLE_VOCAB_PATTERN = /^[^\s]+ is for ([A-Za-zΑ-Ωα-ω]+)/;

const ACTIVITY_LABELS: Partial<Record<CanvasElementType, string>> = {
  TRACING_GRID: "letter tracing practice",
  LETTER_GUIDE: "large-letter tracing guides",
  DOT_TO_DOT: "dot-to-dot puzzles",
  SVG_MAIN_ART: "full-page coloring illustrations",
  SVG_MINI_GROUP: "themed mini coloring icons",
};

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateToLimit(word: string, maxLength: number): string {
  if (word.length <= maxLength) return word;
  return word.slice(0, maxLength).trim();
}

/** Scrapes "X is for Y" title text across every spread to build a real vocabulary list from the book's own content. */
function extractVocabWords(book: BookState): string[] {
  const words = new Set<string>();
  for (const spread of book.spreads) {
    for (const page of [spread.leftPage, spread.rightPage]) {
      for (const element of page.elements) {
        if (element.type !== "TITLE_TEXT") continue;
        const match = element.text.match(TITLE_VOCAB_PATTERN);
        if (match) words.add(match[1]);
      }
    }
  }
  return [...words];
}

/** Which activity types actually appear anywhere in the book, in a stable order — drives both the subtitle and the A+ bullet list. */
function detectActivityTypes(book: BookState): CanvasElementType[] {
  const present = new Set<CanvasElementType>();
  for (const spread of book.spreads) {
    for (const page of [spread.leftPage, spread.rightPage]) {
      for (const element of page.elements) present.add(element.type);
    }
  }
  return (Object.keys(ACTIVITY_LABELS) as CanvasElementType[]).filter((type) => present.has(type));
}

export function generateKdpTitle(book: BookState): string {
  return book.title.trim();
}

export interface KdpSubtitleOptions {
  /** KDP listings conventionally state a target age range; this app has no reliable way to derive one from the book content, so it's a caller-supplied default rather than a fabricated "fact". */
  ageRange?: string;
}

export function generateKdpSubtitle(book: BookState, options: KdpSubtitleOptions = {}): string {
  const { trimWidthIn, trimHeightIn } = book.settings;
  const ageRange = options.ageRange ?? "Ages 3-5";
  const activities = detectActivityTypes(book).map((type) => ACTIVITY_LABELS[type]!);
  const pageCount = book.spreads.length * 2;

  const activityClause = activities.length > 0 ? ` with ${formatList(activities)}` : "";
  return `A ${trimWidthIn}x${trimHeightIn}in Activity Book${activityClause} for Kids ${ageRange} (${pageCount} Pages)`;
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const GENERIC_KEYWORD_POOL = ["kids activity book", "preschool workbook", "alphabet coloring book", "toddler learning book", "homeschool workbook"];

/**
 * Builds exactly KDP_KEYWORD_SLOT_COUNT keywords: vocabulary words found in
 * the book's own titles first (most specific/relevant), then detected
 * activity types, then generic KDP search terms as filler — deduped, each
 * truncated to KDP's field limit, order preserved so the most relevant
 * terms come first.
 */
export function generateKdpKeywords(book: BookState): string[] {
  const vocabWords = extractVocabWords(book).map((w) => `${w.toLowerCase()} coloring page`);
  const activityTerms = detectActivityTypes(book).map((type) => ACTIVITY_LABELS[type]!);
  const candidates = [...vocabWords, ...activityTerms, ...GENERIC_KEYWORD_POOL];

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const candidate of candidates) {
    const truncated = truncateToLimit(candidate, KDP_KEYWORD_MAX_LENGTH);
    const key = truncated.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(truncated);
    if (keywords.length === KDP_KEYWORD_SLOT_COUNT) break;
  }

  // Pad with generic filler if the book didn't yield enough unique terms
  // (e.g. a book with very few pages) — always return exactly 7 slots.
  let fillerIndex = 0;
  while (keywords.length < KDP_KEYWORD_SLOT_COUNT && fillerIndex < GENERIC_KEYWORD_POOL.length * 3) {
    const filler = `${GENERIC_KEYWORD_POOL[fillerIndex % GENERIC_KEYWORD_POOL.length]} ${Math.floor(fillerIndex / GENERIC_KEYWORD_POOL.length) + 2}`;
    const key = filler.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      keywords.push(filler);
    }
    fillerIndex++;
  }

  return keywords;
}

export function generateAPlusContentHtml(book: BookState): string {
  const pageCount = book.spreads.length * 2;
  const vocabWords = extractVocabWords(book);
  const activities = detectActivityTypes(book).map((type) => ACTIVITY_LABELS[type]!);
  const title = escapeHtml(book.title.trim());

  const featureBullets = [
    `${pageCount} large ${book.settings.trimWidthIn}x${book.settings.trimHeightIn}in pages, printed one-sided so nothing bleeds through`,
    ...activities.map((label) => label.charAt(0).toUpperCase() + label.slice(1)),
    vocabWords.length > 0 ? `Covers vocabulary: ${vocabWords.map(escapeHtml).join(", ")}` : null,
  ].filter((line): line is string => line !== null);

  return [
    `<h2>${title}</h2>`,
    `<p>${title} is a ${pageCount}-page activity book designed to make learning feel like play.</p>`,
    "<ul>",
    ...featureBullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`),
    "</ul>",
    "<p>A perfect gift for birthdays, holidays, or a rainy afternoon at the kitchen table.</p>",
  ].join("\n");
}

export interface KdpMetadataOptions extends KdpSubtitleOptions {
  /** Optional post-processing hook to AI-polish the deterministic HTML draft (e.g. via aiGenerator.ts's chat call) — never called internally, so this module has no hard dependency on a live API. */
  enhanceDescription?: (draftHtml: string) => Promise<string>;
}

export async function generateKdpMetadata(book: BookState, options: KdpMetadataOptions = {}): Promise<KdpMetadata> {
  const draftHtml = generateAPlusContentHtml(book);
  return {
    title: generateKdpTitle(book),
    subtitle: generateKdpSubtitle(book, options),
    keywords: generateKdpKeywords(book),
    aPlusContentHtml: options.enhanceDescription ? await options.enhanceDescription(draftHtml) : draftHtml,
  };
}
