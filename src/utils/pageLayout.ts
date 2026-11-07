// Lays out a PageSpec (services/pageSpec.ts) on a real page — deterministic,
// no model involved: blocks stacked top to bottom in the order given, exact
// counts and columns, everything inside the print-safe area. Fixed-size
// blocks (text, lines, tables) take what they need; pictures and drawing
// spaces share what's left. If it can't all fit, pictures shrink and
// `squeezed` says so — nothing is dropped.

import type { BookPage, PageBackground, PageObject, PageSpace } from "@/types/editor";
import { coverStamp } from "@/utils/pageBackground";
import { createFrameStamp, makeId, rule, shape, text } from "@/components/editor/pageTemplates";
import { wordSearchPages } from "@/components/editor/puzzles";
import { mazePage } from "@/components/editor/worksheets";
import { geometryFromSpace } from "@/utils/pageGeometry";
import type { PageBlock, PageSpec, TextSize } from "@/services/pageSpec";

export interface PlacedPicture {
  src: string;
  width: number;
  height: number;
}

/** Pictures by `${blockIndex}:${itemIndex}`; a missing one is drawn as a labelled empty box. */
export type PictureMap = Map<string, PlacedPicture>;

export const pictureKey = (block: number, item: number) => `${block}:${item}`;

const KID = '"Fredoka", "Comic Sans MS", cursive';
const PLAIN = "Arial, Helvetica, sans-serif";
const GAP = 14;
const TITLE_SIZE: Record<TextSize, number> = { small: 26, medium: 34, large: 44 };
const TEXT_SIZE: Record<TextSize, number> = { small: 15, medium: 20, large: 28 };
const LINE_GAP = 34;
const HANDWRITING_GAP = 50;
const ROW_H = 34;

/** Rough height of wrapped text: average glyph ≈ 0.52 em wide, 1.3 line height. */
export function textHeight(value: string, fontSize: number, width: number): number {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.52)));
  const lines = value.split("\n").reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
  return Math.ceil(lines * fontSize * 1.3);
}

interface Box {
  left: number;
  top: number;
  width: number;
}

type Measured = { fixed: number; flex: number; minFlex: number };

/** How tall a block is, split into a fixed part and a share of the leftover space. */
function measure(block: PageBlock, width: number): Measured {
  switch (block.type) {
    case "title":
      return { fixed: textHeight(block.text, TITLE_SIZE[block.size], width) + 4, flex: 0, minFlex: 0 };
    case "text": {
      const size = block.style === "dashed" ? Math.round(TEXT_SIZE[block.size] * 1.6) : TEXT_SIZE[block.size];
      return { fixed: textHeight(block.text, size, width), flex: 0, minFlex: 0 };
    }
    case "pictures": {
      const rows = Math.ceil(block.items.length / block.columns);
      const under = (block.items.some((i) => i.caption) || block.marker !== "none" ? 28 : 0) + (block.writeLine ? 34 : 0);
      return { fixed: rows * under + (rows - 1) * GAP, flex: rows, minFlex: rows * 60 };
    }
    case "lines":
      return { fixed: block.count * (block.handwriting ? HANDWRITING_GAP : LINE_GAP), flex: 0, minFlex: 0 };
    case "table":
      return { fixed: (block.header.some(Boolean) ? 1 : 0) * ROW_H + block.rows * ROW_H, flex: 0, minFlex: 0 };
    case "choices":
      return { fixed: (block.question ? textHeight(block.question, 20, width) + 8 : 0) + Math.ceil(block.options.length / 3) * 36, flex: 0, minFlex: 0 };
    case "numbered":
      return { fixed: block.items.reduce((h, item, i) => h + textHeight(`${i + 1}. ${item}`, 19, width) + (block.writeLine ? 38 : 6), 0), flex: 0, minFlex: 0 };
    case "bubble":
      return { fixed: textHeight(block.text, 19, width * 0.7 - 32) + 54, flex: 0, minFlex: 0 };
    case "space":
      return { fixed: block.label ? textHeight(block.label, 18, width) + 6 : 0, flex: 1.5, minFlex: 80 };
    case "activity":
      return { fixed: 0, flex: 0, minFlex: 0 };
  }
}

