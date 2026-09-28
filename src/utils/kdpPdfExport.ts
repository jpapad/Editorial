import jsPDF from "jspdf";
import { normalizeSvgToLineArt } from "@/components/kdp-editor/SvgNormalizer";
import { tracingGridToSvgMarkup } from "@/components/kdp-editor/TracingGrid";
import { letterGuideToSvgMarkup } from "@/components/kdp-editor/LetterGuide";
import { countingActivityToSvgMarkup } from "@/components/kdp-editor/CountingActivity";
import { ptToInches, requiredRasterPx } from "@/lib/kdpPrintSpec";
import { calculateCoverDimensions } from "@/lib/coverSpec";
import type { BookState, CanvasElement, CoverState, KdpPrintSpec, PageContent } from "@/types/kdpBook";

/**
 * PDF export architecture
 * ========================
 * One physical spread = two consecutive pages in the output PDF (left page,
 * then right page), in reading order across the whole book.
 *
 * Bleed: interior pages only bleed on the edges that reach a trimmed edge
 * of the book — top, bottom, and the OUTER edge; the inner (gutter) edge
 * never bleeds. Each PDF page is `trimWidth + bleed` × `trimHeight +
 * 2*bleed`. (Confirm current KDP guidance before a real submission — this
 * implements the general print convention, not a live spec fetch.)
 *
 * Color: jsPDF only emits RGB. KDP explicitly accepts RGB interior files
 * (converting internally); CMYK is their *preference*, not a requirement.
 * True CMYK vector output isn't available in a browser at all — it needs a
 * Node-side pipeline (see "Upgrading" below).
 *
 * Vector vs. raster: TITLE_TEXT, DOT_TO_DOT, and WORD_SEARCH are drawn with
 * jsPDF's own vector primitives (true vector, tiny file size — none of them
 * need anything jsPDF's fill-only text/line drawing can't reproduce
 * exactly). SVG_MAIN_ART, SVG_MINI_GROUP, TRACING_GRID, LETTER_GUIDE,
 * COLOR_BY_NUMBER's outline, and COUNTING_ACTIVITY are rasterized to a
 * 300 DPI PNG instead: line art needs to preserve arbitrary imported paths,
 * and the dashed/dotted tracing styles have no equivalent in jsPDF's
 * fill-only text API. Rasterizing the exact same markup the editor
 * previews (via each component's companion *ToSvgMarkup function)
 * guarantees the PDF matches what the author saw.
 *
 * Upgrading to CMYK / fully-vector art later:
 *  1. Fully vector: swap the rasterize-and-addImage step for `svg2pdf.js`,
 *     which converts real SVG DOM into native PDF vector operators
 *     (including dash arrays on text) — a small added dependency.
 *  2. True CMYK: move export to a Node runtime (a Route Handler or build
 *     script) using PDFKit, which supports `.fillColor([c,m,y,k], "cmyk")`
 *     directly. This book's line art is essentially pure black (K-only),
 *     so the color conversion is trivial — the remaining work is porting
 *     the drawing calls below from jsPDF's API to PDFKit's (conceptually
 *     similar: moveTo/lineTo/text/image).
 */

export async function exportBookToPdf(book: BookState): Promise<void> {
  const { printSpec } = book;
  const pageWidthIn = printSpec.trimWidthIn + printSpec.bleedIn;
  const pageHeightIn = printSpec.trimHeightIn + printSpec.bleedIn * 2;

  const doc = new jsPDF({ orientation: "portrait", unit: "in", format: [pageWidthIn, pageHeightIn] });
  let isFirstPage = true;

  for (const spread of book.spreads) {
    for (const side of ["left", "right"] as const) {
      const page = side === "left" ? spread.leftPage : spread.rightPage;

      if (!isFirstPage) doc.addPage([pageWidthIn, pageHeightIn], "portrait");
      isFirstPage = false;

      const offsetX = side === "left" ? printSpec.bleedIn : 0;
      const offsetY = printSpec.bleedIn;

      await drawPage(doc, page, offsetX, offsetY, printSpec.dpi);
    }
  }

  doc.save(`${slugify(book.title)}.pdf`);
}

