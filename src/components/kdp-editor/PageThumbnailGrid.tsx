"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";
import type { PageSpread } from "@/types/kdpBook";
import TwoPageSpreadEditor from "@/components/kdp-editor/TwoPageSpreadEditor";
import { DEFAULT_PRINT_SPEC } from "@/lib/kdpPrintSpec";

export interface PageThumbnailGridProps {
  spreads: PageSpread[];
  activeSpreadId: string | null;
  onSelectSpread: (id: string) => void;
  onReorder: (spreads: PageSpread[]) => void;
}

const THUMB_PX_PER_INCH = 11;

/** Small scaled-down real spread renders (not schematic placeholders) — plain SVG/DOM, so this stays cheap even at 26+ thumbnails. Reorder via native HTML5 drag-and-drop, no extra dependency needed. */
export default function PageThumbnailGrid({ spreads, activeSpreadId, onSelectSpread, onReorder }: PageThumbnailGridProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = spreads.findIndex((s) => s.id === draggedId);
    const toIndex = spreads.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...spreads];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next.map((spread, i) => ({ ...spread, spreadNumber: i + 1 })));
    setDraggedId(null);
    setDragOverId(null);
  }

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
      {spreads.map((spread) => (
        <div
          key={spread.id}
          draggable
          onDragStart={() => setDraggedId(spread.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(spread.id);
          }}
          onDragLeave={() => setDragOverId((id) => (id === spread.id ? null : id))}
          onDrop={() => handleDrop(spread.id)}
          onDragEnd={() => {
            setDraggedId(null);
            setDragOverId(null);
          }}
          onClick={() => onSelectSpread(spread.id)}
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded border-2 border-slate-200 bg-white transition",
            spread.id === activeSpreadId && "border-indigo-500",
            dragOverId === spread.id && draggedId !== spread.id && "border-indigo-400 ring-2 ring-indigo-300",
            draggedId === spread.id && "opacity-40"
          )}
          title={`Spread ${spread.spreadNumber}`}
        >
          <div className="pointer-events-none flex origin-top-left scale-100">
            <TwoPageSpreadEditor spread={spread} printSpec={DEFAULT_PRINT_SPEC} pxPerInch={THUMB_PX_PER_INCH} showGuides={false} />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
            <span>{spread.spreadNumber}</span>
            <GripVertical size={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
