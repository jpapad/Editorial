import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface MetaLabelProps {
  children: ReactNode;
  /** ink-muted (default, most metadata) or accent (e.g. a highlighted count), error/warning (blocking/warning counts and flagged-page labels in 3e). */
  tone?: "muted" | "ink" | "accent" | "error" | "warning";
  className?: string;
}

const TONE_CLASS: Record<NonNullable<MetaLabelProps["tone"]>, string> = {
  muted: "text-ink-muted",
  ink: "text-ink",
  accent: "text-accent",
  error: "text-error",
  warning: "text-warning",
};

/**
 * The mono metadata convention used throughout the mocks: JetBrains Mono,
 * uppercase, letter-spaced — page counts, trim size, "PAGE 07 / 24",
 * "AUTOSAVED 2M AGO", etc. Built from plain utilities rather than a
 * hand-written CSS class (see globals.css's note on why the Step 1
 * version of this — a `.pw-mono-label` class — silently failed: Tailwind
 * v4 only emits a theme value where it detects the matching utility
 * class in scanned source, so a class that only *referenced* the token
 * via `var()` got nothing generated for it).
 */
export default function MetaLabel({ children, tone = "muted", className }: MetaLabelProps) {
  return <span className={cn("font-pw-mono text-mono font-medium uppercase tracking-[0.09em]", TONE_CLASS[tone], className)}>{children}</span>;
}
