// Print-at-home PDFs: the book's pages fitted onto A4 or US Letter with a
// printer-safe margin — for a test print before ordering a proof, and for
// selling the book as a digital download.

import type { ExportPage } from "@/utils/rasterPdfExporter";
import type { PageSpace } from "@/types/editor";

export type SheetId = "a4" | "letter";

export const SHEETS: Record<SheetId, { label: string; width: number; height: number }> = {
  a4: { label: "A4", width: 595.28, height: 841.89 },
  letter: { label: "US Letter", width: 612, height: 792 },
};

/** Most home printers can't print closer to the edge than about a quarter inch. */
export const PRINTER_MARGIN_PT = 18;

/** One page image centred on a sheet, as large as fits inside the printer margin. Bleed is cropped off: a home print has no trim. */
export function fitOnSheet(src: string, space: PageSpace, sheet: SheetId): ExportPage {
  const { width: sw, height: sh } = SHEETS[sheet];
  const trimW = space.width - space.bleed * 2;
  const trimH = space.height - space.bleed * 2;
  const k = Math.min((sw - PRINTER_MARGIN_PT * 2) / trimW, (sh - PRINTER_MARGIN_PT * 2) / trimH);
  return {
    src,
    pageWidth: sw,
    pageHeight: sh,
    x: (sw - trimW * k) / 2 - space.bleed * k,
    y: (sh - trimH * k) / 2 - space.bleed * k,
    imageWidth: space.width * k,
    imageHeight: space.height * k,
  };
}

/** A full-sheet image (the "how to print" page), edge to edge. */
export function fullSheet(src: string, sheet: SheetId): ExportPage {
  const { width, height } = SHEETS[sheet];
  return { src, pageWidth: width, pageHeight: height, x: 0, y: 0, imageWidth: width, imageHeight: height };
}

/** The pages a test print uses: the current one and the next drawn pages, up to `count`. */
export function samplePages<T extends { id: string; isBlankBack?: boolean; objects: unknown[]; lines: unknown[] }>(pages: T[], currentId: string, count = 4): T[] {
  const drawn = pages.filter((p) => !p.isBlankBack && (p.objects.length > 0 || p.lines.length > 0));
  const start = Math.max(0, drawn.findIndex((p) => p.id === currentId));
  const picked = drawn.slice(start, start + count);
  // Near the end of the book, top up from the pages before.
  return picked.length < count ? [...drawn.slice(Math.max(0, start - (count - picked.length)), start), ...picked] : picked;
}
