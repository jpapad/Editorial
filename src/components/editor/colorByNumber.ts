// Colour-by-number from the user's own page: a copy of the page with a
// small number in every area and a key at the bottom. The areas come from
// regions.ts (what the paint bucket would fill); this file only lays the
// result out as ordinary, editable page objects.

import type { BookPage, PageObject, PageSpace } from "@/types/editor";
import { duplicatePage, makeId, shape, text } from "@/components/editor/pageTemplates";
import { NUMBER_COLORS, type RegionNumber } from "@/components/studio/editor/regions";
import { geometryFromSpace, LEGACY_SPACE } from "@/utils/pageGeometry";
import { identityT, type TFunction } from "@/lib/i18n-core";

const NUMBER_FONT = "Arial, Helvetica, sans-serif";
const NUMBER_INK = "#4b5563";
const KEY_HEIGHT = 30;

/** Null when the page has no area big enough to number. */
export function colorByNumberPage(source: BookPage, numbers: RegionNumber[], tx: TFunction = identityT): BookPage | null {
  if (numbers.length === 0) return null;
  const space: PageSpace = source.space ?? LEGACY_SPACE;
  const { safe } = geometryFromSpace(space);
  const used = [...new Set(numbers.map((n) => n.n))].sort((a, b) => a - b);
  const groupId = makeId("group"); // the numbers move (and delete) as one

  const labels: PageObject[] = numbers.map(({ n, x, y, depth }) => {
    const fontSize = Math.max(6, Math.min(14, depth * 1.1));
    const w = fontSize * 2;
    return text({ text: String(n), x: x - w / 2, y: y - fontSize * 0.6, width: w, height: fontSize * 1.2, fontSize, fontFamily: NUMBER_FONT, fill: NUMBER_INK, groupId });
  });

  // The key: a white strip along the bottom of the safe area — swatch, number, colour name.
  const keyId = makeId("group");
  const width = safe.right - safe.left;
  const top = safe.bottom - KEY_HEIGHT - 20; // leaves the page-number line free
  const slot = width / used.length;
  const key: PageObject[] = [shape({ shapeKind: "rectangle", x: safe.left, y: top, width, height: KEY_HEIGHT, fill: "#ffffff", stroke: "#111827", strokeWidth: 1.5, groupId: keyId })];
  used.forEach((n, i) => {
    const color = NUMBER_COLORS[n - 1];
    const x = safe.left + i * slot + 6;
    key.push(shape({ shapeKind: "circle", x, y: top + 6, width: 18, height: 18, fill: color.hex, stroke: "#111827", strokeWidth: 1, groupId: keyId }));
    key.push(text({ text: `${n} ${tx(color.name)}`, x: x + 22, y: top + 9, width: slot - 30, height: 14, fontSize: Math.min(11, (slot - 30) / 5.2), fontFamily: NUMBER_FONT, align: "left", groupId: keyId }));
  });

  const copy = duplicatePage(source, source.pageNumber + 1);
  return { ...copy, fillDataUrl: undefined, thumbnailDataUrl: undefined, traceImage: undefined, objects: [...copy.objects.filter((o) => o.role !== "pageNumber"), ...labels, ...key] };
}
