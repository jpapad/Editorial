"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Grid3x3, Minus, Plus, Ruler } from "lucide-react";
import Slider from "@/components/studio/ui/Slider";
import { cn } from "@/utils/cn";
import type { GuideSpec } from "@/components/editor/CanvasEditor";
import { LINE_STYLE_OPTIONS, SYMMETRY_OPTIONS } from "@/components/editor/strokeTools";
import { isPrimaryModifier, isTypingTarget } from "@/components/studio/editor/keyboard";
import type { GapMarker } from "@/components/studio/editor/gapCheck";
import type { BookPage, DrawingTool, FillStyle, LineData, LineStyle, ObjectUpdate, PageSpace, PendingPlacement, SymmetryMode } from "@/types/editor";
import type { EditorMode } from "@/components/studio/types";
import { useT } from "@/lib/i18n";

const CANVAS_PADDING_PX = 24; // breathing room so the paper never touches the container edge exactly
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.25;
const BOTTOM_BAR_ROOM_PX = 76;

/** One-click stroke widths. "Ages 3–5" is the chunky line very young children need to stay inside. */
export const BRUSH_PRESETS = [
  { label: "Fine", width: 3 },
  { label: "Medium", width: 6 },
  { label: "Bold", width: 12 },
  { label: "Ages 3–5", width: 20 },
];

// Konva touches `window`/`document` at import time, so the canvas must
// never render on the server — same constraint, same fix, as the old
// editor's own dynamic import.
const CanvasEditor = dynamic(() => import("@/components/editor/CanvasEditor"), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-[42vh] animate-pulse rounded-paper-sm bg-inset" />,
});

export interface CanvasAreaProps {
  page: BookPage;
  /** Canvas size in points (trim + bleed, or a cover spread). */
  space: PageSpace;
  guides?: GuideSpec;
  mode: EditorMode;
  tool: DrawingTool;
  strokeWidth: number;
  onStrokeWidthChange: (pt: number) => void;
  activeColor: string;
  fillStyle?: FillStyle;
  onSampleColor: (hex: string) => void;
  onFillChange?: (dataUrl: string) => void;
  undoFillSignal?: number;
  onCanUndoFillChange?: (canUndo: boolean) => void;
  pendingPlacement: PendingPlacement | null;
  selectedIds: string[];
  onSelectObject: (id: string | null, additive: boolean) => void;
  onSelectIds: (ids: string[], additive: boolean) => void;
  onAddLines: (lines: LineData[]) => void;
  onPlaceObject: (placement: PendingPlacement, x: number, y: number) => void;
  onUpdateObjects: (updates: ObjectUpdate[]) => void;
  onTextDragStateChange: (id: string, isDragging: boolean) => void;
  onStageReady: (stage: import("konva/lib/Stage").Stage) => void;
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
  showGuides?: boolean;
  onShowGuidesChange?: (show: boolean) => void;
  symmetry?: SymmetryMode;
  onSymmetryChange?: (mode: SymmetryMode) => void;
  smoothing?: number;
  onSmoothingChange?: (amount: number) => void;
  lineStyle?: LineStyle;
  onLineStyleChange?: (style: LineStyle | undefined) => void;
  gapMarkers?: GapMarker[] | null;
  detailMarkers?: { x: number; y: number; r: number }[] | null;
  /** Hides the view toolbar (zoom/grid/guides) — for embedded, child-facing uses like ColoringView. */
  hideViewControls?: boolean;
  /** Space kept around the page inside the viewport (default 24px; 0 when the host already frames it). */
  padding?: number;
  /** Dark canvas surround (the 2a variant) — scoped to just this background, never the rest of the shell. */
  darkSurround?: boolean;
  /** Extra UI positioned over the paper in CSS px (e.g. the selection toolbar); gets the current zoom. */
  overlay?: (scale: number) => React.ReactNode;
  /** Pinned to the bottom centre (the AI command bar); the stroke toolbars move up above it. */
  bottomBar?: React.ReactNode;
  /** Blocks pointer input on the page (e.g. while an AI command is changing it). */
  locked?: boolean;
}

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function ToolbarIconButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-pill outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        pressed ? "bg-accent-tint text-accent" : "text-ink-secondary hover:bg-inset-alt"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Hosts the real drawing canvas inside a scrollable, zoomable viewport.
 * Fit mode (the default) scales the page to the available space, never
 * above 100%; zooming switches to an explicit scale and the page scrolls.
 * The scale is applied to the Konva Stage itself, so pointer math,
 * flood-fill snapshots and exports all stay in native page units.
 */