function marker(kind: "circle" | "checkbox", x: number, y: number, size = 20): PageObject {
  return shape({ shapeKind: kind === "circle" ? "circle" : "rectangle", x, y, width: size, height: size, fill: "#ffffff", strokeWidth: 2.5 });
}

function draw(block: PageBlock, index: number, box: Box, fixed: number, flex: number, pictures: PictureMap): PageObject[] {
  const { left, top, width } = box;
  const out: PageObject[] = [];
  switch (block.type) {
    case "title":
      out.push(text({ text: block.text, x: left, y: top, width, height: fixed, fontSize: TITLE_SIZE[block.size], align: block.align, fontFamily: KID }));
      break;
    case "text": {
      const size = block.style === "dashed" ? Math.round(TEXT_SIZE[block.size] * 1.6) : TEXT_SIZE[block.size];
      out.push(text({ text: block.text, x: left, y: top, width, height: fixed, fontSize: size, align: block.align, fontFamily: block.style === "normal" ? PLAIN : KID, outline: block.style === "outline", dashed: block.style === "dashed" }));
      break;
    }
    case "pictures": {
      const cols = block.columns;
      const rows = Math.ceil(block.items.length / cols);
      const under = (block.items.some((i) => i.caption) || block.marker !== "none" ? 28 : 0) + (block.writeLine ? 34 : 0);
      const cellW = (width - GAP * (cols - 1)) / cols;
      const picH = Math.max(40, flex / rows);
      block.items.forEach((item, i) => {
        const x = left + (i % cols) * (cellW + GAP);
        const y = top + Math.floor(i / cols) * (picH + under + GAP);
        if (block.boxed) out.push(shape({ shapeKind: "rectangle", x, y, width: cellW, height: picH, fill: "#ffffff", strokeWidth: 2 }));
        const pad = block.boxed ? 8 : 0;
        const pic = pictures.get(pictureKey(index, i));
        if (pic) {
          const k = Math.min((cellW - pad * 2) / pic.width, (picH - pad * 2) / pic.height);
          out.push({ kind: "stamp", id: makeId("stamp"), src: pic.src, x: x + (cellW - pic.width * k) / 2, y: y + (picH - pic.height * k) / 2, width: pic.width * k, height: pic.height * k, rotation: 0, scaleX: 1, scaleY: 1, filter: "none", label: item.subject });
        } else {
          if (!block.boxed) out.push(shape({ shapeKind: "rectangle", x, y, width: cellW, height: picH, fill: "#ffffff", stroke: "#cbd5e1", strokeWidth: 1.5 }));
          out.push(text({ text: item.label || item.subject, x: x + 6, y: y + picH / 2 - 10, width: cellW - 12, height: 20, fontSize: 13, fontFamily: PLAIN, fill: PLACEHOLDER_INK }));
        }
        let ly = y + picH + 4;
        if (item.caption || block.marker !== "none") {
          const markerW = block.marker === "none" ? 0 : 28;
          if (block.marker !== "none") out.push(marker(block.marker, x + (item.caption ? 0 : cellW / 2 - 10), ly + 2));
          if (item.caption) out.push(text({ text: item.caption, x: x + markerW, y: ly, width: cellW - markerW, height: 24, fontSize: 18, align: markerW ? "left" : "center", fontFamily: KID }));
          ly += 28;
        }
        if (block.writeLine) out.push(rule(x + 6, ly + 26, cellW - 12));
      });
      break;
    }
    case "lines": {
      const gap = block.handwriting ? HANDWRITING_GAP : LINE_GAP;
      for (let n = 0; n < block.count; n++) {
        const base = top + (n + 1) * gap - 8;
        out.push(rule(left, base, width));
        if (block.handwriting) {
          out.push(shape({ shapeKind: "line", x: left, y: base - 18 - 12, width, height: 24, fill: "transparent", stroke: "#9ca3af", strokeWidth: 1 }));
          out.push(shape({ shapeKind: "line", x: left, y: base - 36 - 12, width, height: 24, fill: "transparent", stroke: "#cbd5e1", strokeWidth: 1 }));
        }
      }
      break;
    }
    case "table": {
      const hasHeader = block.header.some(Boolean);
      const colW = width / block.columns;
      const totalRows = block.rows + (hasHeader ? 1 : 0);
      for (let r = 0; r < totalRows; r++) {
        for (let c = 0; c < block.columns; c++) {
          out.push(shape({ shapeKind: "rectangle", x: left + c * colW, y: top + r * ROW_H, width: colW, height: ROW_H, fill: r === 0 && hasHeader ? "#f3f4f6" : "#ffffff", strokeWidth: 1.5 }));
          if (r === 0 && hasHeader && block.header[c]) out.push(text({ text: block.header[c], x: left + c * colW + 4, y: top + 8, width: colW - 8, height: 20, fontSize: 15, fontFamily: PLAIN }));
        }
      }
      break;
    }
    case "choices": {
      let y = top;
      if (block.question) {
        const h = textHeight(block.question, 20, width);
        out.push(text({ text: block.question, x: left, y, width, height: h, fontSize: 20, align: "left", fontFamily: PLAIN }));
        y += h + 8;
      }
      const perRow = Math.min(3, block.options.length);
      const colW = width / perRow;
      block.options.forEach((option, i) => {
        const x = left + (i % perRow) * colW;
        const oy = y + Math.floor(i / perRow) * 36;
        out.push(marker(block.marker, x + 4, oy + 2));
        out.push(text({ text: option, x: x + 32, y: oy, width: colW - 40, height: 28, fontSize: 18, align: "left", fontFamily: PLAIN }));
      });
      break;
    }
    case "numbered": {
      let y = top;
      block.items.forEach((item, i) => {
        const label = `${i + 1}. ${item}`;
        const h = textHeight(label, 19, width);
        out.push(text({ text: label, x: left, y, width, height: h, fontSize: 19, align: "left", fontFamily: PLAIN }));
        y += h + (block.writeLine ? 38 : 6);
        if (block.writeLine) out.push(rule(left + 18, y - 8, width - 18));
      });
      break;
    }
    case "bubble": {
      const w = width * 0.7;
      const x = left + (width - w) / 2;
      const h = fixed - 18;
      out.push(shape({ shapeKind: "rectangle", x, y: top, width: w, height: h, fill: "#ffffff", strokeWidth: 2.5 }));
      out.push(shape({ shapeKind: "triangle", x: x + 30, y: top + h - 2, width: 26, height: 18, fill: "#ffffff", strokeWidth: 2.5, rotation: 0, scaleY: -1 }));
      out.push(text({ text: block.text, x: x + 16, y: top + 18, width: w - 32, height: h - 30, fontSize: 19, fontFamily: KID }));
      break;
    }
    case "space": {
      let y = top;
      if (block.label) {
        const h = textHeight(block.label, 18, width);
        out.push(text({ text: block.label, x: left, y, width, height: h, fontSize: 18, align: "left", fontFamily: PLAIN }));
        y += h + 6;
      }
      if (block.boxed) out.push(shape({ shapeKind: "rectangle", x: left, y, width, height: Math.max(40, flex), fill: "#ffffff", strokeWidth: 2.5 }));
      break;
    }
    case "activity":
      break;
  }
  return out;
}

