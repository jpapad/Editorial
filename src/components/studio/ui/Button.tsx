"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "dark" | "ghost";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /**
   * primary = accent pill ("Publish", "Προσθήκη στο βιβλίο", "Νέο βιβλίο").
   * secondary = inset pill ("Export", "Άκυρο", "Από template").
   * dark = ink-filled white-text pill, distinct from primary — the mocks
   *   use this for a few specific actions ("Δοκίμασε ξανά" in 3d, the
   *   fill-color action circle in 3a) rather than the accent color.
   * ghost = no fill, muted text — low-emphasis actions ("Διακοπή").
   */
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
  children?: ReactNode;
  /** Merged in after the variant/size classes — for instance-specific layout (width, margin), never to override the button's own look. */
  className?: string;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent shadow-resting hover:brightness-95",
  secondary: "bg-inset text-ink hover:bg-inset-alt",
  dark: "bg-ink text-on-ink shadow-resting hover:brightness-110",
  ghost: "bg-transparent text-ink-secondary hover:bg-inset",
};

const SIZE_CLASS: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3.5 text-helper",
  md: "h-10 px-5 text-body",
};

/**
 * The pill button every screen uses. Disabled state is a fixed look, not
 * just opacity — 3e's blocked Export pill is a specific bg/ink pair
 * (`--color-disabled-bg` / `--color-disabled-ink`), not a dimmed accent.
 */
export default function Button({ variant = "primary", size = "md", icon, children, disabled, className, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill font-medium outline-none transition-[filter,background-color] duration-150 motion-reduce:transition-none active:scale-[0.98]",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        SIZE_CLASS[size],
        disabled ? "bg-disabled-bg text-disabled-ink shadow-none" : VARIANT_CLASS[variant],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
