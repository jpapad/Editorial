// Layer arrangement tools — Sprint 6.
//
// Pure geometry functions, no React/DOM dependency: operate on any bounded
// item (x/y/width/height), return a new array with updated positions.
// There is no interactive multi-select canvas editor in this module yet
// (TwoPageSpreadEditor is a read-only layout renderer) — these are the
// building blocks a future selection-driven toolbar would call, the same
// relationship utils/preflightChecker.ts has to PreflightPanel.

export interface Bounded {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

function boundingBoxOf(items: Bounded[]): { x: number; y: number; width: number; height: number } {
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Aligns every item to one edge/axis. With no `referenceBounds`, aligns
 * relative to the selection's OWN bounding box (the standard multi-select
 * "align" behavior in design tools — e.g. "align center" makes every
 * selected item share the same horizontal center). Pass the page's trim
 * size as `referenceBounds` to instead center/align a single element (or
 * a group) on the page itself.
 */
export function alignElements<T extends Bounded>(items: T[], edge: AlignEdge, referenceBounds?: Bounded): T[] {
  if (items.length === 0) return items;
  const ref = referenceBounds ?? boundingBoxOf(items);

  return items.map((item) => {
    switch (edge) {
      case "left":
        return { ...item, x: ref.x };
      case "center":
        return { ...item, x: ref.x + ref.width / 2 - item.width / 2 };
      case "right":
        return { ...item, x: ref.x + ref.width - item.width };
      case "top":
        return { ...item, y: ref.y };
      case "middle":
        return { ...item, y: ref.y + ref.height / 2 - item.height / 2 };
      case "bottom":
        return { ...item, y: ref.y + ref.height - item.height };
    }
  });
}

/**
 * Spaces items evenly along an axis: the first and last items (by current
 * position) stay put, and everything between them is redistributed so the
 * GAPS between consecutive bounding boxes are equal — the standard
 * "distribute spacing" tool, not evenly-spaced centers (which would ignore
 * differing item sizes and visually crowd larger ones).
 */
export function distributeElements<T extends Bounded>(items: T[], axis: "horizontal" | "vertical"): T[] {
  if (items.length < 3) return items; // nothing to redistribute with 0-2 items

  // Indices sorted by position, so the loop below can write into `result`
  // at each item's ORIGINAL index — the returned array keeps the caller's
  // element order, only positions change.
  const order = items.map((_, i) => i).sort((a, b) => (axis === "horizontal" ? items[a].x - items[b].x : items[a].y - items[b].y));
  const first = items[order[0]];
  const last = items[order[order.length - 1]];

  const span = axis === "horizontal" ? last.x + last.width - first.x : last.y + last.height - first.y;
  const totalItemSize = items.reduce((sum, item) => sum + (axis === "horizontal" ? item.width : item.height), 0);
  const gap = (span - totalItemSize) / (items.length - 1);

  const result = [...items];
  let cursor = axis === "horizontal" ? first.x : first.y;
  for (const index of order) {
    const item = items[index];
    result[index] = axis === "horizontal" ? { ...item, x: cursor } : { ...item, y: cursor };
    cursor += (axis === "horizontal" ? item.width : item.height) + gap;
  }
  return result;
}

export interface Flippable extends Bounded {
  flipX?: boolean;
  flipY?: boolean;
}

/**
 * Toggles each item's own content mirror (flipX/flipY) in place — the box
 * stays where it is; only its contents mirror, matching
 * TwoPageSpreadEditor's `scale(-1, 1)`/`scale(1, -1)` rendering. This is
 * NOT the same as mirroring an item's position within a page (e.g. moving
 * left-page content to the right page) — that's a position transform,
 * this is a content transform. Toggling twice returns to the original.
 */
export function flipElements<T extends Flippable>(items: T[], axis: "horizontal" | "vertical"): T[] {
  return items.map((item) => (axis === "horizontal" ? { ...item, flipX: !item.flipX } : { ...item, flipY: !item.flipY }));
}
