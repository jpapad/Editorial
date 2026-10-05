// The areas of a page a child would colour, found the way the paint bucket
// sees them (rasterFloodFill.ts): every patch of paper enclosed by ink.
// Feeds the "coloured" preview and colour-by-number. Pure pixel maths — no
// DOM — so it runs in tests.

import { isWallPixel, type PixelBuffer } from "@/components/studio/editor/rasterFloodFill";
import { seededRandom } from "@/components/editor/worksheets";

const DARKNESS_THRESHOLD = 128;
/** Smaller patches are anti-aliasing slivers, not areas anyone sees. */
const IGNORE_BELOW = 20;

export interface Region {
  /** 1-based; `labels[pixel] === id`. */
  id: number;
  size: number;
  /** Touches the page edge — the paper around the picture, not a part of it. */
  edge: boolean;
  /** The point deepest inside the region (furthest from any line) and how far that is, in px. */
  x: number;
  y: number;
  depth: number;
}

export interface RegionMap {
  width: number;
  height: number;
  /** 0 = ink, otherwise the region's id. */
  labels: Int32Array;
  regions: Region[];
}

export function findRegions(boundary: PixelBuffer): RegionMap {
  const { width, height, data } = boundary;
  const n = width * height;
  const labels = new Int32Array(n);
  const wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (isWallPixel(data, i * 4, DARKNESS_THRESHOLD)) wall[i] = 1;

  // Distance to the nearest ink (or page edge), two-pass chamfer — good enough to find each region's roomiest spot.
  const dist = new Float32Array(n);
  const INF = 1e9;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (wall[i] || x === 0 || y === 0 || x === width - 1 || y === height - 1) continue;
      dist[i] = Math.min(INF, dist[i - 1] + 1, dist[i - width] + 1, dist[i - width - 1] + 1.414, dist[i - width + 1] + 1.414);
    }
  }
  for (let y = height - 2; y > 0; y--) {
    for (let x = width - 2; x > 0; x--) {
      const i = y * width + x;
      if (wall[i]) continue;
      dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + width] + 1, dist[i + width + 1] + 1.414, dist[i + width - 1] + 1.414);
    }
  }

  const regions: Region[] = [];
  const stack: number[] = [];
  const visit = (q: number, id: number) => {
    if (wall[q] || labels[q]) return;
    labels[q] = id;
    stack.push(q);
  };
  for (let start = 0; start < n; start++) {
    if (wall[start] || labels[start]) continue;
    const r: Region = { id: regions.length + 1, size: 0, edge: false, x: start % width, y: Math.floor(start / width), depth: 0 };
    labels[start] = r.id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      r.size++;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) r.edge = true;
      if (dist[p] > r.depth) {
        r.depth = dist[p];
        r.x = x;
        r.y = y;
      }
      if (x > 0) visit(p - 1, r.id);
      if (x < width - 1) visit(p + 1, r.id);
      if (y > 0) visit(p - width, r.id);
      if (y < height - 1) visit(p + width, r.id);
    }
    regions.push(r);
  }
  // The deepest spot is often a whole ridge (a wide area): of the spots nearly
  // as deep, take the one nearest the area's middle, so a number sits centred.
  const sumX = new Float64Array(regions.length + 1);
  const sumY = new Float64Array(regions.length + 1);
  for (let i = 0; i < n; i++) {
    const id = labels[i];
    if (!id) continue;
    sumX[id] += i % width;
    sumY[id] += Math.floor(i / width);
  }
  const nearest = new Float64Array(regions.length + 1).fill(Infinity);
  for (let i = 0; i < n; i++) {
    const id = labels[i];
    if (!id) continue;
    const r = regions[id - 1];
    if (dist[i] < r.depth * 0.9) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    const d = (x - sumX[id] / r.size) ** 2 + (y - sumY[id] / r.size) ** 2;
    if (d < nearest[id]) {
      nearest[id] = d;
      r.x = x;
      r.y = y;
    }
  }
  return { width, height, labels, regions };
}

