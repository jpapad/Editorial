"use client";

import { aiErrorText, type TFunction } from "@/lib/i18n";
import type { ImageSize } from "@/utils/imagePages";
import { autoVectorizeOn, vectorizeImageSrc } from "@/lib/vectorizeImage";

/** Natural size of an image URL (data: URLs included). */
export function imageSize(src: string): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 });
    img.onerror = () => reject(new Error("Could not read the generated image"));
    img.src = src;
  });
}

/**
 * One AI line-art picture for a page (one credit). Throws a translated,
 * user-facing message on failure (limit reached, signed out, provider error).
 */
export interface CharacterOptions {
  /** A detailed description of the book's recurring character. */
  character?: string;
  /** A picture of the character (PNG data URL, see toPngDataUrl) to draw every page from. */
  characterRef?: string;
}

export async function generateLineArtPicture(subject: string, theme: string | undefined, t: TFunction, options: CharacterOptions = {}): Promise<{ src: string; size: ImageSize }> {
  const response = await fetch("/api/generate-line-art", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, theme: theme?.trim() || undefined, count: 1, aspectRatio: "portrait", character: options.character?.trim() || undefined, characterRef: options.characterRef }),
  });
  const body = (await response.json().catch(() => null)) as { results?: { ok: boolean; svgMarkup?: string; error?: string }[]; error?: string } | null;
  const first = body?.results?.[0];
  if (!response.ok || !first?.ok || !first.svgMarkup) throw new Error(aiErrorText(t, response.status, first?.error ?? body?.error ?? `HTTP ${response.status}`));
  const raster = `data:image/svg+xml;utf8,${encodeURIComponent(first.svgMarkup)}`;
  const src = await sharpen(raster);
  return { src, size: await imageSize(src) };
}

/**
 * AI pictures arrive as pixels; traced to vector they print crisp at any
 * size and the faint-line check can see them. Kept as pixels when the
 * user turned that off or the picture has nothing to trace.
 */
export async function sharpen(src: string): Promise<string> {
  if (!autoVectorizeOn()) return src;
  return (await vectorizeImageSrc(src))?.src ?? src;
}

/**
 * Any picture (SVG data URLs included) as a PNG data URL on white, at most
 * `maxSide` px — the form the image API takes as a character reference.
 */
export async function toPngDataUrl(src: string, maxSide = 1024): Promise<string | null> {
  try {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("unreadable"));
      img.src = src;
    });
    const w = img.naturalWidth || 1024;
    const h = img.naturalHeight || 1024;
    const k = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
