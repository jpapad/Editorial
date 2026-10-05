"use client";

import { cn } from "@/utils/cn";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * The Draw/Color/Assemble mode switch (2b) and any other pill-group
 * choice. Greek labels for this exact control need to stay short — see
 * README's `3g`: "Σχέδιο / Χρώμα / Σελίδες" fits, "Συναρμολόγηση" alone
 * does not fit a 264px panel. That's the caller's word choice to get
 * right, not something this component can enforce.
 */
export default function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div role="tablist" className={cn("inline-flex gap-0.5 rounded-pill bg-inset p-[3px]", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 text-helper font-medium outline-none transition-colors duration-150 motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              active ? "bg-ink text-on-ink" : "text-ink-secondary hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
