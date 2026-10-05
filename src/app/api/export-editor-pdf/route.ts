// The merged (Konva) editor's real "Export" integration point: accepts
// already-rasterized page images (one data URL per book page, captured
// client-side via stage.toDataURL()) and returns a streamed PDF. Route
// Handlers run in the Node runtime by default, which is required here — do
// not add `export const runtime = "edge"` (pdfkit doesn't exist on edge).

import { NextResponse } from "next/server";
import { requesterKey, takeRate, tooManyRequests } from "@/lib/rateLimit";
import { exportRasterPagesToPdf, type ExportPage } from "@/utils/rasterPdfExporter";

interface ExportRequestBody {
  pages: ExportPage[];
  title?: string;
}

const MAX_PAGE_PT = 72 * 60; // 60in — generous for any cover spread; rejects nonsense sizes

function isExportPage(p: unknown): p is ExportPage {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const num = (v: unknown, min: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= MAX_PAGE_PT;
  return typeof o.src === "string" && num(o.pageWidth, 1) && num(o.pageHeight, 1) && num(o.imageWidth, 1) && num(o.imageHeight, 1) && num(o.x, -MAX_PAGE_PT) && num(o.y, -MAX_PAGE_PT);
}

/** A whole book of 300 DPI pages is big, but not this big. */
const MAX_BODY_BYTES = 250 * 1024 * 1024;

export async function POST(request: Request) {
  // Open to the signed-out editor too, so counted per IP.
  const rate = takeRate("export", requesterKey(request));
  if (!rate.ok) return tooManyRequests(rate.retryAfter);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "This book is too big to export in one go. Try fewer pages." }, { status: 413 });
  }

  let body: ExportRequestBody;
  try {
    body = (await request.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.pages) || body.pages.length === 0 || !body.pages.every(isExportPage)) {
    return NextResponse.json({ error: "Request body must be { pages: ExportPage[] } (data URL + page size and placement in points)" }, { status: 400 });
  }

  try {
    const pdfBuffer = await exportRasterPagesToPdf(body.pages, body.title);
    const safeName = (body.title ?? "coloring-book").replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "coloring-book";
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF export failed" }, { status: 500 });
  }
}
