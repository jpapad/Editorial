import type { ExportPage } from "@/utils/rasterPdfExporter";
import { BLEED_PT } from "@/utils/pageGeometry";
import type { PageSpace } from "@/types/editor";

// Konva renders at CSS pixels (~72/in); asking for this pixelRatio when
// calling stage.toDataURL() rasterizes at ~300 DPI equivalent instead.
export const EXPORT_PIXEL_RATIO = 300 / 72;

/**
 * Sends pre-rendered page images (one Konva `stage.toDataURL()` PNG per
 * book page, in page order) to /api/export-editor-pdf — a PDFKit-based,
 * binary-streamed pipeline — and downloads the resulting PDF.
 *
 * Previously did this client-side with jsPDF, which assembles the whole
 * PDF as a single JS string: every image byte existed simultaneously as
 * raw binary, a base64 copy, and further copies made while jsPDF built and
 * serialized that string, multiplying rather than just adding to memory/
 * output size — an empirically-confirmed 34MB output for a single page,
 * and a real "Invalid string length" crash risk on a longer book. PDFKit
 * (server-side, see rasterPdfExporter.ts) streams binary chunks instead,
 * which is why this is now async and goes over the network rather than
 * running entirely in the tab.
 */
export async function exportPagesToPdf(pages: ExportPage[], fileName = "my-coloring-book.pdf") {
  if (pages.length === 0) return;

  const title = fileName.replace(/\.pdf$/i, "");
  const response = await fetch("/api/export-editor-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages, title }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error ?? `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * PDF placement for one interior page captured from a canvas of `space`.
 * No bleed: the page is the trim. With bleed (KDP interior): the page is
 * trim + 0.125in wide and + 0.25in tall — bleed on the outside edge only —
 * so on right-hand pages (odd page numbers, 1-based) the canvas's left
 * bleed hangs off the page and gets cropped.
 */
export function interiorExportPage(src: string, space: PageSpace, pageNumber: number): ExportPage {
  if (!space.bleed) return { src, pageWidth: space.width, pageHeight: space.height, x: 0, y: 0, imageWidth: space.width, imageHeight: space.height };
  const isRightHand = pageNumber % 2 === 1;
  return {
    src,
    pageWidth: space.width - BLEED_PT,
    pageHeight: space.height,
    x: isRightHand ? -BLEED_PT : 0,
    y: 0,
    imageWidth: space.width,
    imageHeight: space.height,
  };
}

/** A cover: one page exactly the size of the spread (bleed included). */
export function coverExportPage(src: string, space: PageSpace): ExportPage {
  return { src, pageWidth: space.width, pageHeight: space.height, x: 0, y: 0, imageWidth: space.width, imageHeight: space.height };
}
