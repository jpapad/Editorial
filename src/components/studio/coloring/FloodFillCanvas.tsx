"use client";

import { useRef } from "react";
import { TEST_FILL_REGIONS, TEST_LINE_ART_OUTLINE, TEST_LINE_ART_VIEWBOX } from "@/components/studio/coloring/testLineArt";

export interface FloodFillCanvasProps {
  fills: Record<string, string>;
  activeColor: string;
  onFillRegion: (regionId: string, color: string) => void;
  /** Long-press-to-sample: reports the region's CURRENT fill so the caller can set it as the active swatch. Fires only on a real long-press, never on a tap (a tap always paints, per the README's "tap a region to flood-fill"). */
  onSampleColor: (color: string) => void;
}

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 8;

/**
 * Two layers per the README's Color behavior: fill regions underneath
 * (this component owns their color, keyed by region id), locked line art
 * on top (`pointer-events: none` — clicks pass straight through it to
 * whichever fill region is actually underneath the pointer).
 */
export default function FloodFillCanvas({ fills, activeColor, onFillRegion, onSampleColor }: FloodFillCanvasProps) {
  const pressState = useRef<{ regionId: string; startX: number; startY: number; longPressFired: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);

  function handleRegionPointerDown(regionId: string, e: React.PointerEvent) {
    const startX = e.clientX;
    const startY = e.clientY;
    const timer = setTimeout(() => {
      if (!pressState.current || pressState.current.regionId !== regionId) return;
      pressState.current.longPressFired = true;
      const sampled = fills[regionId];
      if (sampled) onSampleColor(sampled);
    }, LONG_PRESS_MS);
    pressState.current = { regionId, startX, startY, longPressFired: false, timer };
  }

  function handleRegionPointerMove(e: React.PointerEvent) {
    const press = pressState.current;
    if (!press) return;
    const dx = Math.abs(e.clientX - press.startX);
    const dy = Math.abs(e.clientY - press.startY);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      clearTimeout(press.timer);
      pressState.current = null;
    }
  }

  function handleRegionPointerUp(regionId: string) {
    const press = pressState.current;
    if (!press || press.regionId !== regionId) return;
    clearTimeout(press.timer);
    if (!press.longPressFired) onFillRegion(regionId, activeColor);
    pressState.current = null;
  }

  return (
    <svg viewBox={TEST_LINE_ART_VIEWBOX} className="h-full w-full" role="img" aria-label="Coloring page — tap a region to fill it">
      <g>
        {TEST_FILL_REGIONS.map((region) => {
          const props = {
            ...region.attrs,
            fill: fills[region.id] ?? "#ffffff",
            className: "cursor-pointer",
            onPointerDown: (e: React.PointerEvent) => handleRegionPointerDown(region.id, e),
            onPointerMove: handleRegionPointerMove,
            onPointerUp: () => handleRegionPointerUp(region.id),
            onPointerLeave: () => {
              if (pressState.current?.regionId === region.id) {
                clearTimeout(pressState.current.timer);
                pressState.current = null;
              }
            },
          };
          return region.element === "ellipse" ? <ellipse key={region.id} {...props} /> : <path key={region.id} {...props} />;
        })}
      </g>
      <g dangerouslySetInnerHTML={{ __html: TEST_LINE_ART_OUTLINE }} style={{ pointerEvents: "none" }} />
    </svg>
  );
}
