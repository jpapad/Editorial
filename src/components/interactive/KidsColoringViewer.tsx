"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type Konva from "konva";
import { Undo2, RotateCcw, Download, Eraser } from "lucide-react";
import { cn } from "@/utils/cn";
import { STAGE_HEIGHT, STAGE_WIDTH, type PaintStroke } from "@/components/interactive/KidsColoringCanvas";

// Konva touches `window`/`document` at import time, so the canvas must never render on the server.
const KidsColoringCanvas = dynamic(() => import("@/components/interactive/KidsColoringCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="mx-auto w-full animate-pulse rounded-[2rem] bg-white/50"
      style={{ maxWidth: STAGE_WIDTH, aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}` }}
    />
  ),
});

interface PaletteColor {
  name: string;
  hex: string;
}

const COLORS: PaletteColor[] = [
  { name: "Red", hex: "#ef4444" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Green", hex: "#22c55e" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Orange", hex: "#f97316" },
  { name: "Black", hex: "#1f2937" },
  { name: "White", hex: "#ffffff" },
];

const BRUSH_SIZES: { label: string; value: number }[] = [
  { label: "Small", value: 10 },
  { label: "Medium", value: 24 },
  { label: "Large", value: 42 },
];

export interface KidsColoringViewerProps {
  lineArtSrc: string;
  title?: string;
}

export default function KidsColoringViewer({ lineArtSrc, title = "My Coloring Page" }: KidsColoringViewerProps) {
  const [strokes, setStrokes] = useState<PaintStroke[]>([]);
  const [color, setColor] = useState<string>(COLORS[0].hex);
  const [brushSize, setBrushSize] = useState<number>(BRUSH_SIZES[1].value);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const stageRef = useRef<Konva.Stage | null>(null);

  function handleAddStroke(stroke: PaintStroke) {
    setStrokes((prev) => [...prev, stroke]);
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
  }

  function handleReset() {
    if (strokes.length === 0) return;
    if (!window.confirm("Clear all your coloring and start this page over?")) return;
    setStrokes([]);
  }

  function handleDownload() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "my-masterpiece.png";
    link.click();
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <h1 className="text-center text-3xl font-bold text-white drop-shadow-md sm:text-4xl">{title}</h1>

      <KidsColoringCanvas
        lineArtSrc={lineArtSrc}
        tool={tool}
        color={color}
        brushSize={brushSize}
        strokes={strokes}
        onAddStroke={handleAddStroke}
        onStageReady={(stage) => {
          stageRef.current = stage;
        }}
      />

      <div className="flex w-full max-w-3xl flex-col gap-4 rounded-[2rem] bg-white/90 p-4 shadow-2xl backdrop-blur sm:p-6">
        {/* Color palette — big, bright, touch-friendly swatches */}
        <div className="flex flex-wrap justify-center gap-3">
          {COLORS.map(({ name, hex }) => (
            <button
              key={hex}
              type="button"
              aria-label={name}
              title={name}
              onClick={() => {
                setColor(hex);
                setTool("brush");
              }}
              className={cn(
                "h-12 w-12 shrink-0 rounded-full border-2 border-black/10 shadow-sm transition-transform active:scale-90 sm:h-14 sm:w-14",
                tool === "brush" && color === hex && "scale-110 ring-4 ring-indigo-400 ring-offset-2"
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Brush size */}
          <div className="flex items-center gap-1.5 rounded-full bg-slate-100 p-1.5">
            {BRUSH_SIZES.map(({ label, value }) => (
              <button
                key={label}
                type="button"
                onClick={() => setBrushSize(value)}
                aria-label={`${label} brush`}
                title={`${label} brush`}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors sm:h-12 sm:w-12",
                  brushSize === value && "bg-white shadow"
                )}
              >
                <span
                  className="rounded-full bg-slate-700"
                  style={{ width: value * 0.5, height: value * 0.5 }}
                />
              </button>
            ))}
          </div>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => setTool("eraser")}
            aria-label="Eraser"
            title="Eraser"
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors sm:h-14 sm:w-14",
              tool === "eraser" && "bg-indigo-500 text-white"
            )}
          >
            <Eraser size={22} />
          </button>

          <div className="h-8 w-px bg-slate-200" />

          {/* Undo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            aria-label="Undo"
            title="Undo"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-opacity disabled:opacity-30 sm:h-14 sm:w-14"
          >
            <Undo2 size={22} />
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset page"
            title="Reset page"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 sm:h-14 sm:w-14"
          >
            <RotateCcw size={22} />
          </button>

          <div className="h-8 w-px bg-slate-200" />

          {/* Save */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 sm:text-base"
          >
            <Download size={20} />
            Save My Picture
          </button>
        </div>
      </div>
    </div>
  );
}
