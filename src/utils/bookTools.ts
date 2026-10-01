// Whole-book edits: the same frame, background or line thickness on every
// page, and "master" elements — pieces repeated on every page (see
// pageNumbers.ts for how they get there) that stay in step when one copy
// is edited and appear on pages added later.

import type { BookPage, PageObject } from "@/types/editor";
import { createFrameStamp, makeId } from "@/components/editor/pageTemplates";
import { geometryFromSpace, LEGACY_SPACE } from "@/utils/pageGeometry";

const isContent = (p: BookPage) => !p.isCover && !p.isBlankBack;
const isFrame = (o: PageObject) => o.kind === "stamp" && Boolean(o.isFrame);

/** The same frame (or none) on every content page, sized to each page. */
export function applyFrameToAll(pages: BookPage[], frameId: string | null): BookPage[] {
  return pages.map((page) => {
    if (!isContent(page)) return page;
    const rest = page.objects.filter((o) => !isFrame(o));
    const frame = frameId ? createFrameStamp(frameId, geometryFromSpace(page.space ?? LEGACY_SPACE)) : null;
    if (!frame && rest.length === page.objects.length) return page;
    return { ...page, objects: frame ? [frame, ...rest] : rest };
  });
}

export function applyPatternToAll(pages: BookPage[], patternId: string | null): BookPage[] {
  return pages.map((page) => (!isContent(page) || (page.backgroundPatternId ?? null) === patternId ? page : { ...page, backgroundPatternId: patternId }));
}

/** Hairlines (worksheet grids, guides) are drawn thin on purpose and stay as they are. */
const HAIRLINE = 1;

/**
 * One thickness for every drawn line: pen strokes and shape outlines.
 * `pageId` limits it to one page. Pictures (stamps) are images — their
 * lines can't be changed here.
 */
export function setLineWidth(pages: BookPage[], width: number, pageId?: string): BookPage[] {
  return pages.map((page) => {
    if (pageId ? page.id !== pageId : page.isBlankBack) return page;
    let changed = false;
    const lines = page.lines.map((l) => {
      if (l.tool !== "pen" || l.strokeWidth < HAIRLINE || l.strokeWidth === width) return l;
      changed = true;
      return { ...l, strokeWidth: width };
    });
    const objects = page.objects.map((o) => {
      if (o.kind !== "shape" || o.strokeWidth < HAIRLINE || o.strokeWidth === width) return o;
      changed = true;
      return { ...o, strokeWidth: width };
    });
    return changed ? { ...page, lines, objects } : page;
  });
}

/**
 * After an edit on one page: every repeated element that changed there
 * (compared with `before`, that page's objects prior to the edit) is
 * brought up to date on all the other pages. Removing a copy from one
 * page stays local — that's how a page opts out.
 */
export function propagateRepeats(pages: BookPage[], sourcePageId: string, before: PageObject[]): BookPage[] {
  const source = pages.find((p) => p.id === sourcePageId);
  if (!source) return pages;
  const was = new Map(before.map((o) => [o.id, o]));
  const changed = new Map<string, PageObject>();
  for (const o of source.objects) if (o.repeatId && was.has(o.id) && was.get(o.id) !== o) changed.set(o.repeatId, o);
  if (changed.size === 0) return pages;
  return pages.map((page) => {
    if (page.id === sourcePageId || !page.objects.some((o) => o.repeatId && changed.has(o.repeatId))) return page;
    return { ...page, objects: page.objects.map((o) => (o.repeatId && changed.has(o.repeatId) ? ({ ...changed.get(o.repeatId)!, id: o.id, groupId: o.groupId } as PageObject) : o)) };
  });
}

/** Pages about to join the book get a copy of every repeated element the book already carries. */
export function withRepeats(newPages: BookPage[], existing: BookPage[]): BookPage[] {
  const masters = new Map<string, PageObject>();
  for (const page of existing) for (const o of page.objects) if (o.repeatId && !masters.has(o.repeatId)) masters.set(o.repeatId, o);
  if (masters.size === 0) return newPages;
  return newPages.map((page) => {
    if (!isContent(page)) return page;
    const have = new Set(page.objects.map((o) => o.repeatId));
    const copies = [...masters.values()].filter((o) => !have.has(o.repeatId)).map((o) => ({ ...o, id: makeId(o.kind), groupId: undefined }) as PageObject);
    return copies.length ? { ...page, objects: [...page.objects, ...copies] } : page;
  });
}

/** Subjects for "more pages like this one": the same subject, each seen a different way. */
const VARIATIONS = ["a different pose", "seen from the side", "with a friend", "in a new place", "close-up, big and simple", "playing", "sleeping", "eating"];

export function variationSubjects(subject: string, count: number): string[] {
  const base = subject.trim();
  if (!base) return [];
  return VARIATIONS.slice(0, Math.max(1, Math.min(VARIATIONS.length, count))).map((v) => `${base}, ${v}`);
}
