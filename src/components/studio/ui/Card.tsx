import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface CardProps {
  children: ReactNode;
  /** default = white panel. accent = the light-blue advisory tint (#e8edfb) reused for "Print check", import hints, active rows. */
  tone?: "default" | "accent";
  /** panel (18px, most cards) or panel-sm (16px, denser lists like Layers/Palette rows). */
  radius?: "panel" | "panel-sm";
  className?: string;
  style?: CSSProperties;
}

/**
 * The panel every card in the mocks is built from. No border — depth
 * comes from shadow-panel, per the design system's "borders are avoided"
 * rule. Padding is left to the caller (15-16px per the spec, but content
 * varies enough — a Layers list vs. a preflight message — that a fixed
 * padding here would fight real layouts more often than it'd help).
 */
export default function Card({ children, tone = "default", radius = "panel", className, style }: CardProps) {
  return (
    <div
      style={style}
      className={cn(
        "shadow-panel",
        radius === "panel" ? "rounded-panel" : "rounded-panel-sm",
        tone === "accent" ? "bg-accent-tint" : "bg-panel",
        className
      )}
    >
      {children}
    </div>
  );
}
