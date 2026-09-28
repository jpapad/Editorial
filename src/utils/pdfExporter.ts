// NODE-ONLY. Imports 'pdfkit', 'svg-to-pdfkit', and 'linkedom' — none of
// which run in a browser. Never import this from a 'use client' component;
// call it from a Next.js Route Handler (Node runtime, not edge) or a
// build/CLI script instead.
//
// Why PDFKit + svg-to-pdfkit instead of jsPDF (used in earlier sprints'
// client-side exporters elsewhere in this project): jsPDF is RGB-only —
// there is no CMYK mode in its API at all, so it can't satisfy this
// sprint's "300 DPI CMYK" requirement no matter how it's used. PDFKit's
// colors are plain arrays — a 3-element array is RGB, a 4-element array is
// CMYK, chosen purely by length — and svg-to-pdfkit exposes a
// colorCallback hook that intercepts every color it resolves, so every
// color (including ones inside imported SVG art) converts to true CMYK on
// the way out, not just the parts drawn directly by this file.
//
// This also fixes a real bug hit in an earlier jsPDF-based exporter: jsPDF
// assembles the whole PDF as one JS string, and a full 52-page book with
// several rasterized images per page overflowed the JS engine's maximum
// string length ("Invalid string length"). PDFKit streams binary output
// instead of building one giant string, and — because svg-to-pdfkit draws
// true vector paths rather than embedding raster PNGs — there's no image
// data to accumulate in the first place.
//
// "300 DPI" in the requirements: with everything rendered as true vector
// (text via PDFKit's native API, all SVG art via svg-to-pdfkit), there's no
// raster content in this pipeline, so DPI doesn't apply in the traditional
// sense — vector output is resolution-independent by definition.
// `settings.exportDpi` is preserved on BookState for the day a raster
// asset (e.g. a scanned illustration) enters the pipeline; that's the
// point at which this file would need to rasterize it at that DPI before
// embedding.

import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { DOMParser } from "linkedom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tracingGridToSvgMarkup } from "@/components/TracingGrid";
import { letterGuideToSvgMarkup } from "@/components/LetterGuide";
import type { BookState, CanvasElement, PageData } from "@/types/book";

const PT_PER_INCH = 72;
const SHAPE_TAGS = new Set(["path", "circle", "rect", "ellipse", "line", "polyline", "polygon"]);

// --- Fonts ---------------------------------------------------------------
//
// PDFKit's 14 standard PDF fonts (Helvetica, Times-Roman, ...) only cover
// WinAnsi/Latin text — trying to render Greek characters through them
// doesn't throw, it silently produces garbage or blank glyphs (found by
// actually rendering a Greek wizard book and looking at the PDF, not by
// inspection — the title text came out as mangled punctuation and the
// LetterGuide/TracingGrid letters were simply missing). Fixed by bundling
// Noto Sans (OFL-licensed, full Latin+Greek coverage in one file) as a
// project asset and registering it as a custom PDFKit font, used for
// everything instead of guessing a standard-font equivalent per
// fontFamily — that guess was never going to work for non-Latin text
// anyway, and using one correct font everywhere is simpler than a
// per-script fallback chain.
const NOTO_SANS_REGULAR = readFileSync(join(process.cwd(), "src/assets/fonts/NotoSans-Regular.ttf"));
const NOTO_SANS_BOLD = readFileSync(join(process.cwd(), "src/assets/fonts/NotoSans-Bold.ttf"));
const FONT_REGULAR = "NotoSans";
const FONT_BOLD = "NotoSans-Bold";

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(FONT_REGULAR, NOTO_SANS_REGULAR);
  doc.registerFont(FONT_BOLD, NOTO_SANS_BOLD);
}

function resolvePdfFont(fontFamily: string): string {
  return fontFamily.toLowerCase().includes("bold") ? FONT_BOLD : FONT_REGULAR;
}

/** Passed to svg-to-pdfkit so generated/imported SVG text also uses the registered Unicode font instead of falling back to Helvetica. */
function svgFontCallback(_family: string, bold: boolean): string {
  return bold ? FONT_BOLD : FONT_REGULAR;
}

// Just the surface this file uses off a linkedom element — avoids pulling
// in linkedom's full (and somewhat unwieldy) internal Element typing.
interface MinimalElement {
  tagName: string;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

// --- Color -------------------------------------------------------------

type RgbColor = [number, number, number];
type CmykColor = [number, number, number, number];

function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full.slice(0, 6), 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToCmyk([r, g, b]: RgbColor): CmykColor {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const k = 1 - Math.max(rf, gf, bf);
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - rf - k) / (1 - k);
  const m = (1 - gf - k) / (1 - k);
  const y = (1 - bf - k) / (1 - k);
  return [c * 100, m * 100, y * 100, k * 100];
}

