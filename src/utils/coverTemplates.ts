// Ready-made cover layouts: title, subtitle, author and a picture from the
// book, arranged on the front panel (plus a short blurb on the back) in a
// few different ways. Everything it places is ordinary, editable page
// objects marked `role: "coverLayout"`, so choosing another layout swaps
// them out and leaves whatever the user added by hand alone.

import type { BookPage, PageObject, ShapeData, StampData, TextData } from "@/types/editor";
import { makeId } from "@/components/editor/pageTemplates";
import { coverSafeAreas, type CoverLayout } from "@/utils/coverGeometry";

export type CoverStyle = "classic" | "band" | "framed" | "bold";

export const COVER_STYLES: { value: CoverStyle; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "band", label: "Title band" },
  { value: "framed", label: "Framed picture" },
  { value: "bold", label: "Big title" },
];

export interface CoverContent {
  title: string;
  subtitle?: string;
  author?: string;
  /** Printed on the back, e.g. "40 pages to color". */
  blurb?: string;
  picture?: { src: string; width: number; height: number };
}

const TITLE_FONT = '"Fredoka", "Comic Sans MS", cursive';
const PLAIN_FONT = "Arial, Helvetica, sans-serif";
const INK = "#111827";
const role = "coverLayout" as const;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A line of text sized to fit its box: as tall as allowed, shrunk until the longest word-wrapped line fits the width. */
function fitted(value: string, box: Box, maxSize: number, extra: Partial<TextData> = {}): TextData {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const chars = Math.max(1, [...value].length);
  // ~0.6 em per glyph in the title font; allow wrapping onto as many lines as the height holds.
  let size = maxSize;
  for (; size > 10; size -= 2) {
    const perLine = Math.max(1, Math.floor(width / (size * 0.6)));
    const lines = Math.ceil(chars / perLine);
    if (lines * size * 1.2 <= height) break;
  }
  const lines = Math.ceil(chars / Math.max(1, Math.floor(width / (size * 0.6))));
  const used = lines * size * 1.2;
  return {
    kind: "text",
    id: makeId("text"),
    text: value,
    fontFamily: TITLE_FONT,
    fontSize: size,
    align: "center",
    fill: INK,
    isDragging: false,
    x: box.left,
    y: box.top + (height - used) / 2,
    width,
    height: used,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    role,
    ...extra,
  };
}

function picture(pic: NonNullable<CoverContent["picture"]>, box: Box): StampData {
  const k = Math.min((box.right - box.left) / pic.width, (box.bottom - box.top) / pic.height);
  const width = pic.width * k;
  const height = pic.height * k;
  return { kind: "stamp", id: makeId("stamp"), src: pic.src, x: (box.left + box.right - width) / 2, y: (box.top + box.bottom - height) / 2, width, height, rotation: 0, scaleX: 1, scaleY: 1, filter: "none", role };
}

const rect = (box: Box, fill: string, stroke: string, strokeWidth: number): ShapeData => ({ kind: "shape", id: makeId("shape"), shapeKind: "rectangle", x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top, rotation: 0, scaleX: 1, scaleY: 1, fill, stroke, strokeWidth, role });

/** The band of a box between two fractions of its height. */
const slice = (box: Box, from: number, to: number, pad = 0): Box => ({ left: box.left + pad, right: box.right - pad, top: box.top + (box.bottom - box.top) * from, bottom: box.top + (box.bottom - box.top) * to });

