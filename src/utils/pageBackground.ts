// Page backgrounds: a color, a gradient, a pattern, or a picture — on the
// page itself (BookPage.background, drawn under everything) or, for a scene
// to color in, as a locked edge-to-edge stamp with role "pageBackground"
// (so the bucket sees its lines). Shared by "page from instructions", the
// "background on every page" tool and the print checks.

import { makeId } from "@/components/editor/pageTemplates";
import type { BookPage, PageObject, PageSpace, StampData } from "@/types/editor";

export const isBackgroundObject = (o: PageObject) => o.role === "pageBackground";

/** Anything printed right up to the page's edges — which needs bleed to print cleanly on KDP. */
export function hasEdgeBackground(page: BookPage): boolean {
  const bg = page.background;
  return Boolean(bg?.color || bg?.gradient || bg?.image || page.backgroundPatternId || page.objects.some(isBackgroundObject));
}

/** A picture scaled to cover the whole canvas (bleed included), centred, never stretched — locked at the back. */
export function coverStamp(src: string, size: { width: number; height: number }, space: PageSpace, label?: string): StampData {
  const k = Math.max(space.width / size.width, space.height / size.height);
  const width = size.width * k;
  const height = size.height * k;
  return { kind: "stamp", id: makeId("stamp"), src, x: (space.width - width) / 2, y: (space.height - height) / 2, width, height, rotation: 0, scaleX: 1, scaleY: 1, filter: "none", locked: true, role: "pageBackground", label };
}

/**
 * Every page gets `source`'s background — color, gradient, picture, pattern
 * and a background scene — in place of its own. Content is left alone.
 * `exceptFirst`: keep the first page (often the cover-like title page) as it is.
 */
export function applyBackgroundToAll(pages: BookPage[], sourceId: string, { exceptFirst = false }: { exceptFirst?: boolean } = {}): BookPage[] {
  const source = pages.find((p) => p.id === sourceId);
  if (!source) return pages;
  const scenes = source.objects.filter(isBackgroundObject);
  return pages.map((page, i) => {
    if (page.id === sourceId || page.isBlankBack || (exceptFirst && i === 0)) return page;
    const space = page.space ?? source.space;
    const copies = scenes.map((o) => (o.kind === "stamp" && space && source.space && (space.width !== source.space.width || space.height !== source.space.height) ? coverStamp(o.src, { width: o.width, height: o.height }, space, o.label) : { ...o, id: makeId(o.kind) }));
    return {
      ...page,
      background: source.background ? { ...source.background } : undefined,
      backgroundPatternId: source.backgroundPatternId ?? null,
      objects: [...copies, ...page.objects.filter((o) => !isBackgroundObject(o))],
    };
  });
}

/** Pages with an edge-to-edge background in a book printed without bleed. */
export function edgeWithoutBleed(pages: BookPage[]): string[] {
  return pages.filter((p) => hasEdgeBackground(p) && !(p.space && p.space.bleed > 0)).map((p) => p.id);
}
