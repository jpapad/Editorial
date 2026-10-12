// How each Latin letter is written by hand, stroke by stroke, in the plain
// "ball and stick" print taught in early grades. Used by the letter tracing
// worksheet (worksheets.ts) to draw dotted letters along the centre of each
// stroke, with numbered start points and arrows for the stroke order.
//
// Units: the letter's height from the top line to the baseline is 1.
// y = 0 top line, 0.5 midline (x-height), 1 baseline, 1.5 descender line;
// x runs from 0 to the glyph's width `w`. Arcs use degrees with y pointing
// down, so increasing angles turn clockwise on the page.

export type StrokeCmd = ["M", number, number] | ["L", number, number] | ["A", number, number, number, number, number, number];

export interface StrokeGlyph {
  w: number;
  strokes: StrokeCmd[][];
  /** Dots of i and j, written after the strokes. */
  dots?: [number, number][];
}

const M = (x: number, y: number): StrokeCmd => ["M", x, y];
const L = (x: number, y: number): StrokeCmd => ["L", x, y];
/** Arc around (cx, cy) with radii rx, ry from angle a0 to a1. */
const A = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): StrokeCmd => ["A", cx, cy, rx, ry, a0, a1];

export const LETTER_STROKES: Record<string, StrokeGlyph> = {
  A: { w: 0.8, strokes: [[M(0.4, 0), L(0, 1)], [M(0.4, 0), L(0.8, 1)], [M(0.15, 0.62), L(0.65, 0.62)]] },
  B: { w: 0.63, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.35, 0), A(0.35, 0.25, 0.25, 0.25, -90, 90), L(0, 0.5), L(0.38, 0.5), A(0.38, 0.75, 0.25, 0.25, -90, 90), L(0, 1)]] },
  C: { w: 0.8, strokes: [[A(0.42, 0.5, 0.42, 0.5, -45, -315)]] },
  D: { w: 0.7, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.2, 0), A(0.2, 0.5, 0.5, 0.5, -90, 90), L(0, 1)]] },
  E: { w: 0.6, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.6, 0)], [M(0, 0.5), L(0.5, 0.5)], [M(0, 1), L(0.6, 1)]] },
  F: { w: 0.6, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.6, 0)], [M(0, 0.5), L(0.5, 0.5)]] },
  G: { w: 0.84, strokes: [[A(0.42, 0.5, 0.42, 0.5, -45, -360)], [M(0.5, 0.5), L(0.84, 0.5)]] },
  H: { w: 0.7, strokes: [[M(0, 0), L(0, 1)], [M(0.7, 0), L(0.7, 1)], [M(0, 0.5), L(0.7, 0.5)]] },
  I: { w: 0.5, strokes: [[M(0.25, 0), L(0.25, 1)], [M(0, 0), L(0.5, 0)], [M(0, 1), L(0.5, 1)]] },
  J: { w: 0.75, strokes: [[M(0.5, 0), L(0.5, 0.75), A(0.275, 0.75, 0.225, 0.25, 0, 180)], [M(0.25, 0), L(0.75, 0)]] },
  K: { w: 0.65, strokes: [[M(0, 0), L(0, 1)], [M(0.65, 0), L(0, 0.55)], [M(0.2, 0.38), L(0.65, 1)]] },
  L: { w: 0.55, strokes: [[M(0, 0), L(0, 1)], [M(0, 1), L(0.55, 1)]] },
  M: { w: 0.9, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.45, 0.7), L(0.9, 0)], [M(0.9, 0), L(0.9, 1)]] },
  N: { w: 0.7, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.7, 1)], [M(0.7, 0), L(0.7, 1)]] },
  O: { w: 0.9, strokes: [[A(0.45, 0.5, 0.45, 0.5, -90, -450)]] },
  P: { w: 0.62, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.37, 0), A(0.37, 0.25, 0.25, 0.25, -90, 90), L(0, 0.5)]] },
  Q: { w: 0.9, strokes: [[A(0.45, 0.5, 0.45, 0.5, -90, -450)], [M(0.55, 0.75), L(0.9, 1.05)]] },
  R: { w: 0.65, strokes: [[M(0, 0), L(0, 1)], [M(0, 0), L(0.37, 0), A(0.37, 0.25, 0.25, 0.25, -90, 90), L(0, 0.5)], [M(0.3, 0.5), L(0.65, 1)]] },
  S: { w: 0.65, strokes: [[A(0.33, 0.25, 0.3, 0.25, -30, -270), A(0.33, 0.75, 0.32, 0.25, -90, 150)]] },
  T: { w: 0.7, strokes: [[M(0.35, 0), L(0.35, 1)], [M(0, 0), L(0.7, 0)]] },
  U: { w: 0.7, strokes: [[M(0, 0), L(0, 0.7), A(0.35, 0.7, 0.35, 0.3, 180, 0), L(0.7, 0)]] },
  V: { w: 0.8, strokes: [[M(0, 0), L(0.4, 1), L(0.8, 0)]] },
  W: { w: 1, strokes: [[M(0, 0), L(0.25, 1), L(0.5, 0.3), L(0.75, 1), L(1, 0)]] },
  X: { w: 0.7, strokes: [[M(0, 0), L(0.7, 1)], [M(0.7, 0), L(0, 1)]] },
  Y: { w: 0.7, strokes: [[M(0, 0), L(0.35, 0.5)], [M(0.7, 0), L(0.35, 0.5), L(0.35, 1)]] },
  Z: { w: 0.7, strokes: [[M(0, 0), L(0.7, 0), L(0, 1), L(0.7, 1)]] },

  a: { w: 0.5, strokes: [[A(0.25, 0.75, 0.25, 0.25, -30, -390)], [M(0.5, 0.5), L(0.5, 1)]] },
  b: { w: 0.5, strokes: [[M(0, 0), L(0, 1)], [A(0.25, 0.75, 0.25, 0.25, 180, 540)]] },
  c: { w: 0.45, strokes: [[A(0.25, 0.75, 0.25, 0.25, -45, -315)]] },
  d: { w: 0.5, strokes: [[A(0.25, 0.75, 0.25, 0.25, -30, -390)], [M(0.5, 0), L(0.5, 1)]] },
  e: { w: 0.5, strokes: [[M(0, 0.75), L(0.5, 0.75), A(0.25, 0.75, 0.25, 0.25, 0, -315)]] },
  f: { w: 0.42, strokes: [[A(0.27, 0.2, 0.15, 0.15, -50, -180), L(0.12, 1)], [M(0, 0.5), L(0.32, 0.5)]] },
  g: { w: 0.5, strokes: [[A(0.25, 0.75, 0.25, 0.25, -30, -390)], [M(0.5, 0.5), L(0.5, 1.3), A(0.25, 1.3, 0.25, 0.2, 0, 150)]] },
  h: { w: 0.5, strokes: [[M(0, 0), L(0, 1)], [A(0.25, 0.75, 0.25, 0.25, 180, 360), L(0.5, 1)]] },
  i: { w: 0.1, strokes: [[M(0.05, 0.5), L(0.05, 1)]], dots: [[0.05, 0.3]] },
  j: { w: 0.42, strokes: [[M(0.38, 0.5), L(0.38, 1.3), A(0.18, 1.3, 0.2, 0.2, 0, 160)]], dots: [[0.38, 0.3]] },
  k: { w: 0.45, strokes: [[M(0, 0), L(0, 1)], [M(0.45, 0.5), L(0, 0.8)], [M(0.15, 0.7), L(0.45, 1)]] },
  l: { w: 0.1, strokes: [[M(0.05, 0), L(0.05, 1)]] },
  m: { w: 0.8, strokes: [[M(0, 0.5), L(0, 1)], [A(0.2, 0.7, 0.2, 0.2, 180, 360), L(0.4, 1)], [A(0.6, 0.7, 0.2, 0.2, 180, 360), L(0.8, 1)]] },
  n: { w: 0.5, strokes: [[M(0, 0.5), L(0, 1)], [A(0.25, 0.75, 0.25, 0.25, 180, 360), L(0.5, 1)]] },
  o: { w: 0.5, strokes: [[A(0.25, 0.75, 0.25, 0.25, -90, -450)]] },
  p: { w: 0.5, strokes: [[M(0, 0.5), L(0, 1.5)], [A(0.25, 0.75, 0.25, 0.25, 180, 540)]] },
  q: { w: 0.5, strokes: [[A(0.25, 0.75, 0.25, 0.25, -30, -390)], [M(0.5, 0.5), L(0.5, 1.5)]] },
  r: { w: 0.4, strokes: [[M(0, 0.5), L(0, 1)], [A(0.2, 0.72, 0.2, 0.22, 180, 320)]] },
  s: { w: 0.4, strokes: [[A(0.2, 0.625, 0.18, 0.125, -30, -270), A(0.2, 0.875, 0.2, 0.125, -90, 150)]] },
  t: { w: 0.4, strokes: [[M(0.2, 0.15), L(0.2, 1)], [M(0, 0.5), L(0.4, 0.5)]] },
  u: { w: 0.5, strokes: [[M(0, 0.5), L(0, 0.75), A(0.25, 0.75, 0.25, 0.25, 180, 0), L(0.5, 0.5)], [M(0.5, 0.5), L(0.5, 1)]] },
  v: { w: 0.5, strokes: [[M(0, 0.5), L(0.25, 1), L(0.5, 0.5)]] },
  w: { w: 0.8, strokes: [[M(0, 0.5), L(0.2, 1), L(0.4, 0.6), L(0.6, 1), L(0.8, 0.5)]] },
  x: { w: 0.5, strokes: [[M(0, 0.5), L(0.5, 1)], [M(0.5, 0.5), L(0, 1)]] },
  y: { w: 0.5, strokes: [[M(0, 0.5), L(0.3, 1)], [M(0.5, 0.5), L(0.1, 1.5)]] },
  z: { w: 0.5, strokes: [[M(0, 0.5), L(0.5, 0.5), L(0, 1), L(0.5, 1)]] },
};

