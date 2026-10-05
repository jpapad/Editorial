// The "digital download" pack: everything a seller uploads to Etsy (or
// Gumroad, Payhip…) for a printable coloring book, in one ZIP — one PNG per
// page, a printable PDF per paper size, and the license / how-to-print
// notes buyers expect to find next to the files.

import type { PageSpace } from "@/types/editor";
import type { SheetId } from "@/utils/printables";

export type LicenseKind = "personal" | "classroom" | "commercial";

export interface PackOptions {
  pngs: boolean;
  sheets: SheetId[];
  license: LicenseKind;
  /** Shop or author name for the license text; may be empty. */
  seller: string;
}

export const LICENSES: { value: LicenseKind; label: string; hint: string }[] = [
  { value: "personal", label: "Personal use", hint: "Print at home for your own family." },
  { value: "classroom", label: "Classroom use", hint: "A teacher may print copies for their own class." },
  { value: "commercial", label: "Commercial use", hint: "Buyers may sell printed copies, not the files." },
];

type T = (key: string, vars?: Record<string, string | number>) => string;

/** The license text, in the UI language. Plain text: it opens anywhere. */
export function licenseText(kind: LicenseKind, title: string, seller: string, year: number, t: T): string {
  const owner = seller.trim() || t("the seller");
  const rights: Record<LicenseKind, string[]> = {
    personal: [t("You may print these pages as many times as you like for yourself and your family.")],
    classroom: [
      t("You may print these pages as many times as you like for yourself and your family."),
      t("A teacher may print copies for the children in their own class or group."),
    ],
    commercial: [
      t("You may print these pages as many times as you like for yourself and your family."),
      t("You may sell or give away printed copies (on paper), up to 500 copies in total."),
    ],
  };
  const lines = [
    `${title}`,
    `© ${year} ${owner}`,
    "",
    t("License: {name}", { name: t(LICENSES.find((l) => l.value === kind)!.label) }),
    "",
    t("You may:"),
    ...rights[kind].map((r) => `  • ${r}`),
    "",
    t("You may not:"),
    `  • ${t("Share, resell or upload the digital files (PNG or PDF), in whole or in part.")}`,
    `  • ${t("Claim the artwork as your own or use it in other products for sale.")}`,
    "",
    t("Thank you for your purchase!"),
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Short "start here" notes for buyers. */
export function readmeText(title: string, options: PackOptions, pageCount: number, t: T): string {
  const sheetLabel: Record<SheetId, string> = { a4: "A4", letter: "US Letter" };
  const lines = [
    title,
    "",
    t("What's inside"),
    ...(options.sheets.length ? options.sheets.map((s) => `  • ${t("A printable PDF for {size} paper ({n} pages)", { size: sheetLabel[s], n: pageCount })}`) : []),
    ...(options.pngs ? [`  • ${t("Every page as a separate picture (PNG, 300 DPI) in the “pages” folder")}`] : []),
    `  • ${t("LICENSE.txt: what you may do with these pages")}`,
    "",
    t("How to print"),
    `  1. ${t("Open the PDF for your paper size.")}`,
    `  2. ${t("In the print window choose “Actual size” or 100% — not “Fit to page”.")}`,
    `  3. ${t("Print single-sided, so colors don't show through.")}`,
    `  4. ${t("Thicker paper (120 g or more) works best with markers.")}`,
  ];
  return lines.join("\r\n") + "\r\n";
}

/** A file-system-safe folder/file stem from the book title. */
export function packStem(title: string): string {
  const stem = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
  return stem || "coloring-book";
}

/** The page's trim area in canvas pixels at `pixelRatio` (the part a PNG keeps: bleed is for the printer's cutter only). */
export function trimCrop(space: PageSpace, pixelRatio: number): { x: number; y: number; width: number; height: number } {
  const b = space.bleed * pixelRatio;
  return {
    x: Math.round(b),
    y: Math.round(b),
    width: Math.round((space.width - space.bleed * 2) * pixelRatio),
    height: Math.round((space.height - space.bleed * 2) * pixelRatio),
  };
}
