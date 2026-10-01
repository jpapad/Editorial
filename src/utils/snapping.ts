// Smart guides: while one object is dragged, its edges and centre snap to
// the page centre, the safe margins and the other objects, and a guide
// line shows what it lined up with.

import type { Bounds } from "@/utils/objectGeometry";

export interface SnapTargets {
  xs: number[];
  ys: number[];
}

export interface SnapResult {
  dx: number;
  dy: number;
  /** Lines to draw: a vertical guide at x, or a horizontal one at y. */
  guides: { axis: "x" | "y"; at: number }[];
}

/** Left/centre/right and top/middle/bottom of every box given. */
export function snapTargets(boxes: Bounds[]): SnapTargets {
  return {
    xs: boxes.flatMap((b) => [b.left, (b.left + b.right) / 2, b.right]),
    ys: boxes.flatMap((b) => [b.top, (b.top + b.bottom) / 2, b.bottom]),
  };
}

function nearest(own: number[], targets: number[], tolerance: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const o of own) {
    for (const t of targets) {
      const delta = t - o;
      if (Math.abs(delta) <= tolerance && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t };
    }
  }
  return best;
}

/** How far to nudge `box` so the closest edge/centre within `tolerance` lines up (each axis on its own). */
export function snapBox(box: Bounds, targets: SnapTargets, tolerance: number): SnapResult {
  const x = nearest([box.left, (box.left + box.right) / 2, box.right], targets.xs, tolerance);
  const y = nearest([box.top, (box.top + box.bottom) / 2, box.bottom], targets.ys, tolerance);
  const guides: SnapResult["guides"] = [];
  if (x) guides.push({ axis: "x", at: x.at });
  if (y) guides.push({ axis: "y", at: y.at });
  return { dx: x?.delta ?? 0, dy: y?.delta ?? 0, guides };
}
