import type { KdpPrintSpec } from "@/types/kdpBook";

/**
 * On-screen editor scale only — export never uses this. Vector content is
 * resolution-independent, so the only thing this number controls is how
 * big the editor preview looks in the browser.
 */
export const SCREEN_PX_PER_INCH = 96;

export const DEFAULT_PRINT_SPEC: KdpPrintSpec = {
  trimWidthIn: 8.5,
  trimHeightIn: 11,
  bleedIn: 0.125,
  gutterIn: 0.375,
  outerMarginIn: 0.25,
  dpi: 300,
  globalStrokeWeightPx: 3,
  colorMode: "RGB",
};

// A few other common KDP trim sizes, for reference/future use.
export const KDP_TRIM_SIZES: { label: string; widthIn: number; heightIn: number }[] = [
  { label: '8.5" x 11" (Letter)', widthIn: 8.5, heightIn: 11 },
  { label: '8.5" x 8.5" (Square)', widthIn: 8.5, heightIn: 8.5 },
  { label: '6" x 9"', widthIn: 6, heightIn: 9 },
];

export function inchesToPx(inches: number, pxPerInch: number = SCREEN_PX_PER_INCH): number {
  return inches * pxPerInch;
}

export function ptToInches(points: number): number {
  return points / 72;
}

/** Pixel dimensions a raster asset needs to hit the spec's DPI at its printed size. */
export function requiredRasterPx(widthIn: number, heightIn: number, dpi: number): { width: number; height: number } {
  return { width: Math.round(widthIn * dpi), height: Math.round(heightIn * dpi) };
}
