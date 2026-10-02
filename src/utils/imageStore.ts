// Pictures out of the saved book: big embedded images (data: URLs) are
// uploaded to Storage once and the book keeps a short link instead
// (sql/07_image_storage.sql). A 40-page book of AI pictures is tens of
// megabytes embedded; with links it is a few kilobytes, so autosave stays
// quick.
//
// The swap happens only on the copy that is saved — the editor keeps
// working with what it has. And it is all-or-nothing safe: anything that
// can't be uploaded simply stays embedded, exactly as before.

import type { BookPage, CoverDesign } from "@/types/editor";

/** Smaller pictures (icons, tiny SVGs) aren't worth a file of their own. */
export const MIN_UPLOAD_CHARS = 12_000;

/** Uploads one picture, returning its public link — or null to leave it embedded. */
export type Uploader = (dataUrl: string) => Promise<string | null>;

const worthUploading = (src: string | undefined): src is string => typeof src === "string" && src.startsWith("data:image/") && src.length >= MIN_UPLOAD_CHARS;

/** Every embedded picture in these pages that should become a link (each once). */
export function embeddedImages(pages: BookPage[]): string[] {
  const found = new Set<string>();
  for (const page of pages) {
    for (const o of page.objects) if (o.kind === "stamp" && worthUploading(o.src)) found.add(o.src);
    if (worthUploading(page.traceImage?.src)) found.add(page.traceImage.src);
  }
  return [...found];
}

/** The pages with each picture swapped for its link, where one is known. Pages without a swap keep their identity. */
export function withLinks(pages: BookPage[], links: Map<string, string>): BookPage[] {
  if (links.size === 0) return pages;
  return pages.map((page) => {
    let changed = false;
    const objects = page.objects.map((o) => {
      const link = o.kind === "stamp" ? links.get(o.src) : undefined;
      if (!link) return o;
      changed = true;
      return { ...o, src: link };
    });
    const traceLink = page.traceImage ? links.get(page.traceImage.src) : undefined;
    if (traceLink) changed = true;
    return changed ? { ...page, objects, ...(traceLink ? { traceImage: { ...page.traceImage!, src: traceLink } } : {}) } : page;
  });
}

/**
 * The book as it should be saved: pictures uploaded (those not uploaded
 * before — `known` remembers across calls) and replaced by links.
 */
export async function externalize(pages: BookPage[], cover: CoverDesign | null | undefined, upload: Uploader, known: Map<string, string>): Promise<{ pages: BookPage[]; cover: CoverDesign | null | undefined }> {
  const all = cover ? [...pages, cover.page] : pages;
  for (const src of embeddedImages(all)) {
    if (known.has(src)) continue;
    try {
      const link = await upload(src);
      if (link) known.set(src, link);
    } catch {
      // Stays embedded this time.
    }
  }
  return { pages: withLinks(pages, known), cover: cover ? { ...cover, page: withLinks([cover.page], known)[0] } : cover };
}

/** "data:image/png;base64,AAAA" → its bytes and type. Null for anything else. */
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/[a-z0-9.+-]+)((?:;[^;,]+)*?)(;base64)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) return null;
  const [, mime, , base64, body] = match;
  if (base64) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mime: mime.toLowerCase(), bytes };
  }
  return { mime: mime.toLowerCase(), bytes: new TextEncoder().encode(decodeURIComponent(body)) };
}

export const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
