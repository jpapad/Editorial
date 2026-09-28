// Pure geometry for placed objects (stamps/shapes/text), in page units.
// An object's (x, y) is its local origin; width/height are scaled by
// scaleX/scaleY (negative = flipped) and the whole box is rotated by
// `rotation` degrees around (x, y) — Konva's own transform order.

import type { PageObject } from "@/types/editor";

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

type Geometry = Pick<PageObject, "x" | "y" | "width" | "height" | "rotation" | "scaleX" | "scaleY">;

function corners(obj: Geometry): [number, number][] {
  const rad = (obj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const w = obj.width * obj.scaleX;
  const h = obj.height * obj.scaleY;
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ].map(([lx, ly]) => [obj.x + lx * cos - ly * sin, obj.y + lx * sin + ly * cos]);
}

/** Axis-aligned bounding box of the transformed (rotated/scaled/flipped) object. */
export function objectBounds(obj: Geometry): Bounds {
  const pts = corners(obj);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  return {
    left: Math.min(...list.map((b) => b.left)),
    top: Math.min(...list.map((b) => b.top)),
    right: Math.max(...list.map((b) => b.right)),
    bottom: Math.max(...list.map((b) => b.bottom)),
  };
}

/** Mirror across the object's own vertical axis, keeping it visually in place (the origin moves to where the old right edge was). */
export function flippedHorizontally<T extends Geometry>(obj: T): Pick<T, "x" | "y" | "scaleX"> {
  const rad = (obj.rotation * Math.PI) / 180;
  const w = obj.width * obj.scaleX;
  return { x: obj.x + Math.cos(rad) * w, y: obj.y + Math.sin(rad) * w, scaleX: -obj.scaleX } as Pick<T, "x" | "y" | "scaleX">;
}

/** Mirror across the object's own horizontal axis, keeping it visually in place. */
export function flippedVertically<T extends Geometry>(obj: T): Pick<T, "x" | "y" | "scaleY"> {
  const rad = (obj.rotation * Math.PI) / 180;
  const h = obj.height * obj.scaleY;
  return { x: obj.x - Math.sin(rad) * h, y: obj.y + Math.cos(rad) * h, scaleY: -obj.scaleY } as Pick<T, "x" | "y" | "scaleY">;
}

export type AlignEdge = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

/**
 * Per-object (dx, dy) that aligns each object's bounds to `target`'s
 * matching edge/center. Moving by a delta (not setting x/y) is what keeps
 * rotated and flipped objects correct: their origin isn't their top-left.
 */
export function alignDeltas(objects: Geometry[], edge: AlignEdge, target: Bounds): { dx: number; dy: number }[] {
  return objects.map((obj) => {
    const b = objectBounds(obj);
    switch (edge) {
      case "left":
        return { dx: target.left - b.left, dy: 0 };
      case "right":
        return { dx: target.right - b.right, dy: 0 };
      case "center-x":
        return { dx: (target.left + target.right) / 2 - (b.left + b.right) / 2, dy: 0 };
      case "top":
        return { dx: 0, dy: target.top - b.top };
      case "bottom":
        return { dx: 0, dy: target.bottom - b.bottom };
      case "center-y":
        return { dx: 0, dy: (target.top + target.bottom) / 2 - (b.top + b.bottom) / 2 };
    }
  });
}

/** Equal gaps between neighbours along one axis; the two outermost objects stay put. Returns deltas in the input order. */
export function distributeDeltas(objects: Geometry[], axis: "x" | "y"): { dx: number; dy: number }[] {
  const deltas = objects.map(() => ({ dx: 0, dy: 0 }));
  if (objects.length < 3) return deltas;

  const items = objects.map((obj, index) => ({ index, b: objectBounds(obj) }));
  const start = (b: Bounds) => (axis === "x" ? b.left : b.top);
  const size = (b: Bounds) => (axis === "x" ? b.right - b.left : b.bottom - b.top);
  items.sort((a, b) => start(a.b) - start(b.b));

  const first = items[0].b;
  const last = items[items.length - 1].b;
  const span = start(last) + size(last) - start(first);
  const totalSize = items.reduce((sum, it) => sum + size(it.b), 0);
  const gap = (span - totalSize) / (items.length - 1);

  let cursor = start(first);
  for (const it of items) {
    const d = cursor - start(it.b);
    deltas[it.index] = axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d };
    cursor += size(it.b) + gap;
  }
  return deltas;
}

/** Shift (and if needed, uniformly shrink) an object so its transformed bounds fit inside `area`. */
export function fitInside<T extends Geometry>(obj: T, area: Bounds): T {
  let next = { ...obj };
  let b = objectBounds(next);
  const availW = area.right - area.left;
  const availH = area.bottom - area.top;
  const k = Math.min(1, availW / (b.right - b.left), availH / (b.bottom - b.top));
  if (k < 1) {
    next = { ...next, scaleX: next.scaleX * k, scaleY: next.scaleY * k };
    b = objectBounds(next);
  }
  const dx = b.left < area.left ? area.left - b.left : b.right > area.right ? area.right - b.right : 0;
  const dy = b.top < area.top ? area.top - b.top : b.bottom > area.bottom ? area.bottom - b.bottom : 0;
  return { ...next, x: next.x + dx, y: next.y + dy };
}
