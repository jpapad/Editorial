// svg-to-pdfkit ships no type declarations of its own — this covers just
// the surface this project actually uses (see source.js / README.md in
// node_modules/svg-to-pdfkit for the full option set).
declare module "svg-to-pdfkit" {
  type RgbColor = [number, number, number];
  type CmykColor = [number, number, number, number];

  interface SVGtoPDFOptions {
    width?: number;
    height?: number;
    preserveAspectRatio?: string;
    useCSS?: boolean;
    assumePt?: boolean;
    precision?: number;
    /**
     * Intercepts every color the library resolves — always called with an
     * RGB triplet (that's what its internal SVG color parser produces).
     * Returning a 4-element array here makes PDFKit treat the result as
     * CMYK instead of RGB (PDFKit picks the color space by array length).
     */
    colorCallback?: (color: [RgbColor, number], raw?: string) => [RgbColor | CmykColor, number];
    fontCallback?: (family: string, bold: boolean, italic: boolean) => string;
    warningCallback?: (message: string) => void;
  }

  function SVGtoPDF(doc: PDFKit.PDFDocument, svg: string, x?: number, y?: number, options?: SVGtoPDFOptions): void;

  export = SVGtoPDF;
}
