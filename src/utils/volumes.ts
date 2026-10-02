// "Start the next volume": a new book with the same shape as an existing
// one — front matter, frames, backgrounds, repeated elements and page
// numbers kept; the pictures themselves cleared, ready for a new theme.

import type { BookPage } from "@/types/editor";
import { duplicatePage } from "@/components/editor/pageTemplates";

/** "Farm Animals" → "Farm Animals 2"; "Farm Animals 2" → "Farm Animals 3". */
export function nextVolumeTitle(title: string): string {
  const match = /^(.*?)(\d+)\s*$/.exec(title.trim());
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${title.trim()} 2`;
}

/** A page whose content is a picture to colour (as opposed to front matter, a certificate, a worksheet made of text and shapes). */
export function isPicturePage(page: BookPage): boolean {
  if (page.fillDataUrl) return true;
  if (page.objects.some((o) => o.kind === "stamp" && !o.isFrame && !o.repeatId)) return true;
  // Hand-drawn strokes: solid, more than two points. Ruled and dashed lines belong to templates and worksheets.
  return page.lines.some((l) => l.tool === "pen" && !l.style && l.points.length > 4);
}

/**
 * The next volume's pages: every picture page becomes an empty page that
 * keeps its frame, background, repeated elements and page number; every
 * other page is copied as it is.
 */
export function nextVolumePages(pages: BookPage[]): BookPage[] {
  return pages.map((page, i) => {
    const copy = duplicatePage(page, i + 1);
    const base = { ...copy, isCover: page.isCover, thumbnailDataUrl: undefined, completedAt: undefined, traceImage: undefined };
    if (!isPicturePage(page)) return base;
    return { ...base, fillDataUrl: undefined, lines: [], objects: copy.objects.filter((o) => (o.kind === "stamp" && o.isFrame) || o.repeatId || o.role === "pageNumber") };
  });
}
