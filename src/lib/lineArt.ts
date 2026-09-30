"use client";

import { aiErrorText, type TFunction } from "@/lib/i18n";
import type { ImageSize } from "@/utils/imagePages";

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
export async function generateLineArtPicture(subject: string, theme: string | undefined, t: TFunction): Promise<{ src: string; size: ImageSize }> {
  const response = await fetch("/api/generate-line-art", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, theme: theme?.trim() || undefined, count: 1, aspectRatio: "portrait" }),
  });
  const body = (await response.json().catch(() => null)) as { results?: { ok: boolean; svgMarkup?: string; error?: string }[]; error?: string } | null;
  const first = body?.results?.[0];
  if (!response.ok || !first?.ok || !first.svgMarkup) throw new Error(aiErrorText(t, response.status, first?.error ?? body?.error ?? `HTTP ${response.status}`));
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(first.svgMarkup)}`;
  return { src, size: await imageSize(src) };
}
