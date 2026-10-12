import { BLEED_PT } from "@/utils/pageGeometry";
import type { PageSpace } from "@/types/editor";

// Konva renders at CSS pixels (~72/in); asking for this pixelRatio when
// calling stage.toDataURL() rasterizes at ~300 DPI equivalent instead.
export const EXPORT_PIXEL_RATIO = 300 / 72;

/**
 * One PDF page: a rasterized canvas (a `stage.toDataURL()` PNG) and where it
 * goes. The editor's canvas is the real trim (+ bleed) in points, so an
 * image is placed 1:1. Interior bleed pages are trim + 0.125in wide (outside
 * edge only) and + 0.25in tall, per KDP; right-hand pages shift the image
 * left to drop the bleed on the gutter side. A cover is one page the size of
 * the whole spread.
 */
export interface ExportPage {
  /** PNG data URL of the full canvas. */
  src: string;
  /** PDF page size, in points. */
  pageWidth: number;
  pageHeight: number;
  /** Where the image's top-left lands, and its size, in points (it may extend past the page — that part is cropped). */
  x: number;
  y: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Builds the PDF from pre-rendered page images (one PNG per book page, in
 * page order) and downloads it.
 *
 * Built in the browser with PDFKit's browser build. It used to be posted to
 * a Route Handler, but a whole book of 300 DPI pages is tens of megabytes
 * and hosts cap a request body far below that (Vercel: 4.5 MB → HTTP 413).
 * Not jsPDF, which assembles the whole PDF as one JS string — every image
 * byte held as binary, base64 and further copies (a measured 34 MB output
 * for a single page, and "Invalid string length" on long books). PDFKit
 * streams binary chunks instead.
 *
 * The pages stay RGB: genuine CMYK would mean re-encoding each PNG's pixels
 * as a CMYK image, which PDFKit doesn't do (its CMYK is for vector fills).
 */
export async function exportPagesToPdf(pages: ExportPage[], fileName = "my-coloring-book.pdf") {
  if (pages.length === 0) return;

  const blob = await renderPdf(pages, fileName.replace(/\.pdf$/i, ""));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** The PDF itself, without downloading it — for packs that put several files in one ZIP. */
export async function renderPdf(pages: ExportPage[], title: string): Promise<Blob> {
  if (pages.length === 0) throw new Error("No pages to export.");
  // Loaded only when exporting: the browser build is a few hundred KB.
  const [pdfkit, helvetica] = await Promise.all([import("pdfkit"), import("pdfkit/standard-fonts/Helvetica")]);
  const PDFDocument = pdfkit.default;
  // The browser build has no file system to read its default font (Helvetica) from; it must be handed over.
  (pdfkit as unknown as { registerStdFonts(...fonts: unknown[]): void }).registerStdFonts(helvetica.default);
  const doc = new PDFDocument({ size: [pages[0].pageWidth, pages[0].pageHeight], margin: 0, autoFirstPage: false, info: title ? { Title: title } : undefined });
  const chunks: Uint8Array[] = [];
  const finished = new Promise<Blob>((resolve, reject) => {
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(new Blob(chunks as BlobPart[], { type: "application/pdf" })));
    doc.on("error", reject);
  });
  for (const page of pages) {
    doc.addPage({ size: [page.pageWidth, page.pageHeight], margin: 0 });
    // PDFKit reads a base64 data URL itself.
    doc.image(page.src, page.x, page.y, { width: page.imageWidth, height: page.imageHeight });
  }
  doc.end();
  return finished;
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
