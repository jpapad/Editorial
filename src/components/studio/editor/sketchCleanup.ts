// Turns a phone photo of a pencil/pen sketch into clean black line art on
// a transparent background. Plain image processing, run in the browser —
// no AI service involved.
//
// Why not the stamp picker's existing "line art" filter: that's a single
// global threshold, which fails on photos — a shadow across the paper
// turns half the page black while faint lines in the bright half vanish.
// This uses an adaptive (local-mean) threshold instead: each pixel is
// compared to the brightness of its own neighborhood, so uneven lighting
// cancels out. DOM-independent core (cleanSketch) like rasterFloodFill.ts.

import type { PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

export interface SketchCleanupOptions {
  /** How much darker than its surroundings a pixel must be to count as a line, 0.02–0.3. Higher = fewer, darker lines only. */
  sensitivity: number;
  /** Thicken every line by ~1px — faint pencil sketches print too thin otherwise. */
  bolder: boolean;
}

export interface CleanedSketch {
  /** Black ink on transparent, cropped to the drawing. */
  buffer: PixelBuffer;
  inkPixels: number;
}

/** Integral image of luminance, (w+1)×(h+1), for O(1) box means. */
function integral(lum: Float32Array, w: number, h: number): Float64Array {
  const out = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += lum[y * w + x];
      out[(y + 1) * (w + 1) + x + 1] = out[y * (w + 1) + x + 1] + row;
    }
  }
  return out;
}

/** Drops ink specks smaller than `minArea` (8-connected): paper grain, dust, JPEG noise. */
function removeSpecks(ink: Uint8Array, w: number, h: number, minArea: number) {
  const seen = new Uint8Array(ink.length);
  const component: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    component.length = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      component.push(p);
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (ink[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
    }
    if (component.length < minArea) for (const p of component) ink[p] = 0;
  }
}

function dilate1(ink: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(ink.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
      }
    }
  }
  return out;
}

export function cleanSketch(src: PixelBuffer, { sensitivity, bolder }: SketchCleanupOptions): CleanedSketch {
  const { width: w, height: h, data } = src;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < lum.length; i++) {
    const a = data[i * 4 + 3] / 255;
    // Transparent pixels count as white paper.
    lum[i] = (1 - a) * 255 + a * (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }

  const sums = integral(lum, w, h);
  const radius = Math.max(7, Math.round(Math.min(w, h) / 40));
  let ink: Uint8Array = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = sums[y1 * (w + 1) + x1] - sums[y0 * (w + 1) + x1] - sums[y1 * (w + 1) + x0] + sums[y0 * (w + 1) + x0];
      const mean = sum / area;
      // Also require some absolute darkness, so flat paper texture never qualifies.
      ink[y * w + x] = lum[y * w + x] < mean * (1 - sensitivity) && lum[y * w + x] < 225 ? 1 : 0;
    }
  }

  removeSpecks(ink, w, h, Math.max(12, Math.round((w * h) / 60000)));
  if (bolder) ink = dilate1(ink, w, h);

  // Crop to the drawing, with a little breathing room.
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let inkPixels = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink[y * w + x]) continue;
      inkPixels++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (inkPixels === 0) return { buffer: { width: 1, height: 1, data: new Uint8ClampedArray(4) }, inkPixels: 0 };

  const pad = Math.round(Math.min(w, h) * 0.02);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (ink[(y + minY) * w + (x + minX)]) out[(y * cw + x) * 4 + 3] = 255; // black (RGB stays 0), opaque
    }
  }
  return { buffer: { width: cw, height: ch, data: out }, inkPixels };
}

const MAX_WORKING_SIZE = 1600;

/** Browser wrapper: decode an image file/data URL, downscale to a workable size, clean it, and return a PNG data URL plus its size. */
export async function cleanSketchImage(src: string, options: SketchCleanupOptions): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, MAX_WORKING_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  const result = cleanSketch({ width: w, height: h, data: imageData.data }, options);
  if (result.inkPixels === 0) return null;

  const out = document.createElement("canvas");
  out.width = result.buffer.width;
  out.height = result.buffer.height;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  const outData = outCtx.createImageData(out.width, out.height);
  outData.data.set(result.buffer.data);
  outCtx.putImageData(outData, 0, 0);
  return { dataUrl: out.toDataURL("image/png"), width: out.width, height: out.height };
}
