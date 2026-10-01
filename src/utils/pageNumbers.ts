// Automatic page numbers and elements repeated on every page.
//
// Both are ordinary page objects carrying a marker (`role` / `repeatId`),
// so they export, preview and save like everything else with no extra
// book-level setting: numbering is "on" when the pages carry numbers, and
// syncPageNumbers re-stamps them after any structural change.

import type { BookPage, PageObject, TextData } from "@/types/editor";
import { makeId, text } from "@/components/editor/pageTemplates";
import { geometryFromSpace, LEGACY_SPACE } from "@/utils/pageGeometry";

/** "outer" = the corner away from the binding: right on odd pages, left on even ones. */
export type PageNumberMode = "off" | "center" | "outer";

const NUMBER_SIZE = 12;
const NUMBER_FONT = "Arial, Helvetica, sans-serif";

const isNumber = (o: PageObject): o is TextData => o.kind === "text" && o.role === "pageNumber";

export function pageNumberMode(pages: BookPage[]): PageNumberMode {
  const numbers = pages.flatMap((p) => p.objects.filter(isNumber));
  if (numbers.length === 0) return "off";
  return numbers.some((n) => n.align !== "center") ? "outer" : "center";
}

function numberFor(page: BookPage, index: number, mode: Exclude<PageNumberMode, "off">): TextData {
  const { safe } = geometryFromSpace(page.space ?? LEGACY_SPACE);
  return {
    ...text({ text: String(index + 1), x: safe.left, y: safe.bottom - NUMBER_SIZE * 1.4, width: safe.right - safe.left, fontSize: NUMBER_SIZE, fontFamily: NUMBER_FONT }),
    align: mode === "center" ? "center" : index % 2 === 0 ? "right" : "left",
    role: "pageNumber",
    locked: true,
  };
}

/** Sets (or, with "off", removes) the number on every page. Covers and blank backs stay bare. */
export function applyPageNumbers(pages: BookPage[], mode: PageNumberMode): BookPage[] {
  return pages.map((page, index) => {
    const rest = page.objects.filter((o) => !isNumber(o));
    const wants = mode !== "off" && !page.isCover && !page.isBlankBack;
    if (!wants) return rest.length === page.objects.length ? page : { ...page, objects: rest };
    const existing = page.objects.find(isNumber);
    const next = numberFor(page, index, mode);
    // Unchanged pages keep their identity (and the number its id), so undo history and React keys stay stable.
    if (existing && existing.text === next.text && existing.align === next.align && existing.y === next.y && existing.x === next.x && existing.width === next.width) return page;
    return { ...page, objects: [...rest, existing ? { ...next, id: existing.id } : next] };
  });
}

/** After pages were added, removed or reordered: re-stamp the numbers if the book has them. */
export function syncPageNumbers(pages: BookPage[]): BookPage[] {
  const mode = pageNumberMode(pages);
  return mode === "off" ? pages : applyPageNumbers(pages, mode);
}

/**
 * Copies the given objects of one page onto every other page, at the same
 * spot. The copies share a `repeatId` with their source, so the set can be
 * found again (removeRepeats). Pages that already carry a copy are skipped.
 */
export function repeatOnAllPages(pages: BookPage[], sourcePageId: string, objectIds: string[]): BookPage[] {
  const source = pages.find((p) => p.id === sourcePageId);
  if (!source) return pages;
  const tagged = source.objects.map((o) => (objectIds.includes(o.id) && !o.repeatId ? { ...o, repeatId: makeId("repeat") } : o));
  const repeated = tagged.filter((o) => objectIds.includes(o.id));
  if (repeated.length === 0) return pages;
  return pages.map((page) => {
    if (page.id === sourcePageId) return { ...page, objects: tagged };
    if (page.isCover || page.isBlankBack) return page;
    const have = new Set(page.objects.map((o) => o.repeatId).filter(Boolean));
    const copies = repeated.filter((o) => !have.has(o.repeatId)).map((o) => ({ ...o, id: makeId(o.kind), groupId: undefined }) as PageObject);
    return copies.length ? { ...page, objects: [...page.objects, ...copies] } : page;
  });
}

/** Removes every copy of the given repeated elements, on all pages. */
export function removeRepeats(pages: BookPage[], repeatIds: string[]): BookPage[] {
  const drop = new Set(repeatIds);
  return pages.map((page) => (page.objects.some((o) => o.repeatId && drop.has(o.repeatId)) ? { ...page, objects: page.objects.filter((o) => !o.repeatId || !drop.has(o.repeatId)) } : page));
}
