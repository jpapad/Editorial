import { PAGE_HEIGHT, PAGE_WIDTH } from "@/components/editor/CanvasEditor";
import type { BookPage, PageTemplate, ShapeData, StampData, TextData } from "@/types/editor";
import { frameDataUri, getFrame } from "@/components/editor/frameLibrary";

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBlankPage(id: string, pageNumber: number): BookPage {
  return { id, pageNumber, lines: [], objects: [] };
}

// Image viewport across the top 70% of the usable area, a labeled ruled
// text area across the bottom 30% — a classic picture-book page layout.
function createStorybookPage(id: string, pageNumber: number): BookPage {
  const margin = 40;
  const viewportWidth = PAGE_WIDTH - margin * 2;
  const viewportHeight = Math.round((PAGE_HEIGHT - margin * 2) * 0.7);
  const viewportY = margin;
  const textAreaTop = viewportY + viewportHeight + 20;

  const viewport: ShapeData = {
    kind: "shape",
    id: makeId("shape"),
    shapeKind: "rectangle",
    x: margin,
    y: viewportY,
    width: viewportWidth,
    height: viewportHeight,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: "#f8fafc",
    stroke: "#94a3b8",
    strokeWidth: 3,
  };

  const viewportLabel: TextData = {
    kind: "text",
    id: makeId("text"),
    text: "Drop your illustration here",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 18,
    align: "center",
    x: margin,
    y: viewportY + viewportHeight / 2 - 12,
    width: viewportWidth,
    height: 24,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: "#94a3b8",
    isDragging: false,
  };

  const ruledLines: ShapeData[] = Array.from({ length: 5 }, (_, i) => ({
    kind: "shape",
    id: makeId("shape"),
    shapeKind: "rectangle",
    x: margin,
    y: textAreaTop + 20 + i * 35,
    width: viewportWidth,
    height: 1.5,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: "#cbd5e1",
    stroke: "#cbd5e1",
    strokeWidth: 0,
  }));

  return { id, pageNumber, lines: [], objects: [viewport, viewportLabel, ...ruledLines] };
}

// 24 page units ≈ 0.31in once fit into a Letter page — clear of KDP's
// 0.25in minimum outside margin for no-bleed interiors. Frames sit inside
// that margin band on purpose, so the 0.5in safe-area check skips them.
const FRAME_MARGIN = 24;

/**
 * A page frame from frameLibrary.ts, generated for the page's own aspect
 * ratio (after margins) so it never gets visibly stretched the way a
 * square stamp would if scaled up to fill a portrait page.
 */
export function createFrameStamp(frameId: string): StampData | null {
  const frame = getFrame(frameId);
  if (!frame) return null;
  const width = PAGE_WIDTH - FRAME_MARGIN * 2;
  const height = PAGE_HEIGHT - FRAME_MARGIN * 2;
  return {
    kind: "stamp",
    id: makeId("stamp"),
    src: frameDataUri(frame, width, height),
    x: FRAME_MARGIN,
    y: FRAME_MARGIN,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    isFrame: true,
    frameId,
  };
}

function createBorderFramePage(id: string, pageNumber: number): BookPage {
  const frame = createFrameStamp("classic");
  return { id, pageNumber, lines: [], objects: frame ? [frame] : [] };
}

function text(overrides: Partial<TextData> & Pick<TextData, "text" | "x" | "y" | "width" | "fontSize">): TextData {
  return {
    kind: "text",
    id: makeId("text"),
    fontFamily: '"Comic Sans MS", "Comic Sans", cursive',
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

function rule(x: number, y: number, width: number): ShapeData {
  return { kind: "shape", id: makeId("shape"), shapeKind: "line", x, y: y - 12, width, height: 24, rotation: 0, scaleX: 1, scaleY: 1, fill: "transparent", stroke: "#111827", strokeWidth: 2.5 };
}

// "This book belongs to ____" — the classic first inside page, framed, with
// hollow letters so the title itself can be colored in.
function createBelongsToPage(id: string, pageNumber: number): BookPage {
  const frame = createFrameStamp("stars");
  const inner = 80;
  const width = PAGE_WIDTH - inner * 2;
  return {
    id,
    pageNumber,
    lines: [],
    objects: [
      ...(frame ? [frame] : []),
      text({ text: "This book\nbelongs to", x: inner, y: 230, width, fontSize: 54, outline: true }),
      rule(inner + 20, 470, width - 40),
      text({ text: "Age", x: inner, y: 540, width: width / 2 - 10, fontSize: 22, align: "left", fontFamily: "Arial, Helvetica, sans-serif" }),
      rule(inner + 60, 568, width / 2 - 70),
    ],
  };
}

// A test page for markers/crayons: a grid of empty swatches to try colors
// on before committing to a picture, plus a line to note what was used.
function createColorTestPage(id: string, pageNumber: number): BookPage {
  const margin = 56;
  const cols = 4;
  const rows = 6;
  const gap = 18;
  const top = 150;
  const cell = (PAGE_WIDTH - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = Math.min(cell, (PAGE_HEIGHT - top - margin - gap * (rows - 1)) / rows);
  const swatches: ShapeData[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      swatches.push({
        kind: "shape",
        id: makeId("shape"),
        shapeKind: (r + c) % 2 === 0 ? "circle" : "rectangle",
        x: margin + c * (cell + gap),
        y: top + r * (cellH + gap),
        width: cell,
        height: cellH,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fill: "#ffffff",
        stroke: "#111827",
        strokeWidth: 3,
      });
    }
  }
  return {
    id,
    pageNumber,
    lines: [],
    objects: [text({ text: "Color Test Page", x: margin, y: 60, width: PAGE_WIDTH - margin * 2, fontSize: 44, outline: true }), ...swatches],
  };
}

export const PAGE_TEMPLATE_OPTIONS: { id: PageTemplate; label: string; description: string }[] = [
  { id: "blank", label: "Full Drawing Page", description: "An empty page, ready to draw on" },
  { id: "storybook", label: "Storybook", description: "Image area on top, ruled text lines below" },
  { id: "border-frame", label: "Border Frame", description: "A decorative frame around the margins" },
  { id: "belongs-to", label: "This Book Belongs To", description: "Name page with colorable lettering" },
  { id: "color-test", label: "Color Test Page", description: "Swatches to try markers and crayons" },
];

export function createPageFromTemplate(pageNumber: number, template: PageTemplate = "blank"): BookPage {
  const id = makeId("page");
  switch (template) {
    case "storybook":
      return createStorybookPage(id, pageNumber);
    case "border-frame":
      return createBorderFramePage(id, pageNumber);
    case "belongs-to":
      return createBelongsToPage(id, pageNumber);
    case "color-test":
      return createColorTestPage(id, pageNumber);
    default:
      return createBlankPage(id, pageNumber);
  }
}

/** A deep copy of a page with fresh ids for the page, its lines and its objects (groups stay together under new group ids). */
export function duplicatePage(page: BookPage, pageNumber: number): BookPage {
  const groupIds = new Map<string, string>();
  const regroup = (groupId?: string) => {
    if (!groupId) return undefined;
    if (!groupIds.has(groupId)) groupIds.set(groupId, makeId("group"));
    return groupIds.get(groupId);
  };
  const copy = structuredClone(page);
  return {
    ...copy,
    id: makeId("page"),
    pageNumber,
    isCover: false,
    lines: copy.lines.map((l) => ({ ...l, id: makeId("line") })),
    objects: copy.objects.map((o) => ({ ...o, id: makeId(o.kind), groupId: regroup(o.groupId) })),
  };
}