/** Exports the wraparound cover (back + spine + front) as a single-page PDF sized to the true full-bleed cover dimensions. */
export async function exportCoverToPdf(cover: CoverState, printSpec: KdpPrintSpec): Promise<void> {
  const dims = calculateCoverDimensions(printSpec, cover.spec);
  const doc = new jsPDF({ orientation: "landscape", unit: "in", format: [dims.fullBleedWidthIn, dims.fullBleedHeightIn] });

  doc.setFillColor(cover.spec.backCoverColor);
  doc.rect(0, 0, dims.spineX, dims.fullBleedHeightIn, "F");
  doc.setFillColor(cover.spec.spineColor);
  doc.rect(dims.spineX, 0, dims.spineWidthIn, dims.fullBleedHeightIn, "F");
  doc.setFillColor(cover.spec.frontCoverColor);
  doc.rect(dims.frontCoverX, 0, dims.fullBleedWidthIn - dims.frontCoverX, dims.fullBleedHeightIn, "F");

  for (const element of cover.elements) {
    if (element.kind === "text") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(element.fontSize);
      doc.setTextColor(element.fill);
      const textX = element.align === "center" ? element.x + element.width / 2 : element.align === "right" ? element.x + element.width : element.x;
      doc.text(element.text, textX, element.y + ptToInches(element.fontSize), { align: element.align });
    } else {
      const markup = normalizeSvgToLineArt(element.svgMarkup, {
        strokeWeightPt: element.strokeWeight,
        targetWidthIn: element.width,
        targetHeightIn: element.height,
      });
      await embedRasterizedSvg(doc, markup, element.x, element.y, element.width, element.height, printSpec.dpi);
    }
  }

  doc.save(`${slugify("cover")}.pdf`);
}

async function drawPage(doc: jsPDF, page: PageContent, offsetX: number, offsetY: number, dpi: number) {
  const pageWidthIn = doc.internal.pageSize.getWidth();
  const pageHeightIn = doc.internal.pageSize.getHeight();

  if (page.backgroundColor) {
    doc.setFillColor(page.backgroundColor);
    doc.rect(0, 0, pageWidthIn, pageHeightIn, "F");
  }

  for (const element of page.elements) {
    await drawElement(doc, element, offsetX, offsetY, dpi);
  }
}