export interface LaidOutPage {
  page: BookPage;
  /** Continuation pages (when it didn't all fit on one), then any word search / maze asked for. */
  extraPages: BookPage[];
  /** True when the content ran on to more than one page. */
  continued: boolean;
}

type Placed = { block: PageBlock; index: number; offset: number };

/**
 * A block too tall for a page on its own is cut into pieces that fit —
 * lines by count, lists by item, pictures by row — keeping its order.
 * `offset` is the first picture's index in the original block, so each
 * piece still finds its own pictures.
 */
function splitToFit(block: PageBlock, index: number, room: number, width: number): Placed[] {
  const need = (b: PageBlock) => {
    const m = measure(b, width);
    return m.fixed + m.minFlex;
  };
  if (need(block) <= room) return [{ block, index, offset: 0 }];
  if (block.type === "lines") {
    const per = Math.max(1, Math.floor(room / (block.handwriting ? HANDWRITING_GAP : LINE_GAP)));
    const parts: Placed[] = [];
    for (let left = block.count; left > 0; left -= per) parts.push({ block: { ...block, count: Math.min(per, left) }, index, offset: 0 });
    return parts;
  }
  if (block.type === "numbered" || block.type === "pictures") {
    const unit = block.type === "pictures" ? block.columns : 1;
    const items = block.items as unknown[];
    const parts: Placed[] = [];
    let start = 0;
    while (start < items.length) {
      let end = Math.min(items.length, start + unit);
      while (end < items.length && need({ ...block, items: items.slice(start, end + unit) } as PageBlock) <= room) end = Math.min(items.length, end + unit);
      parts.push({ block: { ...block, items: items.slice(start, end) } as PageBlock, index, offset: start });
      start = end;
    }
    return parts;
  }
  return [{ block, index, offset: 0 }];
}

