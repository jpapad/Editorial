"use client";

import { useEffect, useMemo, useState } from "react";
import { lookAlikes, lookOf, offStyle, type PageLook } from "@/utils/pageLooks";
import type { BookPage } from "@/types/editor";

const cache = new Map<string, PageLook>();
const SIZE = 136;

async function analyse(src: string): Promise<PageLook> {
  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("unreadable thumbnail"));
    img.src = src;
  });
  const k = SIZE / Math.max(img.naturalWidth, img.naturalHeight, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return lookOf({ width: pixels.width, height: pixels.height, data: pixels.data });
}

/**
 * Look-alike and off-style pages, from the pages' preview thumbnails (so
 * only pages that have one — a page gets its thumbnail when you leave it,
 * preview the book or export). Empty until the thumbnails are analysed.
 */
export function usePageLooks(pages: BookPage[]): { similar: string[]; offStyle: string[] } {
  const [version, setVersion] = useState(0);
  const key = pages.map((p) => (p.thumbnailDataUrl ? `${p.id}:${p.thumbnailDataUrl.length}` : "")).join("|");

  useEffect(() => {
    let alive = true;
    const todo = pages.filter((p) => p.thumbnailDataUrl && !p.isBlankBack && !cache.has(p.thumbnailDataUrl));
    if (todo.length === 0) return;
    void Promise.all(
      todo.map(async (p) => {
        try {
          cache.set(p.thumbnailDataUrl!, await analyse(p.thumbnailDataUrl!));
        } catch {
          // No look for this page — it's simply left out.
        }
      })
    ).then(() => alive && setVersion((v) => v + 1));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the pages' thumbnails
  }, [key]);

  return useMemo(() => {
    const looks = pages.flatMap((p) => {
      const look = p.thumbnailDataUrl && !p.isBlankBack ? cache.get(p.thumbnailDataUrl) : undefined;
      return look ? [{ id: p.id, look }] : [];
    });
    return { similar: lookAlikes(looks), offStyle: offStyle(looks) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed when thumbnails or the analysed set change
  }, [key, version]);
}