export function coverObjects(layout: CoverLayout, style: CoverStyle, content: CoverContent): PageObject[] {
  const [backSafe, frontSafe] = coverSafeAreas(layout);
  const front: Box = { left: frontSafe.left + 18, top: frontSafe.top + 18, right: frontSafe.right - 18, bottom: frontSafe.bottom - 18 };
  const out: PageObject[] = [];
  const title = content.title.trim() || "Coloring Book";
  const subtitle = content.subtitle?.trim();
  const author = content.author?.trim();
  const small = (value: string, box: Box, size: number, extra: Partial<TextData> = {}) => fitted(value, box, size, { fontFamily: PLAIN_FONT, ...extra });

  if (style === "classic") {
    out.push(fitted(title, slice(front, 0, 0.24), 64, { outline: true }));
    if (content.picture) out.push(picture(content.picture, slice(front, 0.26, 0.82)));
    if (subtitle) out.push(small(subtitle, slice(front, 0.84, 0.92), 20));
    if (author) out.push(small(author, slice(front, 0.93, 1), 15));
  } else if (style === "band") {
    if (content.picture) out.push(picture(content.picture, slice(front, 0, 0.66)));
    // The band runs to the trim edges of the front panel (it is a solid block, so it may sit in the margin).
    const band: Box = { left: layout.front.left, right: layout.front.right, top: layout.front.top + (layout.front.bottom - layout.front.top) * 0.7, bottom: layout.front.top + (layout.front.bottom - layout.front.top) * 0.93 };
    out.push(rect(band, INK, INK, 0));
    const inner: Box = { left: front.left, right: front.right, top: band.top + 10, bottom: band.bottom - 10 };
    out.push(fitted(title, subtitle ? slice(inner, 0, 0.68) : inner, 54, { fill: "#ffffff" }));
    if (subtitle) out.push(small(subtitle, slice(inner, 0.7, 1), 17, { fill: "#ffffff" }));
    if (author) out.push(small(author, { ...front, top: band.bottom + 6, bottom: front.bottom }, 14));
  } else if (style === "framed") {
    out.push(fitted(title, slice(front, 0, 0.2), 54, { outline: true }));
    const frame = slice(front, 0.23, 0.84, 12);
    out.push(rect(frame, "#ffffff", INK, 6));
    if (content.picture) out.push(picture(content.picture, { left: frame.left + 14, top: frame.top + 14, right: frame.right - 14, bottom: frame.bottom - 14 }));
    if (subtitle) out.push(small(subtitle, slice(front, 0.86, 0.94), 19));
    if (author) out.push(small(author, slice(front, 0.94, 1), 14));
  } else {
    if (subtitle) out.push(small(subtitle, slice(front, 0, 0.07), 17));
    out.push(fitted(title, slice(front, 0.08, 0.5), 96));
    if (content.picture) out.push(picture(content.picture, slice(front, 0.52, 0.93)));
    if (author) out.push(small(author, slice(front, 0.94, 1), 15));
  }

  // Back cover: the title again and a blurb, kept clear of the barcode box at the bottom.
  const back: Box = { left: backSafe.left + 36, right: backSafe.right - 36, top: backSafe.top + 60, bottom: layout.barcode.top - 40 };
  out.push(fitted(title, slice(back, 0, 0.16), 34, { outline: true }));
  const lines = [subtitle, content.blurb?.trim()].filter(Boolean).join("\n\n");
  if (lines) out.push(small(lines, slice(back, 0.2, 0.5), 17));
  return out;
}

/** The cover page with the layout applied: earlier layout objects replaced, hand-made ones kept on top. */
export function applyCoverLayout(page: BookPage, layout: CoverLayout, style: CoverStyle, content: CoverContent): BookPage {
  const own = page.objects.filter((o) => o.role !== role);
  return { ...page, objects: [...coverObjects(layout, style, content), ...own] };
}

/** The biggest picture on the book's first drawn pages — the natural choice for the cover. */
export function coverPictureFrom(pages: BookPage[]): CoverContent["picture"] | undefined {
  for (const page of pages) {
    if (page.isBlankBack) continue;
    const stamps = page.objects.filter((o): o is StampData => o.kind === "stamp" && !o.isFrame && !o.hidden);
    if (stamps.length === 0) continue;
    const best = stamps.reduce((a, b) => (a.width * a.height * Math.abs(a.scaleX * a.scaleY) >= b.width * b.height * Math.abs(b.scaleX * b.scaleY) ? a : b));
    return { src: best.src, width: best.width * Math.abs(best.scaleX), height: best.height * Math.abs(best.scaleY) };
  }
  return undefined;
}
