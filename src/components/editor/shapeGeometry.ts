import type { ShapeKind } from "@/types/editor";

/** Shapes whose outline is a closed polygon computed from their box — everything except rectangle/circle (native Konva nodes) and the open line/arrow strokes. */
export type PolygonShapeKind = Extract<ShapeKind, "triangle" | "star" | "heart" | "hexagon">;

export function isPolygonShape(kind: ShapeKind): kind is PolygonShapeKind {
  return kind === "triangle" || kind === "star" || kind === "heart" || kind === "hexagon";
}

export function isOpenStroke(kind: ShapeKind): kind is "line" | "arrow" {
  return kind === "line" || kind === "arrow";
}

/** Default box for a freshly placed shape — open strokes are wide and short so they read as a line straight away. */
export function defaultShapeSize(kind: ShapeKind): { width: number; height: number } {
  return isOpenStroke(kind) ? { width: 200, height: 24 } : { width: 140, height: 140 };
}

function regularPolygon(sides: number, w: number, h: number, rotationRad = -Math.PI / 2): number[] {
  const points: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotationRad + (i * 2 * Math.PI) / sides;
    points.push(w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a));
  }
  return points;
}

function star(w: number, h: number, spikes = 5, innerRatio = 0.45): number[] {
  const points: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 1 : innerRatio;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    points.push(w / 2 + (w / 2) * r * Math.cos(a), h / 2 + (h / 2) * r * Math.sin(a));
  }
  return points;
}

// The classic parametric heart (x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t),
// sampled and normalized into the box. Its natural extents are x ∈ [-16, 16], y ∈ [-17, 12].
function heart(w: number, h: number, samples = 72): number[] {
  const points: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * 2 * Math.PI;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    points.push(((x + 16) / 32) * w, ((12 - y) / 29) * h);
  }
  return points;
}

/** Flattened [x1, y1, x2, y2, …] outline in the shape's own 0..width × 0..height box (Konva Line `closed`). */
export function polygonPoints(kind: PolygonShapeKind, w: number, h: number): number[] {
  switch (kind) {
    case "triangle":
      return [w / 2, 0, w, h, 0, h];
    case "star":
      return star(w, h);
    case "heart":
      return heart(w, h);
    case "hexagon":
      return regularPolygon(6, w, h, 0);
  }
}