function hexToCmyk(hex: string): CmykColor {
  return rgbToCmyk(hexToRgb(hex));
}

/** Passed to svg-to-pdfkit so every color it resolves — including colors inside imported SVG art — becomes true CMYK rather than RGB. */
function svgColorCallback(color: [RgbColor, number]): [CmykColor, number] {
  const [rgb, alpha] = color;
  return [rgbToCmyk(rgb), alpha];
}

// --- SVG normalization (Node equivalent of SvgNormalizer.tsx) ------------

/**
 * Node-side equivalent of normalizeToLineArt() in SvgNormalizer.tsx — same
 * transform (transparent fill, uniform black stroke, rounded joins), same
 * viewBox-aware stroke-width compensation — built on linkedom instead of
 * the browser's DOMParser, which doesn't exist in Node. Kept as a separate
 * implementation rather than one shared isomorphic function: the two
 * DOMParser APIs aren't interchangeable imports across a bundler without
 * extra configuration, and the actual logic is small enough (~15 lines)
 * that duplicating it is cheaper than that abstraction would be.
 */
function normalizeSvgForPdf(svgMarkup: string, strokeWidthPt: number, targetWidthIn: number, targetHeightIn: number): string {
  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const root = doc.documentElement;

  const viewBoxAttr = root.getAttribute("viewBox");
  const viewBoxParts = viewBoxAttr ? viewBoxAttr.split(/\s+/).map(Number) : [0, 0, targetWidthIn, targetHeightIn];
  const vbWidth = viewBoxParts[2];
  const vbHeight = viewBoxParts[3];
  const scale = vbWidth > 0 && vbHeight > 0 ? Math.min(targetWidthIn / vbWidth, targetHeightIn / vbHeight) : 1;
  const strokeWidthInSourceUnits = strokeWidthPt / PT_PER_INCH / scale;

  doc.querySelectorAll("*").forEach((el: MinimalElement) => {
    if (!SHAPE_TAGS.has(el.tagName.toLowerCase())) return;
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "#000000");
    el.setAttribute("stroke-width", String(strokeWidthInSourceUnits));
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
    el.removeAttribute("style");
  });

  return root.outerHTML;
}

function embedImportedSvg(doc: PDFKit.PDFDocument, svgMarkup: string, xIn: number, yIn: number, widthIn: number, heightIn: number, strokeWidthPt: number) {
  const normalized = normalizeSvgForPdf(svgMarkup, strokeWidthPt, widthIn, heightIn);
  SVGtoPDF(doc, normalized, xIn * PT_PER_INCH, yIn * PT_PER_INCH, {
    width: widthIn * PT_PER_INCH,
    height: heightIn * PT_PER_INCH,
    preserveAspectRatio: "xMidYMid meet",
    colorCallback: svgColorCallback,
    fontCallback: svgFontCallback,
  });
}

/** For markup built by tracingGridToSvgMarkup()/letterGuideToSvgMarkup() — already clean, only needs color-space conversion, not fill/stroke stripping. */
function embedGeneratedSvg(doc: PDFKit.PDFDocument, svgMarkup: string, xIn: number, yIn: number, widthIn: number, heightIn: number) {
  SVGtoPDF(doc, svgMarkup, xIn * PT_PER_INCH, yIn * PT_PER_INCH, {
    width: widthIn * PT_PER_INCH,
    height: heightIn * PT_PER_INCH,
    preserveAspectRatio: "xMidYMid meet",
    colorCallback: svgColorCallback,
    fontCallback: svgFontCallback,
  });
}

// --- Element drawing -------------------------------------------------------