const PLACEHOLDER_INK = "#94a3b8";

/**
 * A block's own colors on what it drew: `color` on its texts and on its
 * lines and borders, `fill` inside its boxes. Tick boxes stay white (they're
 * to be marked), placeholder labels stay grey, pictures are left alone.
 */
function tint(objects: PageObject[], block: PageBlock): PageObject[] {
  const { color, fill } = block;
  if (!color && !fill) return objects;
  return objects.map((o) => {
    if (o.kind === "text") return color && o.fill !== PLACEHOLDER_INK && block.type !== "bubble" ? { ...o, fill: color } : o;
    if (o.kind !== "shape") return o;
    const isMarker = o.width <= 24 && o.height <= 24;
    const boxed = (o.shapeKind === "rectangle" || o.shapeKind === "triangle") && !isMarker;
    return {
      ...o,
      stroke: color && o.stroke !== "#cbd5e1" ? color : o.stroke,
      fill: fill && boxed && o.fill !== "transparent" ? fill : o.fill,
    };
  });
}

/** Lays one page's worth of blocks: fixed blocks take what they need, flexible ones share the rest. */
interface PageLook {
  background?: PageBackground;
  pattern: string | null;
  /** A scene to color, as a locked stamp at the back. */
  sceneStamp: PageObject | null;
  inColor: boolean;
  /** Something busy behind the content: texts get a white panel so they stay readable. */
  busy: boolean;
}

/** Text-like blocks that need a quiet panel to be read on top of a scene or pattern. */
const READ_PANEL: PageBlock["type"][] = ["title", "text", "numbered", "choices"];

function layoutOne(placed: Placed[], area: { left: number; right: number; top: number; bottom: number }, frame: PageObject | null, space: PageSpace, pictures: PictureMap, look: PageLook): BookPage {
  const width = area.right - area.left;
  const sizes = placed.map(({ block }) => measure(block, width));
  const fixedTotal = sizes.reduce((n, m) => n + m.fixed, 0) + GAP * Math.max(0, placed.length - 1);
  const flexWeight = sizes.reduce((n, m) => n + m.flex, 0);
  const leftover = Math.max(0, area.bottom - area.top - fixedTotal);
  // Pictures in a grid shouldn't grow taller than they are wide.
  const share = (m: Measured, block: PageBlock) => {
    if (m.flex === 0 || flexWeight === 0) return 0;
    const raw = Math.max(m.minFlex, (leftover * m.flex) / flexWeight);
    if (block.type !== "pictures") return raw;
    const cellW = (width - GAP * (block.columns - 1)) / block.columns;
    return Math.min(raw, Math.ceil(block.items.length / block.columns) * cellW * 1.15);
  };
  const objects: PageObject[] = [];
  if (look.sceneStamp) objects.push({ ...look.sceneStamp, id: makeId("stamp") });
  if (frame) objects.push({ ...frame, id: makeId("stamp") });
  let y = area.top;
  placed.forEach(({ block, index, offset }, i) => {
    const m = sizes[i];
    const flex = share(m, block);
    // A split picture block looks its pictures up by their place in the original block.
    const lookup: PictureMap = offset ? new Map([...pictures].flatMap(([key, pic]) => { const [b, item] = key.split(":").map(Number); return b === index && item >= offset ? [[pictureKey(index, item - offset), pic]] : []; })) : pictures;
    if (look.busy && READ_PANEL.includes(block.type) && m.fixed > 0) {
      // Kept inside the safe area like everything else on the page.
      const top = Math.max(area.top, y - 4);
      const bottom = Math.min(area.bottom, y + m.fixed + 4);
      objects.push(shape({ shapeKind: "rectangle", x: area.left, y: top, width, height: bottom - top, fill: "rgba(255,255,255,0.85)", stroke: "rgba(255,255,255,0)", strokeWidth: 0 }));
    }
    objects.push(...tint(draw(block, index, { left: area.left, top: y, width }, m.fixed, flex, lookup), block));
    y += m.fixed + flex + GAP;
  });
  return {
    id: makeId("page"),
    pageNumber: 0,
    space,
    lines: [],
    objects,
    ...(look.background ? { background: { ...look.background } } : {}),
    ...(look.pattern ? { backgroundPatternId: look.pattern } : {}),
    ...(look.inColor ? { inColor: true } : {}),
  };
}

