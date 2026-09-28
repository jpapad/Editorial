"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Line,
  Rect,
  Ellipse,
  Arrow,
  Circle,
  Group,
  Text as KonvaText,
  Image as KonvaImage,
  Transformer,
} from "react-konva";
import useImage from "use-image";
// A value import (not `import type`) — Konva.Filters.Grayscale/Threshold are
// runtime functions we apply to cached stamp nodes for the line-art filter.
import Konva from "konva";
import type { BookPage, DrawingTool, LineData, ObjectChanges, ObjectUpdate, PageSpace, PendingPlacement, ShapeData, StampData, SymmetryMode, TextData } from "@/types/editor";
import { getBackgroundPattern } from "@/components/editor/backgroundPatterns";
import { isOpenStroke, isPolygonShape, polygonPoints } from "@/components/editor/shapeGeometry";
import { smoothStroke, stabilize, symmetricCopies, symmetryAxes } from "@/components/editor/strokeTools";
import type { EditorMode } from "@/components/studio/types";
import { floodFill, samplePixelColor, type PixelBuffer } from "@/components/studio/editor/rasterFloodFill";
import type { GapMarker } from "@/components/studio/editor/gapCheck";
import { objectBounds } from "@/utils/objectGeometry";
import { geometryFromSpace, type PageGeometry, type Rect as PageRect } from "@/utils/pageGeometry";
import { ensureKidFonts } from "@/components/editor/kidFonts";

/**
 * What the print-guides overlay draws, in page units: the trim (cut) line,
 * one or more safe areas, and optional fold lines (a cover's spine). Built
 * by interiorGuides() for book pages and by the cover designer for covers.
 */
export interface GuideSpec {
  trim: PageRect;
  safe: PageRect[];
  folds?: number[][];
  /** Areas that must stay clear (e.g. the cover's barcode box) — drawn hatched. */
  blocked?: PageRect[];
  labels?: { x: number; y: number; text: string; color?: string }[];
  /** Faint center crosshair — useful on single pages, noise on a cover spread. */
  center?: boolean;
}

export function interiorGuides(geo: PageGeometry): GuideSpec {
  return {
    trim: geo.trim,
    safe: [geo.safe],
    center: true,
    labels: [
      { x: geo.safe.left + 4, y: geo.safe.top + 4, text: "SAFE AREA · 0.5 IN", color: GUIDE_COLOR },
      { x: geo.trim.left + 6, y: geo.trim.bottom - 14, text: geo.bleed ? "TRIM · BLEED BEYOND" : "TRIM EDGE", color: TRIM_COLOR },
    ],
  };
}

const PEN_COLOR = "#111827";
const GRID_SIZE = 25;
const GUIDE_COLOR = "#3357d4";
const TRIM_COLOR = "#c4453f";
const FOLD_COLOR = "#e0a13c";
const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 6;
const MAX_FILL_HISTORY = 20;
const MARQUEE_MIN_PX = 4;

/** Name carried by every editor-only node (guides, grid, gap markers, selection UI) — captureStage hides them so they never reach an export or thumbnail. */
const OVERLAY_NAME = "editor-overlay";
const INK_LAYER_NAME = "ink-layer";

/**
 * Page image at a fixed resolution regardless of the current on-screen
 * zoom: `pixelRatio` is relative to the native 595x842 page, so it's
 * divided by the Stage's current scale. Editor overlays are hidden for the
 * capture and restored after.
 */
export function captureStage(stage: Konva.Stage, pixelRatio: number): string {
  const overlays = stage.find(`.${OVERLAY_NAME}`).filter((n) => n.visible());
  overlays.forEach((n) => n.hide());
  try {
    return stage.toDataURL({ pixelRatio: pixelRatio / stage.scaleX(), mimeType: "image/png" });
  } finally {
    overlays.forEach((n) => n.show());
  }
}

