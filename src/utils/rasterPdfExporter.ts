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
// Trim size: the source image is always the editor's fixed 595x842pt
// working canvas (CanvasEditor.tsx), whatever aspect ratio the chosen
// KDP trim size actually is (utils/trimSizes.ts) — those don't usually
// match (e.g. 6x9in is noticeably squarer). PDFKit's `fit` option scales
// the image to the largest size that stays inside the target page and
// centers it, so a mismatched aspect ratio letterboxes (white margin on
// one axis) rather than distorting/stretching the art.

import PDFDocument from "pdfkit";
import { getTrimSize } from "@/utils/trimSizes";

function dataUrlToBuffer(dataUrl: string): Buffer {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex === -1) {
    throw new Error("Each page must be a data URL (e.g. from canvas.toDataURL()).");
  }
  return Buffer.from(dataUrl.slice(commaIndex + 1), "base64");
}

/** One rasterized page image per book page, fit (letterboxed, never stretched) into the chosen trim size, streamed into a single PDF. */
export async function exportRasterPagesToPdf(pageDataUrls: string[], title?: string, trimSizeId?: string): Promise<Buffer> {
  if (pageDataUrls.length === 0) throw new Error("No pages to export.");

  const trim = getTrimSize(trimSizeId);
  const pageSize: [number, number] = [trim.widthPt, trim.heightPt];

  const doc = new PDFDocument({
    size: pageSize,
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

  for (const dataUrl of pageDataUrls) {
    doc.addPage({ size: pageSize, margin: 0 });
    doc.image(dataUrlToBuffer(dataUrl), 0, 0, { fit: pageSize, align: "center", valign: "center" });
  }

  doc.end();
  return finished;
}