// KNOWN GAP, pre-existing and not fixed here: neither `element.rotation`
// nor Sprint 6's `element.flipX`/`flipY` are applied anywhere below. The
// screen renderer (TwoPageSpreadEditor) honors both via CSS transforms; a
// rotated or flipped element will currently print upright/unmirrored,
// diverging from its on-screen preview. Fixing it means computing a
// PDFKit transform matrix per element (native `.rotate()`/`.scale()` calls
// around the element's own center for TITLE_TEXT/DOT_TO_DOT, plus passing
// an equivalent SVG `transform` attribute through svg-to-pdfkit for the
// SVG-embedded element types) — real work, left for a dedicated pass
// rather than bolted on here.
function drawElement(doc: PDFKit.PDFDocument, element: CanvasElement, offsetXIn: number, offsetYIn: number) {
  const xIn = element.x + offsetXIn;
  const yIn = element.y + offsetYIn;

  switch (element.type) {
    case "TITLE_TEXT": {
      doc.font(resolvePdfFont(element.fontFamily)).fontSize(element.fontSize).fillColor(hexToCmyk(element.fill));
      doc.text(element.text, xIn * PT_PER_INCH, yIn * PT_PER_INCH, {
        width: element.width * PT_PER_INCH,
        align: element.align,
      });
      break;
    }

    case "DOT_TO_DOT": {
      const black = hexToCmyk("#000000");
      const radiusPt = element.dotRadius * PT_PER_INCH;
      doc.font(FONT_REGULAR);
      element.vertices.forEach((v, i) => {
        const cx = (xIn + v.x) * PT_PER_INCH;
        const cy = (yIn + v.y) * PT_PER_INCH;
        doc.circle(cx, cy, radiusPt).fill(black);
        doc
          .fontSize(radiusPt * 1.6)
          .fillColor(black)
          .text(String(i + 1), cx + radiusPt * 1.8, cy - radiusPt * 0.5);
      });
      break;
    }

    case "TRACING_GRID": {
      const markup = tracingGridToSvgMarkup({
        widthIn: element.width,
        heightIn: element.height,
        letter: element.letter,
        fontFamily: element.fontFamily,
        rows: element.rows,
        repeatsPerRow: element.repeatsPerRow,
        firstInstanceSolid: element.firstInstanceSolid,
      });
      embedGeneratedSvg(doc, markup, xIn, yIn, element.width, element.height);
      break;
    }

    case "LETTER_GUIDE": {
      const markup = letterGuideToSvgMarkup({
        widthIn: element.width,
        heightIn: element.height,
        letter: element.letter,
        fontFamily: element.fontFamily,
        guideStyle: element.guideStyle,
        strokeArrows: element.strokeArrows,
      });
      embedGeneratedSvg(doc, markup, xIn, yIn, element.width, element.height);
      break;
    }

    case "SVG_MAIN_ART": {
      embedImportedSvg(doc, element.svgMarkup, xIn, yIn, element.width, element.height, element.strokeWidth);
      break;
    }

    case "SVG_MINI_GROUP": {
      for (const item of element.items) {
        embedImportedSvg(doc, item.svgMarkup, xIn + item.x, yIn + item.y, item.width, item.height, element.strokeWidth);
      }
      break;
    }
  }
}

function drawPage(doc: PDFKit.PDFDocument, page: PageData, offsetXIn: number, offsetYIn: number) {
  if (page.backgroundColor) {
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(hexToCmyk(page.backgroundColor));
  }
  for (const element of page.elements) {
    drawElement(doc, element, offsetXIn, offsetYIn);
  }
}

// --- Entry point -----------------------------------------------------------

/**
 * Converts a BookState into a print-ready, fully-vector, fully-CMYK PDF.
 * One physical spread = two consecutive pages in the output (left, then
 * right), in reading order. Each page is sized `trimWidth + bleed` ×
 * `trimHeight + 2*bleed` — bleed only applies to the top, bottom, and
 * outer edge; the gutter (inner, spine-side) edge never bleeds, since it's
 * bound into the spine rather than cut. (Confirm current KDP guidance
 * before a real submission — this implements the general print
 * convention, not a live spec fetch.)
 */
export async function exportBookToPdf(book: BookState): Promise<Buffer> {
  const { settings } = book;
  const pageWidthPt = (settings.trimWidthIn + settings.bleedIn) * PT_PER_INCH;
  const pageHeightPt = (settings.trimHeightIn + settings.bleedIn * 2) * PT_PER_INCH;

  const doc = new PDFDocument({
    size: [pageWidthPt, pageHeightPt],
    margin: 0,
    autoFirstPage: false,
    info: book.author ? { Title: book.title, Author: book.author } : { Title: book.title },
  });
  registerFonts(doc);

  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  for (const spread of book.spreads) {
    for (const side of ["left", "right"] as const) {
      const page = side === "left" ? spread.leftPage : spread.rightPage;
      doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });

      const offsetXIn = side === "left" ? settings.bleedIn : 0;
      const offsetYIn = settings.bleedIn;

      drawPage(doc, page, offsetXIn, offsetYIn);
    }
  }

  doc.end();
  return finished;
}