/** The ink/objects layer's pixels at native page size — the same "walls" Color mode's bucket fill sees (used by the gap check). */
export function captureInk(stage: Konva.Stage): PixelBuffer | null {
  const layer = stage.findOne(`.${INK_LAYER_NAME}`) as Konva.Layer | undefined;
  if (!layer) return null;
  const overlays = layer.find(`.${OVERLAY_NAME}`).filter((n) => n.visible());
  overlays.forEach((n) => n.hide());
  try {
    const canvas = layer.toCanvas({ pixelRatio: 1 / stage.scaleX() });
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Native page size = rendered size ÷ zoom (rounded: toCanvas rounds too).
    const imageData = ctx.getImageData(0, 0, Math.round(stage.width() / stage.scaleX()), Math.round(stage.height() / stage.scaleY()));
    return { width: imageData.width, height: imageData.height, data: imageData.data };
  } finally {
    overlays.forEach((n) => n.show());
  }
}

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full.slice(0, 6), 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function rgbaToHex([r, g, b]: [number, number, number, number]): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function makeLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CanvasEditorProps {
  page: BookPage;
  /** The canvas size in points — the book's trim (+ bleed), or a cover spread. */
  space: PageSpace;
  /** What "print guides" draws; defaults to interior-page guides for `space`. */
  guides?: GuideSpec;
  tool: DrawingTool;
  strokeWidth: number;
  pendingPlacement: PendingPlacement | null;
  selectedIds: string[];
  showGrid: boolean;
  /** Print guides: trim, safe area(s), folds — see GuideSpec. */
  showGuides: boolean;
  /** Pen/eraser strokes are repeated across the page center — see strokeTools.ts. */
  symmetry?: SymmetryMode;
  /** 0–1: live stabilizer + final smoothing for pen/eraser strokes. */
  smoothing?: number;
  /** Results of the gap check, drawn as red rings until the page changes. */
  gapMarkers?: GapMarker[] | null;
  backgroundPatternId?: string | null;
  isCover?: boolean;
  coverBackgroundColor?: string;
  /**
   * Draw/Assemble behave exactly as before (this prop only changes
   * pointer behavior in Color mode). Color mode's "fill" tool replaces
   * freehand drawing with a real raster flood fill (rasterFloodFill.ts)
   * — see the confirmed decision on why this is raster, not the vector-
   * region model 3a's standalone demo uses: this is the actual Konva
   * drawing surface, not pre-made closed vector shapes.
   */
  mode?: EditorMode;
  /** Fill color for the "fill" tool in Color mode. */
  activeColor?: string;
  /** Long-press-to-sample in Color mode reports the sampled hex here (mirrors 3a's demo interaction, now against real per-pixel paint). */
  onSampleColor?: (hex: string) => void;
  /** Fires after every committed fill with the paint layer's current PNG data URL, so a caller can persist it on `page.fillDataUrl` (see loadFillCanvas below for the read side). */
  onFillChange?: (dataUrl: string) => void;
  /** Bump (any changing number) to step back one fill — real per-fill undo, backed by an in-memory history stack (capped, page-scoped; see MAX_FILL_HISTORY). A no-op once the stack is empty. */
  undoFillSignal?: number;
  /** Fires whenever the fill history stack's non-empty-ness changes, so a caller can disable its own Undo control accurately. */
  onCanUndoFillChange?: (canUndo: boolean) => void;
  /** A click on an object (`additive` = Shift held), or null for a click on empty page. */
  onSelectObject: (id: string | null, additive: boolean) => void;
  /** A finished marquee drag in the Select tool. */
  onSelectIds: (ids: string[], additive: boolean) => void;
  /** One pen/eraser gesture — the stroke plus its symmetry copies, committed as a single undo step. */
  onAddLines: (lines: LineData[]) => void;
  onPlaceObject: (placement: PendingPlacement, x: number, y: number) => void;
  /** Moves/transforms/text edits, batched so a multi-object drag is one undo step. */
  onUpdateObjects: (updates: ObjectUpdate[]) => void;
  onTextDragStateChange: (id: string, isDragging: boolean) => void;
  onStageReady?: (stage: Konva.Stage) => void;
  /** Fit-to-container scale × zoom (1 = native 595x842 size), computed by CanvasArea. Applied to the Stage itself (not a CSS transform) so Konva's own pointer-coordinate math stays correct — same approach components/interactive/KidsColoringCanvas.tsx already uses. */
  scale?: number;
}

interface ObjectHandlers {
  draggable: boolean;
  listening: boolean;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragStart: () => void;
  onCommit: () => void;
  registerNode: (id: string, node: Konva.Node | null) => void;
}

function selectionShadow(isSelected: boolean) {
  return { shadowColor: isSelected ? "#6366f1" : undefined, shadowBlur: isSelected ? 10 : 0, shadowOpacity: isSelected ? 0.6 : 0 };
}

function StampNode({ obj, draggable, listening, isSelected, onSelect, onDragStart, onCommit, registerNode }: ObjectHandlers & { obj: StampData }) {
  const [image] = useImage(obj.src, "anonymous");
  const imageNodeRef = useRef<Konva.Image | null>(null);

  // Konva filters only run on a cached bitmap, so the line-art filter is
  // applied here (once per image/filter/threshold change) rather than on
  // every render — caching is the expensive step, so we avoid redoing it
  // unless the inputs that actually affect the output have changed.
  useEffect(() => {
    const node = imageNodeRef.current;
    if (!node || !image) return;

    if (obj.filter === "lineArt") {
      node.cache();
      node.filters([Konva.Filters.Grayscale, Konva.Filters.Threshold]);
      node.threshold(obj.threshold ?? 0.5);
    } else {
      node.clearCache();
      node.filters([]);
    }
    node.getLayer()?.batchDraw();
  }, [image, obj.filter, obj.threshold]);

  return (
    <KonvaImage
      ref={(node) => {
        imageNodeRef.current = node;
        registerNode(obj.id, node);
      }}
      image={image}
      x={obj.x}
      y={obj.y}
      width={obj.width}
      height={obj.height}
      rotation={obj.rotation}
      scaleX={obj.scaleX}
      scaleY={obj.scaleY}
      draggable={draggable}
      listening={listening}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      onDragEnd={onCommit}
      onTransformEnd={onCommit}
      {...selectionShadow(isSelected)}
    />
  );
}