export function hasStrokes(letter: string): boolean {
  return Object.hasOwn(LETTER_STROKES, letter);
}

/**
 * One stroke as a dense polyline in letter units ([x0, y0, x1, y1, ...]).
 * Dense on purpose: the canvas draws pen lines with curve smoothing, which
 * would round off the corners of a sparse polyline (the point of A, the
 * joins of M and W).
 */
export function sampleStroke(cmds: StrokeCmd[], step = 0.02): number[] {
  const out: number[] = [];
  for (const cmd of cmds) {
    const hasPen = out.length > 0;
    const px = out[out.length - 2];
    const py = out[out.length - 1];
    if (cmd[0] === "M") {
      out.push(cmd[1], cmd[2]);
    } else if (cmd[0] === "L") {
      const [, x, y] = cmd;
      if (!hasPen) {
        out.push(x, y);
        continue;
      }
      const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / step));
      for (let i = 1; i <= n; i++) out.push(px + ((x - px) * i) / n, py + ((y - py) * i) / n);
    } else {
      const [, ox, oy, rx, ry, a0, a1] = cmd;
      const sweep = ((a1 - a0) * Math.PI) / 180;
      const n = Math.max(8, Math.ceil((Math.abs(sweep) * Math.max(rx, ry)) / step));
      const start = (a0 * Math.PI) / 180;
      for (let i = 0; i <= n; i++) {
        const a = start + (sweep * i) / n;
        const x = ox + rx * Math.cos(a);
        const y = oy + ry * Math.sin(a);
        // The arc's first point is where the previous segment ended; don't repeat it.
        if (i === 0 && hasPen && Math.hypot(x - px, y - py) < 1e-6) continue;
        out.push(x, y);
      }
    }
  }
  return out;
}
