// Pure stroke processing for the pen/eraser: mirror/radial symmetry and
// stroke smoothing. Points are Konva's flattened [x1, y1, x2, y2, …].

import type { LineData, LineStyle, SymmetryMode } from "@/types/editor";

/** Konva dash pattern for a pen line's style, scaled to its width (undefined = solid). Round caps turn the near-zero "dotted" dashes into dots. */
export function lineDash(style: LineStyle | undefined, strokeWidth: number): number[] | undefined {
  if (style === "dashed") return [strokeWidth * 2.5, strokeWidth * 2.2];
  if (style === "dotted") return [0.01, strokeWidth * 2.2];
  return undefined;
}

export const LINE_STYLE_OPTIONS: { value: "solid" | LineStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

export const SYMMETRY_OPTIONS: { value: SymmetryMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "mirror-x", label: "Left ↔ Right" },
  { value: "mirror-y", label: "Top ↕ Bottom" },
  { value: "quad", label: "4 quarters" },
  { value: "radial-6", label: "Mandala 6" },
  { value: "radial-8", label: "Mandala 8" },
];

type PointMap = (x: number, y: number) => [number, number];

/** The extra copies a stroke gets under `mode`, around the page center (cx, cy). The original stroke is not included. */
function symmetryMaps(mode: SymmetryMode, cx: number, cy: number): PointMap[] {
  const mirrorX: PointMap = (x, y) => [2 * cx - x, y];
  const mirrorY: PointMap = (x, y) => [x, 2 * cy - y];
  const rotate =
    (deg: number): PointMap =>
    (x, y) => {
      const rad = (deg * Math.PI) / 180;
      const dx = x - cx;
      const dy = y - cy;
      return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
    };

  switch (mode) {
    case "off":
      return [];
    case "mirror-x":
      return [mirrorX];
    case "mirror-y":
      return [mirrorY];
    case "quad":
      return [mirrorX, mirrorY, (x, y) => mirrorY(...mirrorX(x, y))];
    case "radial-6":
      return [1, 2, 3, 4, 5].map((i) => rotate(i * 60));
    case "radial-8":
      return [1, 2, 3, 4, 5, 6, 7].map((i) => rotate(i * 45));
  }
}

export function symmetricCopies(points: number[], mode: SymmetryMode, cx: number, cy: number): number[][] {
  return symmetryMaps(mode, cx, cy).map((map) => {
    const out = new Array<number>(points.length);
    for (let i = 0; i < points.length; i += 2) {
      const [x, y] = map(points[i], points[i + 1]);
      out[i] = x;
      out[i + 1] = y;
    }
    return out;
  });
}

/** Guide lines to draw on the canvas for a symmetry mode: [x1, y1, x2, y2] segments through the page center. */
export function symmetryAxes(mode: SymmetryMode, width: number, height: number): number[][] {
  const cx = width / 2;
  const cy = height / 2;
  const vertical = [cx, 0, cx, height];
  const horizontal = [0, cy, width, cy];
  if (mode === "mirror-x") return [vertical];
  if (mode === "mirror-y") return [horizontal];
  if (mode === "quad") return [vertical, horizontal];
  if (mode === "radial-6" || mode === "radial-8") {
    const n = mode === "radial-6" ? 6 : 8;
    const r = Math.hypot(width, height);
    return Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  }
  return [];
}

/**
 * Live stabilizer ("lazy brush"): the drawn point trails the pointer by a
 * fraction of the distance, which irons out mouse jitter as you draw.
 * amount 0 = raw input, 1 = heaviest smoothing.
 */
export function stabilize(prevX: number, prevY: number, x: number, y: number, amount: number): [number, number] {
  const follow = 1 - 0.85 * Math.min(Math.max(amount, 0), 1);
  return [prevX + (x - prevX) * follow, prevY + (y - prevY) * follow];
}

