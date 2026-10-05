import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scales. Without this it reads
// our custom `text-mono` / `text-body`… as COLOURS and drops them whenever a
// text colour follows (MetaLabel lost its size that way). These lists mirror
// the @theme block in app/globals.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["page-title", "modal-title", "section-title", "card-title", "body", "helper", "mono"],
      radius: ["pill", "rail", "panel", "panel-sm", "row", "row-sm", "paper", "paper-sm"],
      shadow: ["resting", "panel", "toolbar", "paper", "canvas-dark"],
      font: ["pw-sans", "pw-mono"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
