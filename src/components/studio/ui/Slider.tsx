"use client";

import { cn } from "@/utils/cn";
import MetaLabel from "@/components/studio/ui/MetaLabel";

export interface SliderProps {
  label?: string;
  /** Pre-formatted display value, e.g. "0.42", "2.8 PT", "68%" — formatting is the caller's call (units differ per slider). */
  valueLabel?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  /**
   * "stacked" (default): label/value row above the track — 3b's
   * Threshold/Line weight/Detail sliders, each its own full-width row.
   * "inline": value sits beside the track on the same row, no separate
   * label row — 2b's floating canvas toolbar, where several unrelated
   * compact controls share one horizontal strip.
   */
  layout?: "stacked" | "inline";
  className?: string;
}

function Track({ percent, min, max, step, value, onChange, label }: { percent: number; min: number; max: number; step: number; value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div className="relative flex h-4 items-center">
      <div className="absolute inset-x-0 h-1 rounded-pill bg-inset" />
      <div className="absolute h-1 rounded-pill bg-accent" style={{ width: `${percent}%` }} />
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "relative w-full cursor-pointer appearance-none bg-transparent outline-none",
          "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-accent focus-visible:[&::-webkit-slider-thumb]:ring-offset-2",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-resting",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-resting"
        )}
      />
    </div>
  );
}

/**
 * The threshold/line-weight/detail sliders (3b) and the canvas toolbar's
 * stroke/smoothing sliders (2b). A native `<input type="range">` for real
 * keyboard/screen-reader support, restyled: the track and fill are drawn
 * by two plain divs underneath it, and the input itself is transparent
 * with only its thumb visible (via the `::-webkit-slider-thumb` /
 * `::-moz-range-thumb` arbitrary variants) — layering it like this keeps
 * the fill perfectly in sync with the input's own value without a
 * separate ref/measurement step.
 */
export default function Slider({ label, valueLabel, min, max, step = 1, value, onChange, layout = "stacked", className }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  if (layout === "inline") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="w-24">
          <Track label={label} percent={percent} min={min} max={max} step={step} value={value} onChange={onChange} />
        </div>
        {valueLabel && <MetaLabel tone="ink">{valueLabel}</MetaLabel>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between">
          {label && <MetaLabel>{label}</MetaLabel>}
          {valueLabel && <MetaLabel tone="ink">{valueLabel}</MetaLabel>}
        </div>
      )}
      <Track label={label} percent={percent} min={min} max={max} step={step} value={value} onChange={onChange} />
    </div>
  );
}
