"use client";

import { Cat, Flower2, Heart, Moon, Rainbow, Rocket, Sparkles, Star, Sun, Trophy, type LucideIcon } from "lucide-react";
import type { PageSpace } from "@/types/editor";

/** Earned in order — the Nth finished page earns STICKERS[N % length]. */
export const STICKERS: { Icon: LucideIcon; color: string; name: string }[] = [
  { Icon: Star, color: "#e0a13c", name: "Αστεράκι" },
  { Icon: Heart, color: "#e05a7a", name: "Καρδούλα" },
  { Icon: Rainbow, color: "#3357d4", name: "Ουράνιο τόξο" },
  { Icon: Sun, color: "#f08c2e", name: "Ήλιος" },
  { Icon: Rocket, color: "#7a5cd6", name: "Πύραυλος" },
  { Icon: Flower2, color: "#d4569b", name: "Λουλούδι" },
  { Icon: Cat, color: "#8a6a4f", name: "Γατούλα" },
  { Icon: Moon, color: "#42505f", name: "Φεγγάρι" },
  { Icon: Sparkles, color: "#2ea37a", name: "Μαγεία" },
  { Icon: Trophy, color: "#c9a227", name: "Κύπελλο" },
];

export function Sticker({ index, size = 56 }: { index: number; size?: number }) {
  const { Icon, color } = STICKERS[index % STICKERS.length];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-pill border-[3px] border-white shadow-toolbar"
      style={{ width: size, height: size, background: color, transform: `rotate(${((index * 37) % 24) - 12}deg)` }}
      aria-hidden
    >
      <Icon size={size * 0.52} color="#ffffff" fill="#ffffff" strokeWidth={1.5} />
    </span>
  );
}

/**
 * Prints one page at its real size: a hidden iframe holding just the image,
 * with an @page rule matching the book's page — no browser header/footer
 * margins squeezing the picture.
 */
export function printPageImage(dataUrl: string, space: PageSpace, title: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  const w = (space.width / 72).toFixed(3);
  const h = (space.height / 72).toFixed(3);
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${title.replace(/[<>&"]/g, "")}</title><style>@page{size:${w}in ${h}in;margin:0}html,body{margin:0}img{display:block;width:${w}in;height:${h}in}</style></head><body><img src="${dataUrl}"></body></html>`
  );
  doc.close();
  const img = doc.querySelector("img");
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  if (img && !img.complete) img.onload = go;
  else go();
}