/**
 * `scene` is the background picture made for `spec.scene`, if any: on a
 * coloring page it's a locked outline stamp (to color, and a wall for the
 * bucket); on mixed and color pages it's the page's own background
 * picture — faded on a mixed page so the content stays in front.
 */
export function layoutPageSpec(spec: PageSpec, space: PageSpace, pictures: PictureMap = new Map(), seed = Date.now(), scene?: PlacedPicture): LaidOutPage {
  const geo = geometryFromSpace(space);
  const frame = spec.frame ? createFrameStamp(spec.frame, geo) : null;
  const inset = frame ? 30 : 0;
  const area = { left: geo.safe.left + inset, right: geo.safe.right - inset, top: geo.safe.top + inset, bottom: geo.safe.bottom - inset };
  const width = area.right - area.left;
  const room = area.bottom - area.top;

  // Fill pages in order; whatever doesn't fit starts the next page — nothing shrinks or disappears.
  const groups: Placed[][] = [[]];
  let used = 0;
  spec.blocks.forEach((block, index) => {
    if (block.type === "activity") return;
    for (const piece of splitToFit(block, index, room, width)) {
      const m = measure(piece.block, width);
      const need = m.fixed + m.minFlex + (groups.at(-1)!.length ? GAP : 0);
      if (groups.at(-1)!.length && used + need > room) {
        groups.push([]);
        used = 0;
      }
      used += m.fixed + m.minFlex + (groups.at(-1)!.length ? GAP : 0);
      groups.at(-1)!.push(piece);
    }
  });
  const colored = spec.mode !== "lineart";
  const background: PageBackground = {
    ...(colored && spec.background ? { color: spec.background } : {}),
    ...(colored && spec.gradient ? { gradient: spec.gradient } : {}),
    ...(colored && scene ? { image: scene.src, imageOpacity: spec.mode === "mixed" ? 0.35 : 1 } : {}),
  };
  const look: PageLook = {
    background: Object.keys(background).length ? background : undefined,
    pattern: spec.pattern,
    sceneStamp: !colored && scene ? coverStamp(scene.src, scene, space, spec.scene?.label) : null,
    inColor: spec.mode === "color",
    busy: Boolean(scene || spec.pattern || spec.gradient),
  };
  const pages = groups.map((g) => layoutOne(g, area, frame, space, pictures, look));

  const activities: BookPage[] = [];
  for (const block of spec.blocks) {
    if (block.type !== "activity") continue;
    if (block.kind === "wordsearch") {
      const search = wordSearchPages(space, block.words, seed);
      if (search) activities.push(search.puzzle);
    } else {
      activities.push(mazePage(space, "medium", seed));
    }
  }
  return { page: pages[0], extraPages: [...pages.slice(1), ...activities], continued: pages.length > 1 };
}

/** The AI picture subjects a spec needs, in order, with their map key. */
export function picturesToMake(spec: PageSpec): { key: string; subject: string }[] {
  return spec.blocks.flatMap((block, index) => (block.type === "pictures" ? block.items.map((item, i) => ({ key: pictureKey(index, i), subject: item.subject })) : []));
}