/** The regions someone would actually colour: enclosed, and bigger than a speck. */
export const colorableRegions = (map: RegionMap): Region[] => map.regions.filter((r) => !r.edge && r.size >= IGNORE_BELOW);

const hexToRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** Crayon-box colours for the preview. */
export const PREVIEW_PALETTE = ["#f87171", "#fb923c", "#fbbf24", "#a3e635", "#34d399", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6", "#d6a77a"];

/**
 * The page as it might look coloured in: every enclosed area gets a colour
 * (a different one per seed), the paper around the picture a pale tint, and
 * the ink stays on top — colours are multiplied under it, like real crayon.
 * Returns opaque RGBA at the boundary's size.
 */
export function colorPreview(boundary: PixelBuffer, seed: number, palette: string[] = PREVIEW_PALETTE, map: RegionMap = findRegions(boundary)): PixelBuffer {
  const { width, height, data } = boundary;
  const rand = seededRandom(seed);
  const colors = palette.map(hexToRgb);
  const byRegion = new Map<number, [number, number, number]>();
  let last = -1;
  for (const r of map.regions) {
    if (r.edge || r.size < IGNORE_BELOW) continue;
    let pick = Math.floor(rand() * colors.length);
    if (pick === last) pick = (pick + 1) % colors.length; // neighbours in scan order rarely match
    last = pick;
    byRegion.set(r.id, colors[pick]);
  }
  const paper: [number, number, number] = [255, 251, 240];
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const a = data[o + 3] / 255;
    // The ink layer is transparent where nothing is drawn: flatten onto white, then to a grey level.
    const grey = 255 - a * (255 - (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114));
    const c = map.labels[i] ? (byRegion.get(map.labels[i]) ?? paper) : null;
    // Ink pixels take the colour of the region beside them only through anti-aliasing: keep them as drawn.
    out[o] = c ? (c[0] * grey) / 255 : grey;
    out[o + 1] = c ? (c[1] * grey) / 255 : grey;
    out[o + 2] = c ? (c[2] * grey) / 255 : grey;
    out[o + 3] = 255;
  }
  return { width, height, data: out };
}

export interface NumberedColor {
  hex: string;
  /** English i18n key. */
  name: string;
}

/** Colours a child has in any crayon box, named so the key still reads in a black-and-white print. */
export const NUMBER_COLORS: NumberedColor[] = [
  { hex: "#e53935", name: "Red" },
  { hex: "#1e88e5", name: "Blue" },
  { hex: "#fdd835", name: "Yellow" },
  { hex: "#43a047", name: "Green" },
  { hex: "#fb8c00", name: "Orange" },
  { hex: "#8e24aa", name: "Purple" },
  { hex: "#f06292", name: "Pink" },
  { hex: "#8d6e63", name: "Brown" },
];

export interface RegionNumber {
  /** 1-based index into the colours used. */
  n: number;
  x: number;
  y: number;
  /** Room around the number, px — sets how big it can be printed. */
  depth: number;
}

/** Areas need this much room (px from the nearest line) to hold a readable number. */
export const MIN_NUMBER_DEPTH = 5;

/**
 * A number for every area big enough to hold one, using `colorCount`
 * colours. Consecutive areas get different numbers, and every colour is
 * used when there are enough areas.
 */
export function numberRegions(map: RegionMap, colorCount: number, seed: number): RegionNumber[] {
  const rand = seededRandom(seed);
  const k = Math.max(2, Math.min(NUMBER_COLORS.length, Math.round(colorCount)));
  const areas = colorableRegions(map).filter((r) => r.depth >= MIN_NUMBER_DEPTH);
  let last = -1;
  return areas.map((r, i) => {
    // The first k areas take each colour once, so none is left out of the picture.
    let pick = i < k ? i : Math.floor(rand() * k);
    if (pick === last) pick = (pick + 1) % k;
    last = pick;
    return { n: pick + 1, x: r.x, y: r.y, depth: r.depth };
  });
}
