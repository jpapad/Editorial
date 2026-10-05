// Small, stateless helpers for the editor (EditorShell): sizes, names,
// image crops, cover guides, page renumbering.

import type { TFunction } from "@/lib/i18n";
import type { GuideSpec } from "@/components/editor/CanvasEditor";
import { supabase } from "@/lib/supabase/client";
import { coverSafeAreas, type CoverLayout } from "@/utils/coverGeometry";
import { syncPageNumbers } from "@/utils/pageNumbers";
import type { BookPage } from "@/types/editor";

const DEFAULT_STAMP_SIZE = 120;
const MAX_STAMP_DIMENSION = 220;

/** Resolves after the browser has painted twice — the canvas shows the latest state. */
export function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** A new stamp's size on the page: its own proportions, no bigger than MAX_STAMP_DIMENSION. */
export function computeStampDimensions(naturalSize?: { width: number; height: number }) {
  if (!naturalSize || !naturalSize.width || !naturalSize.height) {
    return { width: DEFAULT_STAMP_SIZE, height: DEFAULT_STAMP_SIZE };
  }
  const scale = Math.min(MAX_STAMP_DIMENSION / naturalSize.width, MAX_STAMP_DIMENSION / naturalSize.height, 1);
  return { width: naturalSize.width * scale, height: naturalSize.height * scale };
}

/** A file name from a book title. */
export function slugify(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "coloring-book-project";
}

/** Cuts `crop` (canvas pixels) out of a PNG data URL — the bleed band off a page picture. */
export async function cropImage(src: string, crop: { x: number; y: number; width: number; height: number }): Promise<string> {
  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("unreadable"));
    img.src = src;
  });
  if (crop.x === 0 && crop.y === 0 && crop.width >= img.naturalWidth && crop.height >= img.naturalHeight) return src;
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  canvas.getContext("2d")?.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return canvas.toDataURL("image/png");
}

/** The cover's on-canvas guides: trim, safe areas, spine folds, the barcode box and panel labels. */
export function coverGuides(layout: CoverLayout, t: TFunction): GuideSpec {
  const { back, spineRect, front } = layout;
  const label = (x: number, text: string) => ({ x: x + 6, y: back.top + 6, text, color: "#3357d4" });
  return {
    trim: layout.trim,
    safe: coverSafeAreas(layout),
    folds: [
      [spineRect.left, 0, spineRect.left, layout.space.height],
      [spineRect.right, 0, spineRect.right, layout.space.height],
    ],
    blocked: [layout.barcode],
    labels: [label(back.left, t("BACK COVER")), label(front.left, t("FRONT COVER"))],
  };
}

/** Counts an export for the admin statistics. Fire-and-forget: never blocks or fails an export (e.g. before the usage migration exists). */
export function logExport(kind: "export_pdf" | "export_cover") {
  void supabase.rpc("log_export", { export_kind: kind }).then(() => undefined);
}

/** Page numbers follow array order — re-stamp them after any structural change. */
export function renumber(pages: BookPage[]): BookPage[] {
  return syncPageNumbers(pages.map((p, i) => (p.pageNumber === i + 1 ? p : { ...p, pageNumber: i + 1 })));
}
