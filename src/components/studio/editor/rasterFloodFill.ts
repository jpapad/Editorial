// Raster bucket-fill for the merged editor's Color mode — real flood fill
// against the actual drawn ink, not the vector-region fixture 3a's
// standalone demo uses. Confirmed answer to the flagged question: the
// production canvas is Konva/raster (real pen strokes), so vector-region
// hit-testing doesn't apply here; this is a genuine scanline flood fill
// over pixel data instead.
//
// Deliberately DOM-independent: operates on plain {width, height, data}
// objects — the same shape as a real ImageData, but constructible in
// Node with no canvas/DOM polyfill, so the algorithm itself is testable
// in isolation (same reasoning as svgOptimizer.ts's Douglas-Peucker
// function). The Canvas-2D-specific wiring (getImageData/putImageData,
// Konva layer snapshotting) is a thin caller around this, verified
// separately in a real browser.

export interface PixelBuffer {
  width: number;
  height: number;
  /** RGBA, row-major — same byte layout as ImageData.data. */
  data: Uint8ClampedArray;
}

/** "Wall" = ink: dark enough (by average RGB) and opaque enough to count as a drawn line, not blank canvas. Tolerant of anti-aliased edges via the threshold rather than requiring pure black. */
export function isWallPixel(data: Uint8ClampedArray, index: number, darknessThreshold: number): boolean {
  const a = data[index + 3];
  if (a < 16) return false; // near-fully-transparent — no ink here regardless of RGB
  const darkness = 255 - (data[index] + data[index + 1] + data[index + 2]) / 3;
  return darkness >= darknessThreshold;
}

export interface FloodFillResult {
  filled: boolean;
  pixelsFilled: number;
}

/**
 * Stack-based, span-per-row scanline flood fill. `boundary` supplies which
 * pixels are walls (the ink layer's rendered pixels); `target` is
 * mutated in place with the fill color wherever the open region reaches
 * — it does NOT need to start blank, a fill always overwrites whatever
 * was there before in that same connected region, matching normal
 * "click a new color, it replaces the old one" paint-bucket behavior.
 */
export function floodFill(boundary: PixelBuffer, target: PixelBuffer, startX: number, startY: number, color: [number, number, number, number], darknessThreshold = 128): FloodFillResult {
  const { width, height } = boundary;
  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return { filled: false, pixelsFilled: 0 };

  const startIndex = (sy * width + sx) * 4;
  if (isWallPixel(boundary.data, startIndex, darknessThreshold)) return { filled: false, pixelsFilled: 0 };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];
  let pixelsFilled = 0;

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const rowBase = y * width;
    if (visited[rowBase + x]) continue;
    if (isWallPixel(boundary.data, (rowBase + x) * 4, darknessThreshold)) continue;

    // Find the open span [xLeft, xRight] in this row containing x, so the
    // whole run gets filled and re-seeded in one pass rather than one
    // stack push per pixel.
    let xLeft = x;
    while (xLeft - 1 >= 0 && !visited[rowBase + xLeft - 1] && !isWallPixel(boundary.data, (rowBase + xLeft - 1) * 4, darknessThreshold)) xLeft--;
    let xRight = x;
    while (xRight + 1 < width && !visited[rowBase + xRight + 1] && !isWallPixel(boundary.data, (rowBase + xRight + 1) * 4, darknessThreshold)) xRight++;

    for (let xi = xLeft; xi <= xRight; xi++) {
      const pos = rowBase + xi;
      visited[pos] = 1;
      const di = pos * 4;
      target.data[di] = color[0];
      target.data[di + 1] = color[1];
      target.data[di + 2] = color[2];
      target.data[di + 3] = color[3];
      pixelsFilled++;

      if (y > 0) {
        const upPos = rowBase - width + xi;
        if (!visited[upPos] && !isWallPixel(boundary.data, upPos * 4, darknessThreshold)) stack.push(xi, y - 1);
      }
      if (y < height - 1) {
        const downPos = rowBase + width + xi;
        if (!visited[downPos] && !isWallPixel(boundary.data, downPos * 4, darknessThreshold)) stack.push(xi, y + 1);
      }
    }
  }

  return { filled: pixelsFilled > 0, pixelsFilled };
}

/** Reads the color already painted at one point — backs long-press-to-sample against the fill layer (matches 3a's demo interaction, now against real per-pixel paint). */
export function samplePixelColor(buffer: PixelBuffer, x: number, y: number): [number, number, number, number] | null {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= buffer.width || py >= buffer.height) return null;
  const idx = (py * buffer.width + px) * 4;
  const a = buffer.data[idx + 3];
  if (a < 16) return null; // nothing painted there
  return [buffer.data[idx], buffer.data[idx + 1], buffer.data[idx + 2], a];
}
