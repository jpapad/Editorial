import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/utils/cn";

/**
 * The mocks' one striped placeholder pattern for "no art supplied yet" —
 * exact value from the README ("Exception" note), not an approximation.
 * Real line art has never been supplied for this handoff; every artwork
 * slot in the mocks (and here) uses this same pattern rather than
 * fabricated clip art.
 */
export const PLACEHOLDER_ART_PATTERN = "repeating-linear-gradient(135deg, #eceae6 0 6px, #f8f7f4 6px 12px)";

export interface ThumbnailProps {
  /** Real image — when omitted, renders the striped placeholder (see PLACEHOLDER_ART_PATTERN). */
  src?: string;
  alt?: string;
  selected?: boolean;
  /** Dashed border "add new" / "drop target" styling — the filmstrip's trailing "+" tile, 2c's "NEW BOOK" tile, 1g's drop target. */
  dashed?: boolean;
  radius?: "paper" | "paper-sm";
  /** Top-left corner chip, e.g. the "DRAFT" status pill in 2c. */
  badge?: ReactNode;
  /** Centered overlay content — a "+" icon, a page number, etc. */
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

export default function Thumbnail({ src, alt = "", selected = false, dashed = false, radius = "paper", badge, children, onClick, className, style }: ThumbnailProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={onClick ? alt : undefined}
      aria-current={selected ? "true" : undefined}
      style={{
        ...style,
        backgroundImage: src ? `url(${src})` : PLACEHOLDER_ART_PATTERN,
        backgroundSize: src ? "cover" : undefined,
        backgroundPosition: src ? "center" : undefined,
        boxShadow: selected ? "0 0 0 2px var(--color-accent)" : style?.boxShadow,
      }}
      className={cn(
        "relative shrink-0 overflow-hidden bg-paper outline-none",
        radius === "paper" ? "rounded-paper" : "rounded-paper-sm",
        dashed && "border border-dashed border-hairline",
        onClick && "cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        className
      )}
    >
      {badge && <span className="absolute left-1.5 top-1.5">{badge}</span>}
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </Tag>
  );
}
