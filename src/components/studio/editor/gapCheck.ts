// "Will the paint bucket leak?" — finds small breaks in the line art where
// Color mode's flood fill (rasterFloodFill.ts) would spill from one area
// into the next. DOM-independent like rasterFloodFill, so it runs on the
// same PixelBuffer the fill uses and agrees with it on what counts as ink.
//
// Method: morphological closing (dilate the ink by `radius`, then erode it
// back) seals every gap up to ~2×radius px wide. An open area of the real
// drawing that the closing splits into two or more sizeable areas is one
// the bucket would leak across; the pixels the closing added between those
// areas are the gap itself.

import { isWallPixel, type PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

export interface GapMarker {
  x: number;
  y: number;
  /** Radius to draw the marker at, in page units. */
  r: number;
}

const DARKNESS_THRESHOLD = 128; // same default floodFill() uses

/** Box max-filter along one axis; `outside` is what out-of-bounds pixels count as. */
function morphPass(src: Uint8Array, width: number, height: number, radius: number, horizontal: boolean, max: boolean, outside: number): Uint8Array {
  const out = new Uint8Array(src.length);
  const len = horizontal ? width : height;
  const lines = horizontal ? height : width;
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < len; i++) {
      let v = max ? 0 : 1;
      for (let k = -radius; k <= radius; k++) {
        const j = i + k;
        const s = j < 0 || j >= len ? outside : horizontal ? src[line * width + j] : src[j * width + line];
        if (max ? s : !s) {
          v = max ? 1 : 0;
          break;
        }
      }
      out[horizontal ? line * width + i : i * width + line] = v;
    }
  }
  return out;
}

function close(ink: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const dilated = morphPass(morphPass(ink, width, height, radius, true, true, 0), width, height, radius, false, true, 0);
  return morphPass(morphPass(dilated, width, height, radius, true, false, 1), width, height, radius, false, false, 1);
}

/** 4-connected labels of the non-wall pixels (0 = wall). Returns labels and each label's pixel count (index = label). */
function labelOpenAreas(wall: Uint8Array, width: number): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(wall.length);
  const sizes = [0];
  const stack: number[] = [];
  let next = 1;
  for (let start = 0; start < wall.length; start++) {
    if (wall[start] || labels[start]) continue;
    let size = 0;
    labels[start] = next;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % width;
      const neighbors = [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width];
      for (const q of neighbors) {
        if (q < 0 || q >= wall.length || wall[q] || labels[q]) continue;
        labels[q] = next;
        stack.push(q);
      }
    }
    sizes.push(size);
    next++;
  }
  return { labels, sizes };
}

/**
 * Markers at each gap the bucket would leak through. `radius` sets the
 * widest gap found (~2×radius px — the default 6 catches openings up to
 * ~0.17in, which on a coloring page are almost always accidental; a narrow
 * neck that thin between two areas gets flagged too, hence "possible");
 * `minArea` ignores slivers too small for anyone to color, so tight
 * corners don't count as separate areas.
 */
export function findGaps(boundary: PixelBuffer, radius = 6, minArea = 150): GapMarker[] {
  const { width, height, data } = boundary;
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) ink[i] = isWallPixel(data, i * 4, DARKNESS_THRESHOLD) ? 1 : 0;

  const closed = close(ink, width, height, radius);
  const open = labelOpenAreas(ink, width);
  const sealed = labelOpenAreas(closed, width);

  // Which sizeable sealed areas each real open area spans.
  const spans = new Map<number, Set<number>>();
  for (let p = 0; p < ink.length; p++) {
    const s = sealed.labels[p];
    if (!s || sealed.sizes[s] < minArea) continue;
    const o = open.labels[p];
    let set = spans.get(o);
    if (!set) spans.set(o, (set = new Set()));
    set.add(s);
  }
  const leaky = new Set<number>();
  for (const [o, set] of spans) if (set.size >= 2) leaky.add(o);
  if (leaky.size === 0) return [];

  // Pixels the closing sealed inside a leaky area, clustered (8-connected).
  const isGapPixel = (p: number) => closed[p] === 1 && ink[p] === 0 && leaky.has(open.labels[p]);
  const seen = new Uint8Array(ink.length);
  const markers: GapMarker[] = [];
  const stack: number[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (seen[start] || !isGapPixel(start)) continue;
    seen[start] = 1;
    stack.push(start);
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    const touches = new Set<number>();
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % width;
      const y = (p - x) / width;
      sumX += x;
      sumY += y;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          const s = sealed.labels[q];
          if (s && sealed.sizes[s] >= minArea) touches.add(s);
          if (!seen[q] && isGapPixel(q)) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    // A real gap sits BETWEEN two areas; a sealed-off corner notch only touches one.
    if (touches.size >= 2) {
      markers.push({ x: sumX / count, y: sumY / count, r: Math.max(10, Math.max(maxX - minX, maxY - minY) / 2 + 6) });
    }
  }
  return markers;
}
