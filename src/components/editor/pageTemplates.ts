import type { BookPage, PageSpace, PageTemplate, ShapeData, StampData, TextData } from "@/types/editor";
import { frameDataUri, getFrame } from "@/components/editor/frameLibrary";
import { geometryFromSpace, type PageGeometry } from "@/utils/pageGeometry";
import { identityT, type TFunction } from "@/lib/i18n-core";

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Every template lays itself out from the page's real geometry (trim +
// safe area), so it fits any trim size and stays clear of the cut when
// the book has bleed.

function page(id: string, pageNumber: number, space: PageSpace, objects: BookPage["objects"] = []): BookPage {
  return { id, pageNumber, space, lines: [], objects };
}

export function text(overrides: Partial<TextData> & Pick<TextData, "text" | "x" | "y" | "width" | "fontSize">): TextData {
  return {
    kind: "text",
    id: makeId("text"),
    fontFamily: '"Fredoka", "Comic Sans MS", cursive',
    align: "center",
    height: overrides.fontSize * 1.4,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: "#111827",
    isDragging: false,
    ...overrides,
  };
}

export function shape(overrides: Partial<ShapeData> & Pick<ShapeData, "shapeKind" | "x" | "y" | "width" | "height">): ShapeData {
  return { kind: "shape", id: makeId("shape"), rotation: 0, scaleX: 1, scaleY: 1, fill: "#ffffff", stroke: "#111827", strokeWidth: 3, ...overrides };
}

export function rule(x: number, y: number, width: number, strokeWidth = 2.5): ShapeData {
  return shape({ shapeKind: "line", x, y: y - 12, width, height: 24, fill: "transparent", strokeWidth });
}

// Image viewport across the top 70% of the safe area, a labeled ruled text
// area across the bottom — a classic picture-book page layout.
function createStorybookPage(id: string, pageNumber: number, space: PageSpace, geo: PageGeometry, tx: TFunction): BookPage {
  const { safe } = geo;
  const width = safe.right - safe.left;
  const viewportHeight = Math.round((safe.bottom - safe.top) * 0.68);
  const textTop = safe.top + viewportHeight + 24;
  const lineGap = Math.min(35, (safe.bottom - textTop - 10) / 5);
  return page(id, pageNumber, space, [
    shape({ shapeKind: "rectangle", x: safe.left, y: safe.top, width, height: viewportHeight, fill: "#f8fafc", stroke: "#94a3b8" }),
    text({ text: tx("Drop your illustration here"), x: safe.left, y: safe.top + viewportHeight / 2 - 12, width, height: 24, fontSize: 18, fontFamily: "Arial, Helvetica, sans-serif", fill: "#94a3b8" }),
    ...Array.from({ length: 5 }, (_, i) => shape({ shapeKind: "rectangle", x: safe.left, y: textTop + 20 + i * lineGap, width, height: 1.5, fill: "#cbd5e1", stroke: "#cbd5e1", strokeWidth: 0 })),
  ]);
}

// 24pt ≈ 0.33in inside the trim — clear of KDP's 0.25in minimum outside
// margin. Frames sit in that band on purpose, so the 0.5in safe-area check
// skips them (see editorPreflight's isFrame).
const FRAME_INSET = 24;

/**
 * A page frame from frameLibrary.ts, generated for the page's own aspect
 * ratio so it never gets visibly stretched the way a square stamp would if
 * scaled up to fill a portrait page.
 */
export function createFrameStamp(frameId: string, geo: PageGeometry): StampData | null {
  const frame = getFrame(frameId);
  if (!frame) return null;
  const x = geo.trim.left + FRAME_INSET;
  const y = geo.trim.top + FRAME_INSET;
  const width = geo.trim.right - geo.trim.left - FRAME_INSET * 2;
  const height = geo.trim.bottom - geo.trim.top - FRAME_INSET * 2;
  return { kind: "stamp", id: makeId("stamp"), src: frameDataUri(frame, width, height), x, y, width, height, rotation: 0, scaleX: 1, scaleY: 1, isFrame: true, frameId };
}

