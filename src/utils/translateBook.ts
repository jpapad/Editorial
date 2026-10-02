// The words of a book, gathered for translation and put back afterwards.
// Runs in the browser; the translating itself happens on the server
// (/api/translate-texts).

import type { BookPage, TextData } from "@/types/editor";

/**
 * Whether a text is something to translate. Left alone: page numbers,
 * lone letters and digits (puzzle grids, tracing rows, sudoku), and
 * dashed tracing words — those teach the letters of the original language.
 */
export function isTranslatable(obj: TextData): boolean {
  if (obj.role === "pageNumber" || obj.dashed) return false;
  const letters = (obj.template ?? obj.text).replace(/[^\p{L}]/gu, "");
  return letters.length >= 2;
}

/** The distinct texts worth translating, in book order (each once, however often it repeats). */
export function collectTexts(pages: BookPage[]): string[] {
  const seen = new Set<string>();
  for (const page of pages) {
    for (const o of page.objects) {
      if (o.kind !== "text" || !isTranslatable(o)) continue;
      seen.add(o.template ?? o.text);
    }
  }
  return [...seen];
}

/** The pages with every translatable text swapped for its translation; texts without one stay as they are. */
export function applyTranslations(pages: BookPage[], translations: Map<string, string>): BookPage[] {
  return pages.map((page) => {
    let changed = false;
    const objects = page.objects.map((o) => {
      if (o.kind !== "text" || !isTranslatable(o)) return o;
      const next = translations.get(o.template ?? o.text);
      if (!next || next === (o.template ?? o.text)) return o;
      changed = true;
      // A personalised text keeps its placeholder wording; the name is put back by re-personalising.
      return o.template ? { ...o, template: next, text: next } : { ...o, text: next };
    });
    return changed ? { ...page, objects, thumbnailDataUrl: undefined } : page;
  });
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
