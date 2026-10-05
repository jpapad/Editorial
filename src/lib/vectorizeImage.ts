"use client";

import { vectorize } from "@/components/studio/editor/vectorize";

/**
 * Traces a picture (any URL the browser can read, data: included) into
 * vector outlines and returns it as an SVG data URL — sharp at any print
 * size, and its line weight visible to the print checks. Null when the
 * picture can't be read or has no dark lines to trace.
 *
 * `threshold` is 0–255: how dark a pixel must be to count as line.
 */
export async function vectorizeImageSrc(src: string, threshold = 128): Promise<{ src: string; paths: number } | null> {
  try {
    const img = new window.Image();
    img.crossOrigin = "anonymous"; // a picture stored as a link must still be readable pixel by pixel
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("unreadable"));
      img.src = src;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1024;
    const k = Math.min(1800, Math.max(900, longest)) / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((img.naturalWidth || 1024) * k);
    canvas.height = Math.round((img.naturalHeight || 1024) * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // White behind it: transparent pixels must read as paper, not as ink.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = vectorize({ width: pixels.width, height: pixels.height, data: pixels.data }, { threshold });
    if (result.paths === 0) return null;
    return { src: `data:image/svg+xml;utf8,${encodeURIComponent(result.svg)}`, paths: result.paths };
  } catch {
    return null;
  }
}

const AUTO_KEY = "pagewright-auto-vectorize";

/** Whether new AI pictures are traced to vector automatically (on unless the user turned it off on this device). */
export function autoVectorizeOn(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAutoVectorize(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "on" : "off");
  } catch {
    // not remembered in private mode
  }
}