function ShapeNode({ obj, draggable, listening, isSelected, onSelect, onDragStart, onCommit, registerNode }: ObjectHandlers & { obj: ShapeData }) {
  const shadowProps = selectionShadow(isSelected);
  const common = {
    x: obj.x,
    y: obj.y,
    rotation: obj.rotation,
    scaleX: obj.scaleX,
    scaleY: obj.scaleY,
    draggable,
    listening,
    onClick: onSelect,
    onTap: onSelect,
    onDragStart,
    onDragEnd: onCommit,
    onTransformEnd: onCommit,
  };

  if (obj.shapeKind === "rectangle") {
    return (
      <Rect
        ref={(node) => registerNode(obj.id, node)}
        {...common}
        width={obj.width}
        height={obj.height}
        fill={obj.fill}
        stroke={obj.stroke}
        strokeWidth={obj.strokeWidth}
        {...shadowProps}
      />
    );
  }

  const { width: w, height: h } = obj;
  let body: React.ReactNode = null;
  if (obj.shapeKind === "circle") {
    body = <Ellipse x={w / 2} y={h / 2} radiusX={w / 2} radiusY={h / 2} fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} {...shadowProps} />;
  } else if (isPolygonShape(obj.shapeKind)) {
    body = <Line points={polygonPoints(obj.shapeKind, w, h)} closed fill={obj.fill} stroke={obj.stroke} strokeWidth={obj.strokeWidth} lineJoin="round" {...shadowProps} />;
  } else if (isOpenStroke(obj.shapeKind)) {
    // Open strokes ignore `fill`. The invisible Rect gives the thin
    // stroke a full-box hit area so it's easy to click and drag.
    const strokeProps = { points: [0, h / 2, w, h / 2], stroke: obj.stroke, strokeWidth: obj.strokeWidth, lineCap: "round" as const, ...shadowProps };
    const head = Math.max(obj.strokeWidth * 3, 12);
    body = (
      <>
        <Rect width={w} height={h} fill="transparent" />
        {obj.shapeKind === "arrow" ? <Arrow {...strokeProps} fill={obj.stroke} pointerLength={head} pointerWidth={head} /> : <Line {...strokeProps} />}
      </>
    );
  }

  return (
    <Group ref={(node) => registerNode(obj.id, node)} {...common}>
      {body}
    </Group>
  );
}

function TextNode({
  obj,
  draggable,
  listening,
  isSelected,
  onSelect,
  onDragStart,
  onCommit,
  registerNode,
  onDragStateChange,
  onStartEditing,
  hidden,
}: ObjectHandlers & {
  obj: TextData;
  onDragStateChange: (isDragging: boolean) => void;
  onStartEditing: () => void;
  hidden: boolean;
}) {
  const selected = selectionShadow(isSelected);
  return (
    <KonvaText
      ref={(node) => registerNode(obj.id, node)}
      text={obj.text}
      fontFamily={obj.fontFamily}
      fontSize={obj.fontSize}
      align={obj.align}
      width={obj.width}
      // Outline text = hollow letters a child can color in.
      fill={obj.outline ? "#ffffff" : obj.fill}
      stroke={obj.outline ? obj.fill : undefined}
      strokeWidth={obj.outline ? Math.max(1.5, obj.fontSize * 0.045) : 0}
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      scaleX={obj.scaleX}
      scaleY={obj.scaleY}
      visible={!hidden}
      draggable={draggable}
      listening={listening}
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onStartEditing}
      onDblTap={onStartEditing}
      onDragStart={() => {
        onDragStart();
        onDragStateChange(true);
      }}
      onDragEnd={() => {
        onDragStateChange(false);
        onCommit();
      }}
      onTransformEnd={onCommit}
      shadowColor={obj.isDragging ? "#000000" : selected.shadowColor}
      shadowBlur={obj.isDragging ? 12 : selected.shadowBlur}
      shadowOpacity={obj.isDragging ? 0.35 : selected.shadowOpacity}
    />
  );
}

function BackgroundPatternLayer({ patternId, width, height }: { patternId: string; width: number; height: number }) {
  const pattern = getBackgroundPattern(patternId);
  const [tileImage] = useImage(pattern ? `data:image/svg+xml;utf8,${encodeURIComponent(pattern.svg)}` : "");
  if (!pattern || !tileImage) return null;

  return (
    <Layer listening={false}>
      <Rect x={0} y={0} width={width} height={height} fillPatternImage={tileImage} fillPatternRepeat="repeat" fillPatternScale={{ x: 1, y: 1 }} />
    </Layer>
  );
}

