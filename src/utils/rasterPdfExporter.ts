// NODE-ONLY. Imports 'pdfkit' — does not run in a browser. Never import
// this from a 'use client' component; call it from the /api/export-editor-
// pdf Route Handler instead (Node runtime, not edge — pdfkit needs Node).
//
// This is the merged (Konva-based) editor's exporter — utils/pdfExporter.ts
// is a *different* pipeline for the older BookState/PageSpread vector data
// model and can't be reused directly (see that file's own module comment).
// The two share a motivation, though: replacing jsPDF, whose past failure
// mode on this project was real, not hypothetical — it assembles the whole
// PDF as one JS string, which both risks "Invalid string length" on a long
// book and, more mundanely, meant every image byte existed simultaneously
// as raw binary, a base64 copy, and copies made while jsPDF built and then
// serialized its internal string — multiplying, not just adding to, actual
// memory/output use (an empirically-confirmed 34MB output for a single
// page). PDFKit streams binary chunks instead of building one string, so
// none of that multiplication happens.
//
// Each page here is still a rasterized PNG (one `stage.toDataURL()` snapshot
// per book page, captured client-side) — this fixes the streaming/size
// pathology, not the color space. Genuine CMYK would mean decoding each
// PNG's pixel buffer and re-encoding it as a raw CMYK image XObject (PDFKit
// has no built-in raster color-space conversion — its CMYK support is for
// vector fills/strokes only, which utils/pdfExporter.ts's SVG-based
// pipeline uses); that's real, separate work this pass doesn't attempt, so
// the embedded pages stay RGB. Said plainly rather than implied.
//
// Page size: each page arrives with its own PDF page size and placement
// (see ExportPage). The editor's canvas is the real trim (+ bleed) in
// points, so an image is placed 1:1 — no letterboxing. Interior bleed pages
// are trim + 0.125in wide (outside edge only) and + 0.25in tall, per KDP;
// the caller shifts the image left on right-hand pages to drop the bleed on
// the gutter side. A cover is a single page the size of the whole spread.

import PDFDocument from "pdfkit";

function dataUrlToBuffer(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex === -1) {
    throw new Error("Each page must be a data URL (e.g. from canvas.toDataURL()).");
  }
  return Buffer.from(dataUrl.slice(commaIndex + 1), "base64");
}

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

/** One rasterized image per page, placed exactly as described, streamed into a single PDF. */
export async function exportRasterPagesToPdf(pages: ExportPage[], title?: string): Promise<Buffer> {
  if (pages.length === 0) throw new Error("No pages to export.");

  const doc = new PDFDocument({
    size: [pages[0].pageWidth, pages[0].pageHeight],
    margin: 0,
    autoFirstPage: false,
    info: title ? { Title: title } : undefined,
  });

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  for (const page of pages) {
    doc.addPage({ size: [page.pageWidth, page.pageHeight], margin: 0 });
    doc.image(dataUrlToBuffer(page.src), page.x, page.y, { width: page.imageWidth, height: page.imageHeight });
  }

  doc.end();
  return finished;
}
