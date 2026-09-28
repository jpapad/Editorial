"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import type Konva from "konva";

export interface PaintStroke {
  id: string;
  tool: "brush" | "eraser";
  color: string;
  size: number;
  points: number[]; // flattened [x1, y1, x2, y2, ...], Konva's native Line format
}

// The line-art layer is drawn at this fixed resolution; the container
// scales the whole stage to fit the viewport (see the ResizeObserver
// below), so strokes stay aligned regardless of screen size.
export const STAGE_WIDTH = 700;
export const STAGE_HEIGHT = 900;

interface KidsColoringCanvasProps {
  lineArtSrc: string;
  tool: "brush" | "eraser";
  color: string;
  brushSize: number;
  strokes: PaintStroke[];
  onAddStroke: (stroke: PaintStroke) => void;
  onStageReady?: (stage: Konva.Stage) => void;
}

export default function KidsColoringCanvas({
  lineArtSrc,
  tool,
  color,
  brushSize,
  strokes,
  onAddStroke,
  onStageReady,
}: KidsColoringCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const isDrawing = useRef(false);
  const [draftStroke, setDraftStroke] = useState<PaintStroke | null>(null);
  const [lineArtImage] = useImage(lineArtSrc, "anonymous");

  // Fit the fixed-resolution stage to whatever width the flex layout gives
  // it — this is what makes drawing comfortable on an iPad/tablet instead
  // of being pinned to a small desktop-sized canvas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(Math.min(width / STAGE_WIDTH, 1.3));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    isDrawing.current = true;
    setDraftStroke({
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tool,
      color,
      size: brushSize,
      points: [pos.x, pos.y],
    });
  }

  function handlePointerMove(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!isDrawing.current || !draftStroke) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setDraftStroke({ ...draftStroke, points: [...draftStroke.points, pos.x, pos.y] });
  }

  function handlePointerUp() {
    if (!isDrawing.current || !draftStroke) return;
    isDrawing.current = false;
    if (draftStroke.points.length > 2) onAddStroke(draftStroke);
    setDraftStroke(null);
  }

  return (
    <div ref={containerRef} className="mx-auto w-full" style={{ maxWidth: STAGE_WIDTH }}>
      <div
        className="mx-auto overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-8 ring-white/70"
        style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
      >
        <Stage
          ref={(node) => {
            if (node) onStageReady?.(node);
          }}
          width={STAGE_WIDTH * scale}
          height={STAGE_HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none", cursor: "crosshair" }}
        >
          {/* Kid's paint strokes — sits below the line art so outlines stay sharp. */}
          <Layer>
            {strokes.map((stroke) => (
              <Line
                key={stroke.id}
                points={stroke.points}
                stroke={stroke.color}
                strokeWidth={stroke.size}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={stroke.tool === "eraser" ? "destination-out" : "source-over"}
              />
            ))}
            {draftStroke && (
              <Line
                points={draftStroke.points}
                stroke={draftStroke.color}
                strokeWidth={draftStroke.size}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={draftStroke.tool === "eraser" ? "destination-out" : "source-over"}
              />
            )}
          </Layer>

          {/* Black line-art contours — transparent everywhere else, always on top. */}
          <Layer listening={false}>
            <KonvaImage image={lineArtImage} width={STAGE_WIDTH} height={STAGE_HEIGHT} />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