// "This book belongs to ____" — the classic first inside page, framed, with
// hollow letters so the title itself can be colored in.
function createBelongsToPage(id: string, pageNumber: number, space: PageSpace, geo: PageGeometry, tx: TFunction): BookPage {
  const frame = createFrameStamp("stars", geo);
  const left = geo.safe.left + 30;
  const width = geo.safe.right - geo.safe.left - 60;
  const top = geo.trim.top + (geo.trim.bottom - geo.trim.top) * 0.27;
  return page(id, pageNumber, space, [
    ...(frame ? [frame] : []),
    text({ text: tx("This book\nbelongs to"), x: left, y: top, width, fontSize: 54, outline: true }),
    rule(left + 20, top + 240, width - 40),
    text({ text: tx("Age"), x: left, y: top + 310, width: width / 2 - 10, fontSize: 22, align: "left", fontFamily: "Arial, Helvetica, sans-serif" }),
    rule(left + 60, top + 338, width / 2 - 70),
  ]);
}

// A test page for markers/crayons: a grid of empty swatches to try colors
// on before committing to a picture.
function createColorTestPage(id: string, pageNumber: number, space: PageSpace, geo: PageGeometry, tx: TFunction): BookPage {
  const { safe } = geo;
  const cols = 4;
  const rows = 6;
  const gap = 18;
  const titleHeight = 90;
  const width = safe.right - safe.left;
  const cell = (width - gap * (cols - 1)) / cols;
  const cellH = Math.min(cell, (safe.bottom - safe.top - titleHeight - gap * (rows - 1)) / rows);
  const swatches: ShapeData[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      swatches.push(shape({ shapeKind: (r + c) % 2 === 0 ? "circle" : "rectangle", x: safe.left + c * (cell + gap), y: safe.top + titleHeight + r * (cellH + gap), width: cell, height: cellH }));
    }
  }
  return page(id, pageNumber, space, [text({ text: tx("Color Test Page"), x: safe.left, y: safe.top + 10, width, fontSize: 44, outline: true }), ...swatches]);
}

// The front-matter page KDP books carry: copyright line, rights reserved,
// ISBN and publisher — bracketed placeholders to fill in.
function createCopyrightPage(id: string, pageNumber: number, space: PageSpace, geo: PageGeometry, tx: TFunction): BookPage {
  const { safe } = geo;
  const width = safe.right - safe.left;
  const year = new Date().getFullYear();
  const body = [
    tx("Copyright © {year} [Author name]", { year }),
    tx("All rights reserved."),
    "",
    tx("No part of this book may be reproduced, stored or shared in any form or by any means without written permission from the publisher, except for coloring pages copied for personal, non-commercial use."),
    "",
    "ISBN: [ISBN]",
    tx("Published by [Publisher]"),
    tx("First edition"),
  ].join("\n");
  return page(id, pageNumber, space, [
    text({ text: body, x: safe.left, y: safe.bottom - 230, width, height: 220, fontSize: 11, align: "left", fontFamily: "Georgia, 'Times New Roman', serif" }),
  ]);
}

export const PAGE_TEMPLATE_OPTIONS: { id: PageTemplate; label: string; description: string }[] = [
  { id: "blank", label: "Full Drawing Page", description: "An empty page, ready to draw on" },
  { id: "storybook", label: "Storybook", description: "Image area on top, ruled text lines below" },
  { id: "border-frame", label: "Border Frame", description: "A decorative frame around the margins" },
  { id: "belongs-to", label: "This Book Belongs To", description: "Name page with colorable lettering" },
  { id: "color-test", label: "Color Test Page", description: "Swatches to try markers and crayons" },
  { id: "copyright", label: "Copyright & ISBN", description: "Front-matter page with rights and ISBN" },
  { id: "certificate", label: "Certificate", description: "“Colored every page!” — for the last page" },
  { id: "stickers", label: "Reward Stickers", description: "Twelve stickers to color and cut out" },
];

