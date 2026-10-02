// The shadow of a picture: everything inside its outline, solid black.
// "Inside" = whatever a flood from the picture's border can't reach
// through light or transparent pixels — so a white-filled drawing with a
// black outline becomes one solid shape, not just its lines.

import { isWallPixel, type PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

/** Opaque black where the picture is, transparent around it. */
export function silhouette(image: PixelBuffer, threshold = 128): PixelBuffer {
  const { width, height, data } = image;
  const n = width * height;
  const outside = new Uint8Array(n);
  const stack: number[] = [];
  const visit = (i: number) => {
    if (outside[i] || isWallPixel(data, i * 4, threshold)) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (p >= width) visit(p - width);
    if (p < n - width) visit(p + width);
  }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) if (!outside[i]) out[i * 4 + 3] = 255;
  return { width, height, data: out };
}

const MAX_PX = 360;

/** Browser-only: loads the picture and returns its shadow as a PNG data URL, with the picture's aspect ratio. */
export async function silhouetteDataUrl(src: string): Promise<{ shadowSrc: string; aspect: number }> {
  const img = new window.Image();
  img.crossOrigin = "anonymous"; // pictures stored as links must stay readable
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("unreadable picture"));
    img.src = src;
  });
  const w0 = img.naturalWidth || 512;
  const h0 = img.naturalHeight || 512;
  const k = MAX_PX / Math.max(w0, h0);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w0 * k));
  canvas.height = Math.max(1, Math.round(h0 * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const shadow = silhouette({ width: pixels.width, height: pixels.height, data: pixels.data });
  ctx.putImageData(new ImageData(new Uint8ClampedArray(shadow.data), shadow.width, shadow.height), 0, 0);
  return { shadowSrc: canvas.toDataURL("image/png"), aspect: w0 / h0 };
}
