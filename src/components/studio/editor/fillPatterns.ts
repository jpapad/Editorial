// Patterned paint for the bucket: the flood fill finds the region exactly as
// before (rasterFloodFill.ts), then the region is painted with a two-tone
// tile instead of flat color — a light tint of the chosen color as the
// ground, the color itself for the motif, so the child's pick still reads.

import type { FillStyle } from "@/types/editor";

export const FILL_STYLES: { value: FillStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "stars", label: "Stars" },
  { value: "stripes", label: "Stripes" },
  { value: "dots", label: "Dots" },
  { value: "hearts", label: "Hearts" },
];

const TILE = 24;

/** The chosen color mixed toward white — the pattern's ground. */
function tint(hex: string, amount = 0.72): string {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16) || 0;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function drawMotif(ctx: CanvasRenderingContext2D, style: FillStyle, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (style) {
    case "stripes":
      ctx.lineWidth = 6;
      for (let o = -TILE; o <= TILE; o += TILE / 2) {
        ctx.beginPath();
        ctx.moveTo(o, TILE);
        ctx.lineTo(o + TILE, 0);
        ctx.stroke();
      }
      break;
    case "dots":
      for (const [x, y] of [
        [6, 6],
        [18, 18],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "stars": {
      const star = (cx: number, cy: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 === 0 ? r : r * 0.45;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
        }
        ctx.closePath();
        ctx.fill();
      };
      star(7, 7, 5.5);
      star(19, 19, 4);
      break;
    }
    case "hearts": {
      const heart = (cx: number, cy: number, s: number) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.9);
        ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.7, cy - s * 1.3, cx, cy - s * 0.45);
        ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
        ctx.fill();
      };
      heart(7, 8, 4.5);
      heart(19, 20, 3.5);
      break;
    }
    case "solid":
      break;
  }
}

/** RGBA for a whole page filled with the pattern (browser-only). */
export function patternPixels(style: FillStyle, color: string, width: number, height: number): Uint8ClampedArray | null {
  const tile = document.createElement("canvas");
  tile.width = TILE;
  tile.height = TILE;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  tctx.fillStyle = tint(color);
  tctx.fillRect(0, 0, TILE, TILE);
  drawMotif(tctx, style, color);

  const page = document.createElement("canvas");
  page.width = width;
  page.height = height;
  const ctx = page.getContext("2d", { willReadFrequently: true });
  const pattern = ctx?.createPattern(tile, "repeat");
  if (!ctx || !pattern) return null;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

/** A small preview swatch for the picker. */
export function patternPreviewUrl(style: FillStyle, color: string): string {
  const c = document.createElement("canvas");
  c.width = TILE * 2;
  c.height = TILE * 2;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  if (style === "solid") {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
  } else {
    const px = patternPixels(style, color, c.width, c.height);
    if (px) ctx.putImageData(new ImageData(new Uint8ClampedArray(px), c.width, c.height), 0, 0);
  }
  return c.toDataURL();
}
