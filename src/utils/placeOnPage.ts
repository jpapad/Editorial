// "Add to this page": an activity made as a page of its own (a worksheet,
// a page from instructions) is moved into the free space of the page the
// user is on — under (or over) what's already there, scaled down evenly if
// it has to be, never stretched, everything on the page left as it was.

import { makeId, shape } from "@/components/editor/pageTemplates";
import { objectBounds } from "@/utils/objectGeometry";
import { geometryFromSpace, type Rect } from "@/utils/pageGeometry";
import { hasEdgeBackground } from "@/utils/pageBackground";
import type { BookPage, LineData, PageObject, PageSpace } from "@/types/editor";

const GAP = 18;
/** Below this share of the page's usable height the free space is too small to be worth using. */
export const MIN_FREE_SHARE = 0.22;

/** Things that frame the page rather than being its content: backgrounds, frames, page numbers. */
const isFurniture = (o: PageObject) => o.role === "pageBackground" || o.role === "pageNumber" || (o.kind === "stamp" && Boolean(o.isFrame));

function lineBounds(l: LineData): Rect {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < l.points.length; i += 2) {
    left = Math.min(left, l.points[i]);
    right = Math.max(right, l.points[i]);
    top = Math.min(top, l.points[i + 1]);
    bottom = Math.max(bottom, l.points[i + 1]);
  }
  const pad = l.strokeWidth / 2;
  return { left: left - pad, top: top - pad, right: right + pad, bottom: bottom + pad };
}

/** Where a page's own content is (furniture and hidden things left out); null for a page with none. */
export function contentBounds(page: BookPage): Rect | null {
  const boxes = [...page.objects.filter((o) => !o.hidden && !isFurniture(o)).map(objectBounds), ...page.lines.filter((l) => l.tool === "pen" && l.points.length >= 2).map(lineBounds)];
  if (boxes.length === 0) return null;
  return boxes.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }));
}

/** The larger empty band inside the safe area — under the content or over it — and its share of the usable height. */
export function freeArea(page: BookPage, space: PageSpace): { box: Rect; share: number } {
  const { safe } = geometryFromSpace(space);
  const usable = safe.bottom - safe.top;
  const content = contentBounds(page);
  if (!content) return { box: safe, share: 1 };
  const below: Rect = { ...safe, top: Math.min(safe.bottom, Math.max(safe.top, content.bottom + GAP)) };
  const above: Rect = { ...safe, bottom: Math.max(safe.top, Math.min(safe.bottom, content.top - GAP)) };
  const box = below.bottom - below.top >= above.bottom - above.top ? below : above;
  return { box, share: (box.bottom - box.top) / usable };
}

/** Every object and stroke of `source`, scaled by k around `from` and moved to `to` — fresh ids, nothing stretched. */
function moved(source: BookPage, from: Rect, to: { x: number; y: number }, k: number): { objects: PageObject[]; lines: LineData[] } {
  const X = (x: number) => to.x + (x - from.left) * k;
  const Y = (y: number) => to.y + (y - from.top) * k;
  const groups = new Map<string, string>();
  const objects = source.objects
    .filter((o) => !o.hidden && !isFurniture(o))
    .map((o) => {
      const groupId = o.groupId ? (groups.get(o.groupId) ?? groups.set(o.groupId, makeId("group")).get(o.groupId)) : undefined;
      const base = { ...o, id: makeId(o.kind), x: X(o.x), y: Y(o.y), width: o.width * k, height: o.height * k, groupId, repeatId: undefined, locked: false };
      if (o.kind === "text") return { ...base, fontSize: o.fontSize * k } as PageObject;
      if (o.kind === "shape") return { ...base, strokeWidth: Math.max(1, o.strokeWidth * k) } as PageObject;
      return base as PageObject;
    });
  const lines = source.lines.map((l) => ({ ...l, id: makeId("line"), strokeWidth: Math.max(1, l.strokeWidth * k), points: l.points.map((v, i) => (i % 2 === 0 ? X(v) : Y(v))) }));
  return { objects, lines };
}

export type PlaceResult = { ok: true; page: BookPage; scale: number } | { ok: false; reason: "no-room" | "empty" };

/**
 * `page` with `source`'s content added in its free space. On a page with a
 * background the activity gets a light panel behind it, like text on a
 * busy page. `no-room`: the free space is too small; `empty`: nothing to add.
 */
export function addOntoPage(page: BookPage, source: BookPage, space: PageSpace): PlaceResult {
  const from = contentBounds(source);
  if (!from) return { ok: false, reason: "empty" };
  const { box, share } = freeArea(page, space);
  if (share < MIN_FREE_SHARE) return { ok: false, reason: "no-room" };
  const w = from.right - from.left;
  const h = from.bottom - from.top;
  const k = Math.min(1, (box.right - box.left) / w, (box.bottom - box.top) / h);
  const to = { x: box.left + ((box.right - box.left) - w * k) / 2, y: box.top };
  const added = moved(source, from, to, k);
  const panel = hasEdgeBackground(page) ? [shape({ shapeKind: "rectangle", x: to.x - 8, y: to.y - 8, width: w * k + 16, height: h * k + 16, fill: "rgba(255,255,255,0.88)", stroke: "rgba(255,255,255,0)", strokeWidth: 0 })] : [];
  // The panel can't poke past the safe area.
  const { safe } = geometryFromSpace(space);
  for (const p of panel) {
    p.x = Math.max(safe.left, p.x);
    p.y = Math.max(safe.top, p.y);
    p.width = Math.min(safe.right, to.x + w * k + 8) - p.x;
    p.height = Math.min(safe.bottom, to.y + h * k + 8) - p.y;
  }
  return { ok: true, scale: k, page: { ...page, objects: [...page.objects, ...panel, ...added.objects], lines: [...page.lines, ...added.lines] } };
}