async function drawElement(doc: jsPDF, element: CanvasElement, offsetX: number, offsetY: number, dpi: number) {
  const x = element.x + offsetX;
  const y = element.y + offsetY;

  switch (element.type) {
    case "TITLE_TEXT": {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(element.fontSize);
      doc.setTextColor(element.fill);
      const textX = element.align === "center" ? x + element.width / 2 : element.align === "right" ? x + element.width : x;
      doc.text(element.text, textX, y + ptToInches(element.fontSize), { align: element.align });
      break;
    }

    case "DOT_TO_DOT": {
      doc.setFillColor("#111827");
      doc.setTextColor("#111827");
      doc.setFontSize(element.dotRadius * 72 * 3.2);
      for (const [i, v] of element.vertices.entries()) {
        doc.circle(x + v.x, y + v.y, element.dotRadius, "F");
        doc.text(String(i + 1), x + v.x + element.dotRadius * 1.8, y + v.y + element.dotRadius * 0.6);
      }
      break;
    }

    case "WORD_SEARCH": {
      // Pure fills/lines — jsPDF reproduces this exactly, no rasterization needed.
      const gridSize = element.grid.length;
      const wordListHeight = element.height * 0.18;
      const gridHeight = element.height - wordListHeight;
      const cell = Math.min(element.width / gridSize, gridHeight / gridSize);
      const gridPxWidth = cell * gridSize;
      const gridOffsetX = (element.width - gridPxWidth) / 2;
      const fontSize = cell * 0.55 * 72;

      doc.setDrawColor("#cbd5e1");
      doc.setLineWidth(0.008);
      for (let i = 0; i <= gridSize; i++) {
        doc.line(x + gridOffsetX + i * cell, y, x + gridOffsetX + i * cell, y + gridPxWidth);
        doc.line(x + gridOffsetX, y + i * cell, x + gridOffsetX + gridPxWidth, y + i * cell);
      }
      doc.setFontSize(fontSize);
      doc.setTextColor("#111827");
      doc.setFont("helvetica", "normal");
      element.grid.forEach((row, r) =>
        row.forEach((letter, c) =>
          doc.text(letter, x + gridOffsetX + c * cell + cell / 2, y + r * cell + cell / 2 + ptToInches(fontSize) * 0.35, { align: "center" })
        )
      );
      doc.setFontSize(wordListHeight * 0.22 * 72);
      doc.setFont("helvetica", "bold");
      doc.text("Find these words:", x, y + gridPxWidth + wordListHeight * 0.35);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(wordListHeight * 0.2 * 72);
      doc.text(element.words.map((w) => w.toUpperCase()).join("   •   "), x, y + gridPxWidth + wordListHeight * 0.7);
      break;
    }

    case "TRACING_GRID": {
      const markup = tracingGridToSvgMarkup(element);
      await embedRasterizedSvg(doc, markup, x, y, element.width, element.height, dpi);
      break;
    }

    case "LETTER_GUIDE": {
      const markup = letterGuideToSvgMarkup(element);
      await embedRasterizedSvg(doc, markup, x, y, element.width, element.height, dpi);
      break;
    }

    case "SVG_MAIN_ART": {
      const markup = normalizeSvgToLineArt(element.svgMarkup, {
        strokeWeightPt: element.strokeWeight,
        targetWidthIn: element.width,
        targetHeightIn: element.height,
      });
      await embedRasterizedSvg(doc, markup, x, y, element.width, element.height, dpi);
      break;
    }

    case "SVG_MINI_GROUP": {
      for (const item of element.items) {
        const markup = normalizeSvgToLineArt(item.svgMarkup, {
          strokeWeightPt: element.strokeWeight,
          targetWidthIn: item.width,
          targetHeightIn: item.height,
        });
        await embedRasterizedSvg(doc, markup, x + item.x, y + item.y, item.width, item.height, dpi);
      }
      break;
    }

    case "COLOR_BY_NUMBER": {
      const keyHeight = element.showColorKey ? 0.6 : 0;
      const artHeight = element.height - keyHeight;
      const markup = normalizeSvgToLineArt(element.outlineSvgMarkup, {
        strokeWeightPt: 1.5,
        targetWidthIn: element.width,
        targetHeightIn: artHeight,
      });
      await embedRasterizedSvg(doc, markup, x, y, element.width, artHeight, dpi);

      doc.setFontSize(0.13 * 72);
      doc.setFont("helvetica", "bold");
      for (const zone of element.zones) {
        doc.setFillColor("#ffffff");
        doc.setDrawColor("#111827");
        doc.circle(x + zone.labelX, y + zone.labelY, 0.09, "FD");
        doc.setTextColor("#111827");
        doc.text(String(zone.number), x + zone.labelX, y + zone.labelY + 0.03, { align: "center" });
      }
      if (element.showColorKey) {
        element.zones.forEach((zone, i) => {
          const cx = x + 0.3 + i * 0.9;
          const cy = y + artHeight + 0.12;
          doc.setFillColor(zone.colorHex);
          doc.setDrawColor("#111827");
          doc.rect(cx, cy, 0.3, 0.3, "FD");
          doc.setFont("helvetica", "normal");
          doc.setTextColor("#111827");
          doc.text(String(zone.number), cx + 0.4, cy + 0.22);
        });
      }
      break;
    }

    case "COUNTING_ACTIVITY": {
      const iconSize = Math.min(...element.groups.map((g) => g.height * (element.showAnswerBox ? 0.7 : 1)));
      const cleanedByGroupId = new Map<string, string>();
      for (const group of element.groups) {
        cleanedByGroupId.set(
          group.id,
          normalizeSvgToLineArt(group.iconSvgMarkup, { targetWidthIn: iconSize, targetHeightIn: iconSize, strokeWeightPt: 2.5 })
        );
      }
      const markup = countingActivityToSvgMarkup(element.width, element.height, element.groups, cleanedByGroupId, element.showAnswerBox);
      await embedRasterizedSvg(doc, markup, x, y, element.width, element.height, dpi);
      break;
    }

    case "MAZE_GRID": {
      doc.setDrawColor("#cbd5e1");
      doc.rect(x, y, element.width, element.height);
      doc.setFontSize(9);
      doc.setTextColor("#94a3b8");
      doc.text("Maze not implemented", x + 0.1, y + 0.25);
      break;
    }
  }
}

/**
 * jsPDF assembles the whole document as one JS string internally (it's a
 * pure client-side, non-streaming implementation) — a multi-page book with
 * several full-300-DPI raster images per page pushes that string past the
 * JS engine's maximum string length and doc.save() throws "Invalid string
 * length" (found empirically exporting a 52-page book: every page
 * rasterized fine individually, but the final assembly failed). Capping
 * the *rasterization* DPI keeps a full book's output tractable; the source
 * data itself still records the true printSpec.dpi. This is exactly the
 * ceiling the "Upgrading" note above describes — a real production system
 * needs the svg2pdf.js vector path to avoid rasterizing at all.
 */
const MAX_EXPORT_RASTER_DPI = 150;

/** Rasterizes an SVG string to a PNG (browser Canvas) and embeds it as a vector page's image content. */
async function embedRasterizedSvg(doc: jsPDF, svgMarkup: string, x: number, y: number, widthIn: number, heightIn: number, dpi: number) {
  const { width: pxW, height: pxH } = requiredRasterPx(widthIn, heightIn, Math.min(dpi, MAX_EXPORT_RASTER_DPI));
  const dataUrl = await rasterizeSvgToDataUrl(svgMarkup, pxW, pxH);
  doc.addImage(dataUrl, "PNG", x, y, widthIn, heightIn);
}

function rasterizeSvgToDataUrl(svgMarkup: string, widthPx: number, heightPx: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to rasterize SVG element for export"));
    };
    img.src = url;
  });
}

function slugify(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "coloring-tracing-book";
}