/** Final pass on a finished stroke: a small moving average that rounds off corners the stabilizer let through. Keeps both endpoints exact. */
export function smoothStroke(points: number[], amount: number): number[] {
  const radius = Math.round(Math.min(Math.max(amount, 0), 1) * 4);
  const n = points.length / 2;
  if (radius === 0 || n < 3) return points;
  const out = points.slice();
  for (let i = 1; i < n - 1; i++) {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(n - 1, i + radius); j++) {
      sx += points[j * 2];
      sy += points[j * 2 + 1];
      count++;
    }
    out[i * 2] = sx / count;
    out[i * 2 + 1] = sy / count;
  }
  return out;
}

// ---------- Curve tool ----------

const CURVE_STEPS = 14;

/**
 * A smooth curve through the clicked anchor points (Catmull-Rom), returned
 * as a dense polyline so everything that reads a stroke's points — export,
 * the gap check, worksheets — sees the curve itself, not its anchors.
 * `closed` runs it back to the first anchor without a corner.
 */
export function curveThrough(anchors: number[], closed = false): number[] {
  const n = anchors.length / 2;
  if (n < 2) return [...anchors];
  if (n === 2 && !closed) return [...anchors];
  const at = (i: number): [number, number] => {
    const k = closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
    return [anchors[k * 2], anchors[k * 2 + 1]];
  };
  const out: number[] = [];
  const segments = closed ? n : n - 1;
  for (let s = 0; s < segments; s++) {
    const [p0, p1, p2, p3] = [at(s - 1), at(s), at(s + 1), at(s + 2)];
    for (let j = 0; j < CURVE_STEPS; j++) {
      const t = j / CURVE_STEPS;
      const t2 = t * t;
      const t3 = t2 * t;
      for (const d of [0, 1] as const) {
        out.push(0.5 * (2 * p1[d] + (p2[d] - p0[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * t3));
      }
    }
  }
  const end = at(closed ? 0 : n - 1);
  out.push(end[0], end[1]);
  return out;
}

// ---------- Selecting drawn strokes ----------

export interface StrokeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function strokeBounds(line: Pick<LineData, "points" | "strokeWidth">): StrokeBox {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let i = 0; i + 1 < line.points.length; i += 2) {
    left = Math.min(left, line.points[i]);
    right = Math.max(right, line.points[i]);
    top = Math.min(top, line.points[i + 1]);
    bottom = Math.max(bottom, line.points[i + 1]);
  }
  const pad = line.strokeWidth / 2;
  return { left: left - pad, top: top - pad, right: right + pad, bottom: bottom + pad };
}

/** Pen strokes with at least one point inside the rectangle (eraser strokes can't be picked). */
export function strokesInRect(lines: LineData[], rect: StrokeBox): string[] {
  return lines
    .filter((l) => l.tool === "pen")
    .filter((l) => {
      for (let i = 0; i + 1 < l.points.length; i += 2) {
        if (l.points[i] >= rect.left && l.points[i] <= rect.right && l.points[i + 1] >= rect.top && l.points[i + 1] <= rect.bottom) return true;
      }
      return false;
    })
    .map((l) => l.id);
}

/** The topmost pen stroke passing within `reach` of a point — a tap on a line. */
export function strokeAt(lines: LineData[], x: number, y: number, reach: number): string | null {
  for (let n = lines.length - 1; n >= 0; n--) {
    const l = lines[n];
    if (l.tool !== "pen") continue;
    const limit = reach + l.strokeWidth / 2;
    for (let i = 0; i + 3 < l.points.length; i += 2) {
      const [ax, ay, bx, by] = [l.points[i], l.points[i + 1], l.points[i + 2], l.points[i + 3]];
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2)) : 0;
      if (Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) <= limit) return l.id;
    }
  }
  return null;
}

export function moveStrokes(lines: LineData[], ids: string[], dx: number, dy: number): LineData[] {
  const set = new Set(ids);
  return lines.map((l) => (set.has(l.id) ? { ...l, points: l.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) } : l));
}
