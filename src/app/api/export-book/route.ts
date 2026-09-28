// The real integration point for a live "Export to PDF" button: accepts a
// BookState as JSON and returns the rendered PDF. Route Handlers run in
// the Node runtime by default, which is required here — do not add
// `export const runtime = "edge"` (pdfExporter.ts needs Node's pdfkit /
// linkedom, neither of which exist on the edge runtime).

import { NextResponse } from "next/server";
import { exportBookToPdf } from "@/utils/pdfExporter";
import type { BookState } from "@/types/book";

export async function POST(request: Request) {
  let book: BookState;
  try {
    book = (await request.json()) as BookState;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!book || !Array.isArray(book.spreads) || !book.settings) {
    return NextResponse.json({ error: "Request body must be a BookState (id, title, settings, spreads)" }, { status: 400 });
  }

  try {
    const pdfBuffer = await exportBookToPdf(book);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${book.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "book"}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF export failed" }, { status: 500 });
  }
}
