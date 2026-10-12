// PDFKit's standard font data, which its browser build needs registered (see
// utils/pdfExport.ts). Newer than @types/pdfkit, which doesn't know it.
declare module "pdfkit/standard-fonts/Helvetica" {
  const font: unknown;
  export default font;
}