function GuidesLayer({ spec, width, height }: { spec: GuideSpec; width: number; height: number }) {
  const { trim } = spec;
  const hasBleed = trim.left > 0 || trim.top > 0 || trim.right < width || trim.bottom < height;
  return (
    <Layer listening={false} name={OVERLAY_NAME}>
      {hasBleed && (
        // Everything past the trim gets cut off: tint it so nobody puts a face there.
        <Group opacity={0.09}>
          <Rect x={0} y={0} width={width} height={trim.top} fill={TRIM_COLOR} />
          <Rect x={0} y={trim.bottom} width={width} height={height - trim.bottom} fill={TRIM_COLOR} />
          <Rect x={0} y={trim.top} width={trim.left} height={trim.bottom - trim.top} fill={TRIM_COLOR} />
          <Rect x={trim.right} y={trim.top} width={width - trim.right} height={trim.bottom - trim.top} fill={TRIM_COLOR} />
        </Group>
      )}
      {spec.center && (
        <>
          <Line points={[width / 2, 0, width / 2, height]} stroke={GUIDE_COLOR} strokeWidth={0.75} opacity={0.35} dash={[3, 5]} />
          <Line points={[0, height / 2, width, height / 2]} stroke={GUIDE_COLOR} strokeWidth={0.75} opacity={0.35} dash={[3, 5]} />
        </>
      )}
      {spec.safe.map((r, i) => (
        <Rect key={`safe-${i}`} x={r.left} y={r.top} width={r.right - r.left} height={r.bottom - r.top} stroke={GUIDE_COLOR} strokeWidth={1.25} dash={[6, 5]} opacity={0.8} />
      ))}
      {spec.folds?.map((pts, i) => <Line key={`fold-${i}`} points={pts} stroke={FOLD_COLOR} strokeWidth={1.25} dash={[4, 4]} />)}
      {spec.blocked?.map((r, i) => (
        <Group key={`blocked-${i}`}>
          <Rect x={r.left} y={r.top} width={r.right - r.left} height={r.bottom - r.top} fill="#6b7280" opacity={0.12} stroke="#6b7280" strokeWidth={1} dash={[3, 3]} />
          <KonvaText x={r.left} y={(r.top + r.bottom) / 2 - 5} width={r.right - r.left} align="center" text="BARCODE AREA" fontSize={8} fontFamily="ui-monospace, monospace" letterSpacing={1} fill="#6b7280" />
        </Group>
      ))}
      <Rect
        x={trim.left + 0.75}
        y={trim.top + 0.75}
        width={trim.right - trim.left - 1.5}
        height={trim.bottom - trim.top - 1.5}
        stroke={TRIM_COLOR}
        strokeWidth={1.5}
        opacity={0.55}
      />
      {spec.labels?.map((l, i) => (
        <KonvaText key={`label-${i}`} x={l.x} y={l.y} text={l.text} fontSize={8} fontFamily="ui-monospace, monospace" letterSpacing={1} fill={l.color ?? GUIDE_COLOR} opacity={0.8} />
      ))}
    </Layer>
  );
}

interface EditingText {
  id: string;
  value: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  align: TextData["align"];
  fill: string;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
}

