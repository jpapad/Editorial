// Matches CanvasEditor's on-screen stage size (A4 at 72pt/in), so each
// captured page image drops onto the PDF page at a 1:1 point scale.
export const PAGE_WIDTH_PT = 595;
export const PAGE_HEIGHT_PT = 842;

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
export async function exportPagesToPdf(pageDataUrls: string[], fileName = "my-coloring-book.pdf", trimSizeId?: string) {
  if (pageDataUrls.length === 0) return;

  const title = fileName.replace(/\.pdf$/i, "");
  const response = await fetch("/api/export-editor-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages: pageDataUrls, title, trimSizeId }),
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
