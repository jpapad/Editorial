"use client";

import { cn } from "@/utils/cn";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

/** The Despeckle / Close open shapes / Keep shading switches (3b). A real `<button role="switch">`, not a styled checkbox — matches how it's actually operated (click/tap/Enter/Space, no dragging). */
export default function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-pill outline-none transition-colors duration-150 motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          checked ? "bg-accent" : "bg-inset"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-pill bg-white shadow-resting transition-[left] duration-150 motion-reduce:transition-none",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </button>
      {label && <span className="text-body text-ink">{label}</span>}
    </label>
  );
}
