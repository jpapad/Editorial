// Page art: one clean picture of each page's lines, for the kids' mobile app.
//
// The app colors a book page as an image (fill a white area bounded by the
// lines) instead of re-implementing the editor's renderer. The studio renders
// each page's art in the background (PageArtRenderer.tsx), uploads it to
// Storage and keeps the link on the page itself (BookPage.artUrl), so the
// child-side functions that already return a book's pages (kid_book,
// get_shared_book) hand it over with no database change.
//
// artKey says which content the picture shows: a page whose key no longer
// matches is rendered again; one that still matches never is.

import type { BookPage } from "@/types/editor";

/** Longest side of a page's art, in pixels — sharp on a tablet, small enough to download on a phone. */
export const PAGE_ART_MAX_PX = 2048;

/** cyrb53: a fast, well-spread 53-bit string hash (not cryptographic — it only has to notice changes). */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Pages are replaced, never changed in place, so a page object's key never changes.
const keys = new WeakMap<BookPage, string>();

/**
 * What the page's art depends on: what's drawn and the canvas it's drawn on.
 * Not its id, number in the book, preview thumbnail, a child's paint or the
 * art link itself — none of those change the lines.
 */
export function pageArtKey(page: BookPage): string {
  const cached = keys.get(page);
  if (cached) return cached;
  const key = hash53(
    JSON.stringify({
      space: page.space ?? null,
      lines: page.lines,
      objects: page.objects,
      pattern: page.backgroundPatternId ?? null,
      cover: page.isCover ? (page.coverBackgroundColor ?? true) : false,
    })
  );
  keys.set(page, key);
  return key;
}

/** Blank backs aren't given to children (kid_book leaves them out), so they need no art. */
export function needsPageArt(page: BookPage): boolean {
  return !page.isBlankBack && page.artKey !== pageArtKey(page);
}

/** The next page whose art is missing or out of date, skipping ids that already failed this session. */
export function nextPageForArt(pages: BookPage[], skip: ReadonlySet<string> = new Set()): BookPage | null {
  return pages.find((p) => !skip.has(p.id) && needsPageArt(p)) ?? null;
}
