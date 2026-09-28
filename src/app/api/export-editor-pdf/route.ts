// The merged (Konva) editor's real "Export" integration point: accepts
// already-rasterized page images (one data URL per book page, captured
// client-side via stage.toDataURL()) and returns a streamed PDF. Route
// Handlers run in the Node runtime by default, which is required here — do
// not add `export const runtime = "edge"` (pdfkit doesn't exist on edge).

import { NextResponse } from "next/server";
import { exportRasterPagesToPdf } from "@/utils/rasterPdfExporter";

interface ExportRequestBody {
  pages: string[];
  title?: string;
  trimSizeId?: string;
}

export async function POST(request: Request) {
  let body: ExportRequestBody;
  try {
    body = (await request.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.pages) || body.pages.some((p) => typeof p !== "string")) {
    return NextResponse.json({ error: "Request body must be { pages: string[] } (data URLs)" }, { status: 400 });
  }

  try {
    const pdfBuffer = await exportRasterPagesToPdf(body.pages, body.title, body.trimSizeId);
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
