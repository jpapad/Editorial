"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { FILL_STYLES, patternPreviewUrl } from "@/components/studio/editor/fillPatterns";
import type { FillStyle } from "@/types/editor";

/** Solid / stars / stripes / dots / hearts — previewed in the current color. */
export default function FillStylePicker({ value, color, onChange, size = 32 }: { value: FillStyle; color: string; onChange: (style: FillStyle) => void; size?: number }) {
  // Previews are drawn on a canvas, which only exists in the browser.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canvas-rendered previews, recomputed when the color changes
    setPreviews(Object.fromEntries(FILL_STYLES.map((s) => [s.value, patternPreviewUrl(s.value, color)])));
  }, [color]);

  return (
    <div role="radiogroup" aria-label="Fill style" className="flex flex-wrap gap-1.5">
      {FILL_STYLES.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          aria-label={s.label}
          title={s.label}
          onClick={() => onChange(s.value)}
          className={cn(
            "rounded-pill bg-cover bg-center outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 motion-reduce:transition-none",
            value === s.value ? "ring-2 ring-ink ring-offset-2" : "border border-hairline hover:scale-105"
          )}
          style={{ width: size, height: size, backgroundImage: previews[s.value] ? `url(${previews[s.value]})` : undefined }}
        />
      ))}
    </div>
  );
}
