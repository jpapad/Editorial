// Verification aid, not a feature in its own right — pdfExporter.ts is
// Node-only (pdfkit/svg-to-pdfkit/linkedom) and can't be exercised from a
// browser component, so this Route Handler is the realistic integration
// point: it's exactly what a real "Export Book to PDF" button would call
// (a fetch() to this route), just wired to fixed sample data instead of
// real app state for now. Route Handlers run in the Node runtime by
// default, which is required here — do not add `export const runtime =
// "edge"`.

import { NextResponse } from "next/server";
import { exportBookToPdf } from "@/utils/pdfExporter";
import { DEFAULT_BOOK_SETTINGS } from "@/types/book";
import type { BookState } from "@/types/book";

const JELLYFISH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <ellipse cx="100" cy="80" rx="55" ry="45" fill="teal" stroke="teal" stroke-width="4" />
  <circle cx="82" cy="72" r="6" fill="black" />
  <circle cx="118" cy="72" r="6" fill="black" />
  <path d="M60 105 Q40 140 55 170" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M85 112 Q75 150 85 175" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M115 112 Q125 150 115 175" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M140 105 Q160 140 145 170" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
</svg>`.trim();

const book: BookState = {
  id: "export-test-book",
  title: "Export Test Book",
  settings: DEFAULT_BOOK_SETTINGS,
  spreads: [
    {
      id: "spread-1",
      spreadNumber: 1,
      leftPage: {
        id: "page-left",
        elements: [
          {
            id: "title",
            type: "TITLE_TEXT",
            x: 0.25,
            y: 0.35,
            width: 7.875,
            height: 0.6,
            rotation: 0,
            text: "J is for Jellyfish",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 28,
            align: "center",
            fill: "#000000",
          },
          {
            id: "main-art",
            type: "SVG_MAIN_ART",
            x: 1.5,
            y: 1.5,
            width: 5.5,
            height: 5.5,
            rotation: 0,
            svgMarkup: JELLYFISH_SVG, // deliberately colored (teal) -> proves normalizeSvgForPdf + the CMYK colorCallback both actually ran
            strokeWidth: 3,
          },
        ],
      },
      rightPage: {
        id: "page-right",
        elements: [
          {
            id: "letter-guide",
            type: "LETTER_GUIDE",
            x: 2.75,
            y: 0.5,
            width: 3,
            height: 2.8,
            rotation: 0,
            letter: "J",
            fontFamily: "Arial, Helvetica, sans-serif",
            guideStyle: "hollow",
            strokeArrows: [
              { order: 1, x: 1.5, y: 0.25, rotation: 0 },
              { order: 2, x: 0.75, y: 2.4, rotation: -70 },
            ],
          },
          {
            id: "tracing-grid",
            type: "TRACING_GRID",
            x: 0.75,
            y: 3.5,
            width: 6.5,
            height: 2.7,
            rotation: 0,
            letter: "J j",
            fontFamily: "Arial, Helvetica, sans-serif",
            rows: 3,
            repeatsPerRow: 5,
            firstInstanceSolid: true,
          },
          {
            id: "dot-to-dot",
            type: "DOT_TO_DOT",
            x: 0.75,
            y: 6.5,
            width: 3,
            height: 2,
            rotation: 0,
            dotRadius: 0.05,
            showPreviewPath: false,
            vertices: [
              { x: 1.5, y: 0.15 },
              { x: 2.25, y: 0.65 },
              { x: 1.95, y: 1.55 },
              { x: 1.05, y: 1.55 },
              { x: 0.75, y: 0.65 },
            ],
          },
        ],
      },
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

export async function GET() {
  const pdfBuffer = await exportBookToPdf(book);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="export-test.pdf"',
    },
  });
}