export default function CanvasArea(props: CanvasAreaProps) {
  const { mode, tool, strokeWidth, onStrokeWidthChange, darkSurround = false, hideViewControls = false, padding = CANVAS_PADDING_PX } = props;
  const showStrokeToolbar = (mode === "draw" || mode === "cover") && (tool === "pen" || tool === "eraser");
  // The coloring brush gets sizes only — no smoothing or mirror.
  const showBrushToolbar = mode === "color" && tool === "brush" && !hideViewControls;
  const t = useT();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit to the viewport
  const scale = zoom ?? fitScale;
  const [isPanning, setIsPanning] = useState(false);
  const panDragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  // Page point to keep under the pointer across a zoom-at-pointer step, applied after the re-render.
  const zoomAnchorRef = useRef<{ pageX: number; pageY: number; clientX: number; clientY: number } | null>(null);

  const spaceRef = useRef(props.space);
  const paddingRef = useRef(padding);
  // Room kept under the page for the bottom bar, so it never covers the paper at the fitted zoom.
  const reserveBottom = props.bottomBar ? BOTTOM_BAR_ROOM_PX : 0;
  const reserveRef = useRef(reserveBottom);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {};
      if (!width || !height) return;
      const availableWidth = width - paddingRef.current * 2;
      const availableHeight = height - paddingRef.current * 2 - reserveRef.current;
      setFitScale(Math.min(availableWidth / spaceRef.current.width, availableHeight / spaceRef.current.height, 1));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A different page size (bleed toggled, cover vs interior) needs a new fit.
  const { width: spaceWidth, height: spaceHeight } = props.space;
  useEffect(() => {
    spaceRef.current = { ...spaceRef.current, width: spaceWidth, height: spaceHeight };
    paddingRef.current = padding;
    reserveRef.current = reserveBottom;
    const el = scrollRef.current;
    if (!el) return;
    const width = el.clientWidth - padding * 2;
    const height = el.clientHeight - padding * 2 - reserveBottom;
    if (width > 0 && height > 0) setFitScale(Math.min(width / spaceWidth, height / spaceHeight, 1));
  }, [spaceWidth, spaceHeight, padding, reserveBottom]);

  function zoomTo(next: number, anchor?: { clientX: number; clientY: number }) {
    const paper = paperRef.current?.getBoundingClientRect();
    const scroller = scrollRef.current?.getBoundingClientRect();
    const point = anchor ?? (scroller ? { clientX: scroller.left + scroller.width / 2, clientY: scroller.top + scroller.height / 2 } : null);
    if (paper && point) {
      zoomAnchorRef.current = { pageX: (point.clientX - paper.left) / scale, pageY: (point.clientY - paper.top) / scale, ...point };
    }
    setZoom(clampScale(next));
  }

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const scroller = scrollRef.current;
    const paper = paperRef.current?.getBoundingClientRect();
    if (!anchor || !scroller || !paper) return;
    zoomAnchorRef.current = null;
    scroller.scrollLeft += paper.left + anchor.pageX * scale - anchor.clientX;
    scroller.scrollTop += paper.top + anchor.pageY * scale - anchor.clientY;
  }, [scale]);

  // Latest zoomTo/scale for the native listeners below (registered once).
  const zoomRef = useRef({ zoomTo, scale, fit: () => setZoom(null) });
  useEffect(() => {
    zoomRef.current = { zoomTo, scale, fit: () => setZoom(null) };
  });

  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as ctrl+wheel) zooms
  // at the pointer. Registered natively: React's onWheel is passive, so it
  // can't stop the browser's own page zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!isPrimaryModifier(e)) return;
      e.preventDefault();
      const { zoomTo: z, scale: s } = zoomRef.current;
      z(s * Math.exp(-e.deltaY * 0.0025), { clientX: e.clientX, clientY: e.clientY });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // View shortcuts: Cmd/Ctrl +/−/0, and hold Space to pan.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const { zoomTo: z, scale: s, fit } = zoomRef.current;
      if (isPrimaryModifier(e) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        z(s * ZOOM_STEP);
      } else if (isPrimaryModifier(e) && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        z(s / ZOOM_STEP);
      } else if (isPrimaryModifier(e) && e.key === "0") {
        e.preventDefault();
        fit();
      } else if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsPanning(true);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setIsPanning(false);
        panDragRef.current = null;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const symmetry = props.symmetry ?? "off";

  return (
    <div className={cn("relative flex min-h-0 flex-1 overflow-hidden rounded-panel", darkSurround && "canvas-dark")}>
      <div ref={scrollRef} className="absolute inset-0 overflow-auto">
        {/* min-w/min-h-full + w/h-max: centered while the page fits, scrollable (not clipped) once zoomed past the viewport. */}
        <div className="grid min-h-full min-w-full place-items-center" style={{ width: "max-content", height: "max-content", padding, paddingBottom: padding + reserveBottom }}>
          <div ref={paperRef} className="relative">
            <CanvasEditor
              page={props.page}
              space={props.space}
              guides={props.guides}
              tool={props.tool}
              strokeWidth={props.strokeWidth}
              pendingPlacement={props.pendingPlacement}
              selectedIds={props.selectedIds}
              showGrid={props.showGrid ?? false}
              showGuides={props.showGuides ?? false}
              symmetry={symmetry}
              lineStyle={props.lineStyle}
              smoothing={props.smoothing ?? 0}
              gapMarkers={props.gapMarkers}
              detailMarkers={props.detailMarkers}
              mode={props.mode === "cover" ? "draw" : props.mode}
              backgroundPatternId={props.page.backgroundPatternId}
              isCover={props.page.isCover}
              coverBackgroundColor={props.page.coverBackgroundColor}
              activeColor={props.activeColor}
              fillStyle={props.fillStyle}
              onSampleColor={props.onSampleColor}
              onFillChange={props.onFillChange}
              undoFillSignal={props.undoFillSignal}
              onCanUndoFillChange={props.onCanUndoFillChange}
              onSelectObject={props.onSelectObject}
              onSelectIds={props.onSelectIds}
              onAddLines={props.onAddLines}
              onPlaceObject={props.onPlaceObject}
              onUpdateObjects={props.onUpdateObjects}
              onTextDragStateChange={props.onTextDragStateChange}
              onStageReady={props.onStageReady}
              scale={scale}
            />
            {props.overlay?.(scale)}
          </div>
        </div>
      </div>

      {props.locked && <div className="absolute inset-0 z-10 cursor-progress" aria-hidden />}
      {props.bottomBar && <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30 flex justify-center">{props.bottomBar}</div>}

      {/* Space held: a transparent layer over the page turns drags into scrolling instead of drawing. */}
      {isPanning && (
        <div
          className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            const el = scrollRef.current;
            if (!el) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            panDragRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
          }}
          onPointerMove={(e) => {
            const drag = panDragRef.current;
            const el = scrollRef.current;
            if (!drag || !el) return;
            el.scrollLeft = drag.left - (e.clientX - drag.x);
            el.scrollTop = drag.top - (e.clientY - drag.y);
          }}
          onPointerUp={() => {
            panDragRef.current = null;
          }}
        />
      )}

      {!hideViewControls && (
        <div className="absolute right-3 top-3 z-20 flex items-center gap-0.5 rounded-pill pw-glass p-1 shadow-toolbar">
          <ToolbarIconButton label={`${t("Zoom out")} (⌘/Ctrl −)`} onClick={() => zoomTo(scale / ZOOM_STEP)}>
            <Minus size={14} />
          </ToolbarIconButton>
          <button
            type="button"
            title={`${t("Fit page")} (⌘/Ctrl 0)`}
            onClick={() => setZoom(null)}
            className="h-8 min-w-[52px] rounded-pill px-2 font-pw-mono text-helper font-medium text-ink outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolbarIconButton label={`${t("Zoom in")} (⌘/Ctrl +)`} onClick={() => zoomTo(scale * ZOOM_STEP)}>
            <Plus size={14} />
          </ToolbarIconButton>
          <span className="mx-1 h-5 w-px bg-hairline" />
          <ToolbarIconButton label={t("Grid")} pressed={props.showGrid} onClick={() => props.onShowGridChange?.(!props.showGrid)}>
            <Grid3x3 size={14} />
          </ToolbarIconButton>
          <ToolbarIconButton label={`${t("Print guides")} (G)`} pressed={props.showGuides} onClick={() => props.onShowGuidesChange?.(!props.showGuides)}>
            <Ruler size={14} />
          </ToolbarIconButton>
        </div>
      )}

      {showBrushToolbar && (
        <div className={cn("absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-pill pw-glass py-2 pl-2 pr-4 shadow-toolbar", props.bottomBar ? "bottom-[84px]" : "bottom-4")}>
          <div className="flex items-center gap-0.5" role="group" aria-label={t("Brush sizes")}>
            {[8, 16, 28].map((w, i) => (
              <button
                key={w}
                type="button"
                aria-pressed={strokeWidth === w}
                onClick={() => onStrokeWidthChange(w)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-helper font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  strokeWidth === w ? "bg-ink text-on-ink" : "text-ink-secondary hover:bg-inset-alt"
                )}
              >
                <span className="inline-block rounded-pill bg-current" style={{ width: 6 + i * 4, height: 6 + i * 4 }} aria-hidden />
                {t(["Thin", "Medium", "Thick"][i])}
              </button>
            ))}
          </div>
          <Slider layout="inline" min={2} max={60} step={1} value={strokeWidth} onChange={onStrokeWidthChange} valueLabel={`${strokeWidth}PX`} />
        </div>
      )}

      {showStrokeToolbar && (
        <div className={cn("absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-pill pw-glass py-2 pl-2 pr-4 shadow-toolbar", props.bottomBar ? "bottom-[84px]" : "bottom-4")}>
          <div className="flex items-center gap-0.5" role="group" aria-label={t("Brush presets")}>
            {BRUSH_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                aria-pressed={strokeWidth === preset.width}
                title={`${preset.width}px`}
                onClick={() => onStrokeWidthChange(preset.width)}
                className={cn(
                  "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-helper font-medium outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  strokeWidth === preset.width ? "bg-ink text-on-ink" : "text-ink-secondary hover:bg-inset-alt"
                )}
              >
                <span className="inline-block rounded-pill bg-current" style={{ width: Math.min(preset.width, 14), height: Math.min(preset.width, 14) }} aria-hidden />
                {t(preset.label)}
              </button>
            ))}
          </div>
          <Slider layout="inline" min={1} max={40} step={1} value={strokeWidth} onChange={onStrokeWidthChange} valueLabel={`${strokeWidth}PX`} />
          <span className="h-5 w-px bg-hairline" />
          <label className="flex items-center gap-2 font-pw-mono text-mono font-medium uppercase tracking-[0.09em] text-ink-muted">
            {t("Smooth")}
            <Slider layout="inline" min={0} max={1} step={0.05} value={props.smoothing ?? 0} onChange={(v) => props.onSmoothingChange?.(v)} />
          </label>
          {tool === "pen" && props.onLineStyleChange && (
            <>
              <span className="h-5 w-px bg-hairline" />
              <label className="flex items-center gap-2 font-pw-mono text-mono font-medium uppercase tracking-[0.09em] text-ink-muted">
                {t("Line")}
                <select
                  value={props.lineStyle ?? "solid"}
                  onChange={(e) => props.onLineStyleChange?.(e.target.value === "solid" ? undefined : (e.target.value as LineStyle))}
                  className="h-8 rounded-pill border border-hairline bg-panel px-2 font-pw-sans text-helper normal-case tracking-normal text-ink-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {LINE_STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <span className="h-5 w-px bg-hairline" />
          <label className="flex items-center gap-2 font-pw-mono text-mono font-medium uppercase tracking-[0.09em] text-ink-muted">
            {t("Mirror")}
            <select
              value={symmetry}
              onChange={(e) => props.onSymmetryChange?.(e.target.value as SymmetryMode)}
              className={cn(
                "h-8 rounded-pill border px-2 font-pw-sans text-helper normal-case tracking-normal outline-none focus-visible:ring-2 focus-visible:ring-accent",
                symmetry === "off" ? "border-hairline bg-panel text-ink-secondary" : "border-warning bg-warning/10 text-ink"
              )}
            >
              {SYMMETRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