/** `tx` translates the words printed on the page (default: English). */
// A certificate for the last page: "… finished this book!", a line for the
// name and one for the date, in a frame.
function createCertificatePage(id: string, pageNumber: number, space: PageSpace, geo: PageGeometry, tx: TFunction): BookPage {
  const frame = createFrameStamp("stars", geo);
  const left = geo.safe.left + 30;
  const width = geo.safe.right - geo.safe.left - 60;
  const top = geo.safe.top + (geo.safe.bottom - geo.safe.top) * 0.14;
  const plain = "Arial, Helvetica, sans-serif";
  return page(id, pageNumber, space, [
    ...(frame ? [frame] : []),
    text({ text: tx("Certificate"), x: left, y: top, width, fontSize: 58, outline: true }),
    shape({ shapeKind: "star", x: left + width / 2 - 55, y: top + 100, width: 110, height: 110, fill: "#ffffff", stroke: "#111827", strokeWidth: 5 }),
    text({ text: tx("This certifies that"), x: left, y: top + 240, width, fontSize: 22, fontFamily: plain }),
    rule(left + 40, top + 345, width - 80),
    text({ text: tx("colored every page of this book!"), x: left, y: top + 372, width, fontSize: 22, fontFamily: plain }),
    text({ text: tx("Date"), x: left, y: top + 470, width: 60, fontSize: 16, align: "left", fontFamily: plain }),
    rule(left + 60, top + 490, width / 2 - 70),
  ]);
}

// Reward stickers to cut out (or print on sticker paper): a grid of dashed
// circles, each with a shape inside to color.
function createStickerPage(id: string, pageNumber: number, space: PageSpace, geo: PageGeometry, tx: TFunction): BookPage {
  const { safe } = geo;
  const width = safe.right - safe.left;
  const titleH = 84;
  const cols = 3;
  const rows = 4;
  const cell = Math.min(width / cols, (safe.bottom - safe.top - titleH) / rows);
  const d = cell * 0.86;
  const kinds = ["star", "heart", "circle", "hexagon", "triangle"] as const;
  const objects: BookPage["objects"] = [text({ text: tx("My stickers"), x: safe.left, y: safe.top + 6, width, fontSize: 44, outline: true })];
  const lines: BookPage["lines"] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = safe.left + (width - cols * cell) / 2 + c * cell + cell / 2;
      const cy = safe.top + titleH + r * cell + cell / 2;
      // The cut line: a dashed circle, as a closed pen stroke so it can be restyled.
      const ring: number[] = [];
      for (let a = 0; a <= 48; a++) ring.push(cx + (d / 2) * Math.cos((a / 48) * Math.PI * 2), cy + (d / 2) * Math.sin((a / 48) * Math.PI * 2));
      lines.push({ id: makeId("line"), tool: "pen", strokeWidth: 3, style: "dashed", points: ring });
      const s = d * 0.5;
      objects.push(shape({ shapeKind: kinds[(r * cols + c) % kinds.length], x: cx - s / 2, y: cy - s / 2, width: s, height: s, fill: "#ffffff", stroke: "#111827", strokeWidth: 4 }));
    }
  }
  return { ...page(id, pageNumber, space, objects), lines };
}

export function createPageFromTemplate(pageNumber: number, space: PageSpace, template: PageTemplate = "blank", tx: TFunction = identityT): BookPage {
  const id = makeId("page");
  const geo = geometryFromSpace(space);
  switch (template) {
    case "storybook":
      return createStorybookPage(id, pageNumber, space, geo, tx);
    case "border-frame": {
      const frame = createFrameStamp("classic", geo);
      return page(id, pageNumber, space, frame ? [frame] : []);
    }
    case "belongs-to":
      return createBelongsToPage(id, pageNumber, space, geo, tx);
    case "color-test":
      return createColorTestPage(id, pageNumber, space, geo, tx);
    case "copyright":
      return createCopyrightPage(id, pageNumber, space, geo, tx);
    case "certificate":
      return createCertificatePage(id, pageNumber, space, geo, tx);
    case "stickers":
      return createStickerPage(id, pageNumber, space, geo, tx);
    default:
      return page(id, pageNumber, space);
  }
}

/** A deep copy of a page with fresh ids for the page, its lines and its objects (groups stay together under new group ids). */
export function duplicatePage(source: BookPage, pageNumber: number): BookPage {
  const groupIds = new Map<string, string>();
  const regroup = (groupId?: string) => {
    if (!groupId) return undefined;
    if (!groupIds.has(groupId)) groupIds.set(groupId, makeId("group"));
    return groupIds.get(groupId);
  };
  const copy = structuredClone(source);
  return {
    ...copy,
    id: makeId("page"),
    pageNumber,
    isCover: false,
    lines: copy.lines.map((l) => ({ ...l, id: makeId("line") })),
    objects: copy.objects.map((o) => ({ ...o, id: makeId(o.kind), groupId: regroup(o.groupId) })),
  };
}