export default function CanvasEditor({
  page,
  space,
  guides,
  tool,
  strokeWidth,
  pendingPlacement,
  selectedIds,
  showGrid,
  showGuides,
  symmetry = "off",
  smoothing = 0,
  gapMarkers,
  backgroundPatternId,
  isCover,
  coverBackgroundColor,
  mode = "draw",
  activeColor = "#000000",
  onSampleColor,
  onFillChange,
  undoFillSignal,
  onCanUndoFillChange,
  onSelectObject,
  onSelectIds,
  onAddLines,
  onPlaceObject,
  onUpdateObjects,
  onTextDragStateChange,
  onStageReady,
  scale = 1,
}: CanvasEditorProps) {
  const pageWidth = space.width;
  const pageHeight = space.height;
  const guideSpec = guides ?? interiorGuides(geometryFromSpace(space));
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const objectNodesRef = useRef<Map<string, Konva.Node>>(new Map());
  const isDrawing = useRef(false);
  const lastStabilizedRef = useRef<[number, number] | null>(null);
  const [draftLine, setDraftLine] = useState<LineData | null>(null);
  const [editingText, setEditingText] = useState<EditingText | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  // Latest selection for the batched commit below, which runs from Konva
  // event handlers that may close over an older render's props.
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  // Color mode's persistent paint surface. `useState` with a lazy
  // initializer, not a ref read during render — a ref's `.current` may
  // never be read (or written) while rendering, only in effects/handlers;
  // creating the canvas as state instead means the JSX below can
  // reference it directly and stay a pure read. Rendered as a KonvaImage
  // in its own Layer, beneath the ink/objects Layer (see the Layer order
  // below) — "flood fill on the active layer beneath the locked line-art
  // layer" made literal.
  function createFillCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    return canvas;
  }
  const [fillCanvas, setFillCanvas] = useState<HTMLCanvasElement>(createFillCanvas);
  const fillImageRef = useRef<Konva.Image | null>(null);
  const mainLayerRef = useRef<Konva.Layer | null>(null);
  const longPressRef = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);

  // Per-page fill undo stack — pre-fill snapshots of the paint canvas, so
  // stepping back restores exactly what was there before the last commit.
  // Capped (MAX_FILL_HISTORY) rather than unbounded: each entry is a
  // full-page PNG data URL, so an uncapped stack on a long coloring
  // session would leak memory.
  const fillHistoryRef = useRef<string[]>([]);

  // A new page (different BookPage.id) gets a fresh, blank fill surface
  // — fills are per-page paint, not a global canvas that would otherwise
  // leak page 3's colors onto page 4's. This is a real, working
  // implementation, not the 3a demo fixture: what a child paints here is
  // what stays painted, per page, across page navigation. Resetting state
  // keyed off a changing id from an effect is the same intentional
  // pattern SvgNormalizer.tsx uses for its loading-state reset.
  useEffect(() => {
    const canvas = createFillCanvas();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFillCanvas(canvas);
    fillHistoryRef.current = [];
    onCanUndoFillChange?.(false);
    if (!page.fillDataUrl) return;
    const img = new window.Image();
    img.onload = () => {
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      fillImageRef.current?.getLayer()?.batchDraw();
    };
    img.src = page.fillDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, pageWidth, pageHeight]);

  // Real per-fill undo — pops fillHistoryRef and redraws that snapshot.
  // See undoFillSignal's own doc for why this is a signal bump, not a
  // direct method call (same pattern as the old clearFillsSignal it
  // replaces: no ref-to-parent imperative handle exists here).
  const isFirstUndoSignal = useRef(true);
  useEffect(() => {
    if (isFirstUndoSignal.current) {
      isFirstUndoSignal.current = false;
      return;
    }
    const previous = fillHistoryRef.current.pop();
    onCanUndoFillChange?.(fillHistoryRef.current.length > 0);
    if (previous === undefined) return;

    const img = new window.Image();
    img.onload = () => {
      const ctx = fillCanvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, pageWidth, pageHeight);
      ctx.drawImage(img, 0, 0);
      fillImageRef.current?.getLayer()?.batchDraw();
      onFillChange?.(fillCanvas.toDataURL());
    };
    img.src = previous;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoFillSignal]);

  // Web fonts (the text tool's kid-friendly faces) can finish loading after
  // Konva first measured and drew the text — redraw once they're ready.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    const redraw = () => mainLayerRef.current?.batchDraw();
    void ensureKidFonts().then(redraw);
    document.fonts.addEventListener("loadingdone", redraw);
    return () => document.fonts.removeEventListener("loadingdone", redraw);
  }, []);

  const isFreehand = tool === "pen" || tool === "eraser";
  const isFillTool = mode === "color" && tool === "fill";

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const selectable = new Set(page.objects.filter((o) => !o.locked && !o.hidden).map((o) => o.id));
    const nodes = selectedIds.filter((id) => selectable.has(id)).flatMap((id) => objectNodesRef.current.get(id) ?? []);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, page.objects]);

  function registerObjectNode(id: string, node: Konva.Node | null) {
    if (node) objectNodesRef.current.set(id, node);
    else objectNodesRef.current.delete(id);
  }

  // A multi-object drag/transform fires dragend/transformend once per
  // node; coalesce them into one batched update (= one undo step) by
  // reading every affected node's final attrs after the event burst.
  const commitQueuedRef = useRef(false);
  function queueCommit(sourceId: string) {
    if (commitQueuedRef.current) return;
    commitQueuedRef.current = true;
    queueMicrotask(() => {
      commitQueuedRef.current = false;
      const selection = selectedIdsRef.current;
      const ids = selection.includes(sourceId) ? selection : [sourceId];
      const updates: ObjectUpdate[] = [];
      for (const id of ids) {
        const node = objectNodesRef.current.get(id);
        if (!node) continue;
        const changes: ObjectChanges = { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() };
        updates.push({ id, changes });
      }
      if (updates.length) onUpdateObjects(updates);
    });
  }

  function startEditingText(obj: TextData) {
    onSelectObject(null, false);
    setEditingText({
      id: obj.id,
      value: obj.text,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      fontSize: obj.fontSize,
      fontFamily: obj.fontFamily,
      align: obj.align,
      fill: obj.fill,
      rotation: obj.rotation,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
    });
  }

  function commitTextEdit() {
    if (!editingText) return;
    onUpdateObjects([{ id: editingText.id, changes: { text: editingText.value } }]);
    setEditingText(null);
  }

  /**
   * Boundary snapshot = the ink/objects Layer's own rendered pixels (see
   * the module-level note on why stamps/shapes count as walls too, not
   * just pen lines). A layer's `toCanvas()` output is sized to the
   * Stage's CURRENT rendered size — now that the Stage can be scaled
   * (fit-to-container and zoom), that's `pageWidth * scale`, not the
   * native page size the flood-fill math and pointer coordinates both assume.
   * `pixelRatio: 1 / scale` compensates, normalizing the snapshot back to
   * native page size regardless of how large the Stage is currently rendered.
   */
  function getBoundarySnapshot(): PixelBuffer | null {
    const stage = mainLayerRef.current?.getStage();
    return stage ? captureInk(stage) : null;
  }

  // Returns the ORIGINAL ImageData object alongside a PixelBuffer view
  // over the same `.data` array — floodFill() mutates that array in
  // place, so putImageData can reuse imageData directly afterward.
  // Constructing a *new* ImageData from a detached Uint8ClampedArray hits
  // a real TS lib typing mismatch (ImageDataArray wants a plain
  // ArrayBuffer, not the broader ArrayBufferLike a typed array's own
  // .buffer is typed as) — reusing the original sidesteps that entirely,
  // and is simpler besides.
  function getFillTarget(): { ctx: CanvasRenderingContext2D; imageData: ImageData; buffer: PixelBuffer } | null {
    const ctx = fillCanvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.getImageData(0, 0, pageWidth, pageHeight);
    return { ctx, imageData, buffer: { width: imageData.width, height: imageData.height, data: imageData.data } };
  }

  function performFillAt(x: number, y: number) {
    const boundary = getBoundarySnapshot();
    const target = getFillTarget();
    if (!boundary || !target) return;

    const result = floodFill(boundary, target.buffer, x, y, hexToRgba(activeColor));
    if (!result.filled) return;

    // Snapshot BEFORE writing the fill back to the canvas, so this is the
    // pre-fill state undoFillSignal restores to.
    fillHistoryRef.current = [...fillHistoryRef.current, fillCanvas.toDataURL()].slice(-MAX_FILL_HISTORY);
    onCanUndoFillChange?.(true);

    target.ctx.putImageData(target.imageData, 0, 0);
    fillImageRef.current?.getLayer()?.batchDraw();
    onFillChange?.(fillCanvas.toDataURL());
  }

  function sampleFillAt(x: number, y: number) {
    const target = getFillTarget();
    if (!target) return;
    const sampled = samplePixelColor(target.buffer, x, y);
    if (sampled) onSampleColor?.(rgbaToHex(sampled));
  }

  /** Pointer position in page units (the Stage is scaled; getPointerPosition is in screen pixels). */
  function pagePointer(stage: Konva.Stage | null | undefined): { x: number; y: number } | null {
    const pos = stage?.getRelativePointerPosition();
    return pos ?? null;
  }

  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    const stage = e.target.getStage();
    const pos = pagePointer(stage);
    if (!stage || !pos) return;

    if (editingText) commitTextEdit();

    if (pendingPlacement) {
      onPlaceObject(pendingPlacement, pos.x, pos.y);
      return;
    }

    if (isFillTool) {
      // Long-press samples instead of painting — mirrors 3a's demo
      // interaction (tap fills, hold samples), now against real per-
      // pixel paint. Fill itself is committed on release (see
      // handlePointerUp) so a long-press that fires the sample doesn't
      // ALSO paint over what it just sampled.
      const timer = setTimeout(() => {
        if (!longPressRef.current) return;
        longPressRef.current.fired = true;
        sampleFillAt(longPressRef.current.x, longPressRef.current.y);
      }, LONG_PRESS_MS);
      longPressRef.current = { x: pos.x, y: pos.y, timer, fired: false };
      return;
    }

    if (tool === "select") {
      // Empty page (every non-object layer is listening={false}, so the
      // target is the Stage itself): start a marquee selection.
      if (e.target === stage) setMarquee({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, additive: e.evt.shiftKey });
      return;
    }

    if (isFreehand) {
      isDrawing.current = true;
      lastStabilizedRef.current = [pos.x, pos.y];
      setDraftLine({ id: makeLineId(), tool, strokeWidth, points: [pos.x, pos.y] });
    }
  }

  function handlePointerMove(e: Konva.KonvaEventObject<PointerEvent>) {
    const stage = e.target.getStage();
    if (longPressRef.current) {
      const pos = pagePointer(stage);
      if (pos && (Math.abs(pos.x - longPressRef.current.x) > MOVE_CANCEL_PX || Math.abs(pos.y - longPressRef.current.y) > MOVE_CANCEL_PX)) {
        clearTimeout(longPressRef.current.timer);
        longPressRef.current = null;
      }
      return;
    }

    if (marquee) {
      const pos = pagePointer(stage);
      if (pos) setMarquee({ ...marquee, x1: pos.x, y1: pos.y });
      return;
    }

    if (!isDrawing.current || !draftLine) return;
    const pos = pagePointer(stage);
    if (!pos) return;
    const [px, py] = lastStabilizedRef.current ?? [pos.x, pos.y];
    const [x, y] = stabilize(px, py, pos.x, pos.y, smoothing);
    lastStabilizedRef.current = [x, y];
    setDraftLine({ ...draftLine, points: [...draftLine.points, x, y] });
  }

  function handlePointerUp(e: Konva.KonvaEventObject<PointerEvent>) {
    if (longPressRef.current) {
      const press = longPressRef.current;
      clearTimeout(press.timer);
      longPressRef.current = null;
      if (!press.fired) performFillAt(press.x, press.y); // released before the long-press threshold — a tap, so paint
      return;
    }

    if (marquee) {
      finishMarquee(marquee);
      setMarquee(null);
      return;
    }

    if (!isDrawing.current || !draftLine) return;
    isDrawing.current = false;
    // The stabilizer trails the pointer — finish the stroke where the pointer actually is.
    const pos = pagePointer(e.target.getStage());
    const raw = pos ? [...draftLine.points, pos.x, pos.y] : draftLine.points;
    if (raw.length > 2) {
      const points = smoothStroke(raw, smoothing);
      const main: LineData = { ...draftLine, points };
      const copies = symmetricCopies(points, symmetry, pageWidth / 2, pageHeight / 2).map((pts) => ({ ...draftLine, id: makeLineId(), points: pts }));
      onAddLines([main, ...copies]);
    }
    setDraftLine(null);
    lastStabilizedRef.current = null;
  }

  function finishMarquee(m: Marquee) {
    const left = Math.min(m.x0, m.x1);
    const right = Math.max(m.x0, m.x1);
    const top = Math.min(m.y0, m.y1);
    const bottom = Math.max(m.y0, m.y1);
    if ((right - left) * scale < MARQUEE_MIN_PX && (bottom - top) * scale < MARQUEE_MIN_PX) {
      // A plain click on empty page.
      if (!m.additive) onSelectObject(null, false);
      return;
    }
    const ids = page.objects
      .filter((o) => !o.locked && !o.hidden)
      .filter((o) => {
        const b = objectBounds(o);
        return b.left < right && b.right > left && b.top < bottom && b.bottom > top;
      })
      .map((o) => o.id);
    onSelectIds(ids, m.additive);
  }

  const draftCopies = draftLine ? symmetricCopies(draftLine.points, symmetry, pageWidth / 2, pageHeight / 2) : [];
  const axes = isFreehand && mode === "draw" ? symmetryAxes(symmetry, pageWidth, pageHeight) : [];

  return (
    <div className="relative overflow-hidden rounded-lg bg-white shadow-md" style={{ width: pageWidth * scale, height: pageHeight * scale }}>
      <Stage
        ref={(node) => {
          if (node) onStageReady?.(node);
        }}
        width={pageWidth * scale}
        height={pageHeight * scale}
        scaleX={scale}
        scaleY={scale}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: tool === "select" ? "default" : isFillTool ? "pointer" : "crosshair", touchAction: "none" }}
      >
        {isCover && (
          <Layer listening={false}>
            <Rect x={0} y={0} width={pageWidth} height={pageHeight} fill={coverBackgroundColor ?? "#ffffff"} />
          </Layer>
        )}

        {backgroundPatternId && <BackgroundPatternLayer patternId={backgroundPatternId} width={pageWidth} height={pageHeight} />}

        {/* Color mode's paint, beneath the ink/objects layer — "flood
            fill on the active layer beneath the locked line-art layer"
            (README) made literal. listening={false}: clicks go to the
            Stage/main layer's pointer handlers above, not this image. */}
        <Layer listening={false}>
          <KonvaImage
            ref={(node) => {
              fillImageRef.current = node;
            }}
            image={fillCanvas}
            width={pageWidth}
            height={pageHeight}
          />
        </Layer>

        {showGrid && (
          <Layer listening={false} name={OVERLAY_NAME}>
            {Array.from({ length: Math.floor(pageWidth / GRID_SIZE) + 1 }, (_, i) => (
              <Line key={`grid-v-${i}`} points={[i * GRID_SIZE, 0, i * GRID_SIZE, pageHeight]} stroke="#e2e8f0" strokeWidth={1} />
            ))}
            {Array.from({ length: Math.floor(pageHeight / GRID_SIZE) + 1 }, (_, i) => (
              <Line key={`grid-h-${i}`} points={[0, i * GRID_SIZE, pageWidth, i * GRID_SIZE]} stroke="#e2e8f0" strokeWidth={1} />
            ))}
          </Layer>
        )}

        <Layer ref={mainLayerRef} name={INK_LAYER_NAME}>
          {page.objects.map((obj) => {
            if (obj.hidden) return null;
            const interactive = tool === "select" && !obj.locked;
            const handlers: ObjectHandlers = {
              draggable: interactive,
              listening: !obj.locked,
              isSelected: selectedIds.includes(obj.id),
              onSelect: (e) => {
                if (tool !== "select" || obj.locked) return;
                e.cancelBubble = true;
                onSelectObject(obj.id, "shiftKey" in e.evt && e.evt.shiftKey);
              },
              onDragStart: () => {
                if (!selectedIdsRef.current.includes(obj.id)) onSelectObject(obj.id, false);
              },
              onCommit: () => queueCommit(obj.id),
              registerNode: registerObjectNode,
            };

            if (obj.kind === "stamp") return <StampNode key={obj.id} obj={obj} {...handlers} />;
            if (obj.kind === "shape") return <ShapeNode key={obj.id} obj={obj} {...handlers} />;
            return (
              <TextNode
                key={obj.id}
                obj={obj}
                {...handlers}
                onDragStateChange={(isDragging) => onTextDragStateChange(obj.id, isDragging)}
                onStartEditing={() => !obj.locked && startEditingText(obj)}
                hidden={editingText?.id === obj.id}
              />
            );
          })}

          {page.lines.map((line) => (
            <Line
              key={line.id}
              points={line.points}
              stroke={PEN_COLOR}
              strokeWidth={line.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              listening={false}
              globalCompositeOperation={line.tool === "eraser" ? "destination-out" : "source-over"}
            />
          ))}

          {draftLine &&
            [draftLine.points, ...draftCopies].map((points, i) => (
              <Line
                key={`draft-${i}`}
                points={points}
                stroke={PEN_COLOR}
                strokeWidth={draftLine.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                listening={false}
                globalCompositeOperation={draftLine.tool === "eraser" ? "destination-out" : "source-over"}
              />
            ))}

          <Transformer ref={transformerRef} name={OVERLAY_NAME} rotateEnabled flipEnabled={false} ignoreStroke />
        </Layer>

        {showGuides && <GuidesLayer spec={guideSpec} width={pageWidth} height={pageHeight} />}

        {(axes.length > 0 || marquee || (gapMarkers && gapMarkers.length > 0)) && (
          <Layer listening={false} name={OVERLAY_NAME}>
            {axes.map((pts, i) => (
              <Line key={`axis-${i}`} points={pts} stroke="#e0a13c" strokeWidth={1} dash={[8, 6]} opacity={0.9} />
            ))}
            {gapMarkers?.map((m, i) => (
              <Group key={`gap-${i}`}>
                <Circle x={m.x} y={m.y} radius={m.r} stroke="#c4453f" strokeWidth={2.5} dash={[5, 3]} />
                <Circle x={m.x} y={m.y} radius={m.r} fill="#c4453f" opacity={0.12} />
              </Group>
            ))}
            {marquee && (
              <Rect
                x={Math.min(marquee.x0, marquee.x1)}
                y={Math.min(marquee.y0, marquee.y1)}
                width={Math.abs(marquee.x1 - marquee.x0)}
                height={Math.abs(marquee.y1 - marquee.y0)}
                fill="rgba(51, 87, 212, 0.08)"
                stroke={GUIDE_COLOR}
                strokeWidth={1 / scale}
                dash={[4 / scale, 3 / scale]}
              />
            )}
          </Layer>
        )}
      </Stage>

      {editingText && (
        <textarea
          autoFocus
          value={editingText.value}
          onChange={(e) => setEditingText({ ...editingText, value: e.target.value })}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingText(null);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitTextEdit();
            }
          }}
          style={{
            // The Stage is scaled (fit × zoom) and the text node may be too —
            // position and size the editor in screen pixels to sit exactly over it.
            position: "absolute",
            top: editingText.y * scale,
            left: editingText.x * scale,
            width: editingText.width * scale * Math.abs(editingText.scaleX),
            fontSize: editingText.fontSize * scale * Math.abs(editingText.scaleY),
            fontFamily: editingText.fontFamily,
            textAlign: editingText.align,
            color: editingText.fill,
            lineHeight: 1.2,
            transform: `rotate(${editingText.rotation}deg)`,
            transformOrigin: "top left",
            border: "2px solid #6366f1",
            borderRadius: 4,
            padding: 2,
            margin: 0,
            background: "white",
            resize: "none",
            overflow: "hidden",
            outline: "none",
          }}
        />
      )}
    </div>
  );
}
