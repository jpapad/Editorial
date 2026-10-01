// Pure stroke processing for the pen/eraser: mirror/radial symmetry and
// stroke smoothing. Points are Konva's flattened [x1, y1, x2, y2, …].

import type { LineStyle, SymmetryMode } from "@/types/editor";

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
