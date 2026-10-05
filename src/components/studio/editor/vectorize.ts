// Raster → vector for line art: the dark pixels of a picture become filled
// SVG outlines, so the lines stay sharp at any print size (an AI picture is
// a fixed grid of pixels and goes soft when enlarged). Pure maths on a
// PixelBuffer — no DOM — so it runs in tests.
//
// How: follow the cracks between dark and light pixels into closed loops,
// drop specks, simplify each loop, and round off its vertices.

import { isWallPixel, type PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

export interface VectorizeOptions {
  /** 0–255: how dark a pixel must be to count as line (default 128). */
  threshold?: number;
  /** Loops enclosing less than this many px² are dust and are dropped (default 6). */
  minArea?: number;
  /** How far, in px, the simplified outline may stray from the pixels (default 1 — just over a pixel step, so staircases flatten). */
  tolerance?: number;
  fill?: string;
}

export interface VectorizeResult {
  svg: string;
  paths: number;
  points: number;
}

type Pt = [number, number];

function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = 0;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * (by - ay) - (pts[i][1] - ay) * (bx - ax)) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at >= 0 && worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function area(pts: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/** Closed outlines of the dark areas, as loops of pixel-corner points. */
export function traceLoops(image: PixelBuffer, threshold = 128): Pt[][] {
  const { width: w, height: h, data } = image;
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (isWallPixel(data, i * 4, threshold)) dark[i] = 1;
  const isDark = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && dark[y * w + x] === 1;

  // One directed edge per dark/light crack, walking clockwise around the dark side.
  // Edges are stored by start vertex: up to 2 can leave a vertex (dark pixels touching at a corner).
  const stride = w + 1;
  const next = new Int32Array(stride * (h + 1) * 2).fill(-1);
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const v = (y0 * stride + x0) * 2;
    next[next[v] === -1 ? v : v + 1] = y1 * stride + x1;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dark[y * w + x]) continue;
      if (!isDark(x, y - 1)) add(x, y, x + 1, y);
      if (!isDark(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!isDark(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!isDark(x - 1, y)) add(x, y + 1, x, y);
    }
  }

  const loops: Pt[][] = [];
  for (let start = 0; start < next.length; start++) {
    if (next[start] === -1) continue;
    const loop: Pt[] = [];
    let from = start >> 1;
    let slot = start;
    let prevDx = 0;
    let prevDy = 0;
    for (;;) {
      const to = next[slot];
      next[slot] = -1;
      const fx = from % stride;
      const fy = (from - fx) / stride;
      const tx = to % stride;
      const ty = (to - tx) / stride;
      // Record only corners: a straight run of pixel edges is one segment.
      if (tx - fx !== prevDx || ty - fy !== prevDy) loop.push([fx, fy]);
      prevDx = tx - fx;
      prevDy = ty - fy;
      from = to;
      const a = to * 2;
      if (next[a] === -1 && next[a + 1] === -1) break;
      if (next[a] !== -1 && next[a + 1] !== -1) {
        // Two ways on: turn right (clockwise), which keeps corner-touching dark pixels as separate shapes.
        const ax = (next[a] % stride) - tx;
        const ay = Math.floor(next[a] / stride) - ty;
        const rightTurn = prevDx * ay - prevDy * ax > 0;
        slot = rightTurn ? a : a + 1;
      } else slot = next[a] !== -1 ? a : a + 1;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** How far from a corner (px) its rounding may reach — small, so real corners stay corners. */
const ROUND_PX = 4;

/** A closed loop as a path: straight along its edges, each vertex rounded off within a few pixels. */
function loopPath(pts: Pt[]): string {
  const n = pts.length;
  const toward = (from: Pt, to: Pt, d: number): Pt => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
    return [from[0] + ((to[0] - from[0]) * d) / len, from[1] + ((to[1] - from[1]) * d) / len];
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n];
    const next = pts[(i + 1) % n];
    const reach = (other: Pt) => Math.min(ROUND_PX, Math.hypot(other[0] - pts[i][0], other[1] - pts[i][1]) / 2);
    const a = toward(pts[i], prev, reach(prev));
    const b = toward(pts[i], next, reach(next));
    d += `${i === 0 ? "M" : "L"}${fmt(a[0])} ${fmt(a[1])}Q${fmt(pts[i][0])} ${fmt(pts[i][1])} ${fmt(b[0])} ${fmt(b[1])}`;
  }
  return d + "Z";
}

export function vectorize(image: PixelBuffer, options: VectorizeOptions = {}): VectorizeResult {
  const { threshold = 128, minArea = 6, tolerance = 1, fill = "#111827" } = options;
  let points = 0;
  const parts: string[] = [];
  for (const loop of traceLoops(image, threshold)) {
    if (Math.abs(area(loop)) < minArea) continue;
    // A closed loop has no "ends" to simplify between: split it at the point furthest from
    // its start and simplify the two halves.
    let far = 0;
    let farD = -1;
    for (let i = 1; i < loop.length; i++) {
      const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2;
      if (d > farD) {
        farD = d;
        far = i;
      }
    }
    const simple = [...simplify(loop.slice(0, far + 1), tolerance).slice(0, -1), ...simplify([...loop.slice(far), loop[0]], tolerance).slice(0, -1)];
    if (simple.length < 3) continue;
    points += simple.length;
    parts.push(loopPath(simple));
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${image.width} ${image.height}" width="${image.width}" height="${image.height}"><path fill="${fill}" fill-rule="evenodd" d="${parts.join("")}"/></svg>`;
  return { svg, paths: parts.length, points };
}
