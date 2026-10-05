"use client";

import { cn } from "@/utils/cn";

export interface ColorSwatchProps {
  hex: string;
  selected?: boolean;
  onClick?: () => void;
  /** Diameter in px — varies by real use (2b's palette grid ~28px, 3a's floating toolbar 38px, 1h's expanded palette 34px), so this is a plain number, not an enum. */
  sizePx?: number;
  /**
   * "panel" (default): thin accent ring + soft glow — the general
   * selection-ring rule, fine against a plain white/light card.
   * "toolbar": accent ring separated by a white gap first — 3a's floating
   * toolbar sits directly over colored content, and a ring with no white
   * gap would be hard to read against an arbitrary selected color.
   */
  context?: "panel" | "toolbar";
  label?: string;
  className?: string;
}

export default function ColorSwatch({ hex, selected = false, onClick, sizePx = 28, context = "panel", label, className }: ColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? hex}
      aria-pressed={selected}
      style={{
        width: sizePx,
        height: sizePx,
        backgroundColor: hex,
        boxShadow: selected
          ? context === "toolbar"
            ? "0 0 0 3px #fff, 0 0 0 5px var(--color-accent)"
            : "0 0 0 2px var(--color-accent), 0 0 0 4px var(--color-accent-ring)"
          : undefined,
      }}
      className={cn(
        "shrink-0 rounded-pill outline-none transition-transform duration-150 motion-reduce:transition-none active:scale-95",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        className
      )}
    />
  );
}
