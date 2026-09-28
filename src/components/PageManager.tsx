"use client";

import { useState } from "react";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import TwoPageSpreadEditor from "@/components/TwoPageSpreadEditor";
import type { BookSettings, PageData, PageSpread } from "@/types/book";

export interface PageManagerProps {
  spreads: PageSpread[];
  activeSpreadId: string | null;
  settings: BookSettings;
  onSelectSpread: (id: string) => void;
  onReorder: (spreads: PageSpread[]) => void;
  onDuplicate: (spreadId: string) => void;
  onDelete: (spreadId: string) => void;
}

const THUMB_SCALE = 0.1;
const PX_PER_INCH = 96; // CSS's native physical-unit conversion — matches TwoPageSpreadEditor's `${n}in` sizing
// Coupled to TwoPageSpreadEditor's own p-8 (32px) padding + gap-px (1px)
// between its two pages — if that component's spacing classes change,
// these need to move with it.
const SPREAD_PADDING_PX = 64;
const SPREAD_GAP_PX = 1;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function duplicatePage(page: PageData): PageData {
  return {
    ...page,
    id: makeId("page"),
    elements: page.elements.map((el) => ({ ...el, id: makeId(el.type.toLowerCase()) })),
  };
}

/** Deep-clones a spread with fresh ids for every page and element — exported so callers can build "duplicate" behavior without depending on the component's internals. */
export function duplicateSpread(spread: PageSpread): PageSpread {
  return {
    ...spread,
    id: makeId("spread"),
    leftPage: duplicatePage(spread.leftPage),
    rightPage: duplicatePage(spread.rightPage),
  };
}

/**
 * Drag-and-drop thumbnail bar for reordering, duplicating, and deleting
 * spreads. Thumbnails are real, scaled-down TwoPageSpreadEditor renders
 * (via a CSS transform: scale, since that component has no scale prop of
 * its own) rather than a schematic placeholder — plain SVG/DOM, so this
 * stays cheap even with dozens of spreads.
 */
export default function PageManager({ spreads, activeSpreadId, settings, onSelectSpread, onReorder, onDuplicate, onDelete }: PageManagerProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const naturalWidth = settings.trimWidthIn * PX_PER_INCH * 2 + SPREAD_GAP_PX + SPREAD_PADDING_PX;
  const naturalHeight = settings.trimHeightIn * PX_PER_INCH + SPREAD_PADDING_PX;

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
    <div className="flex items-center gap-3 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <span className="shrink-0 text-xs font-medium text-slate-400">Pages</span>
      <ul className="flex items-center gap-3">
        {spreads.map((spread) => (
          <li
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
              "group relative shrink-0 cursor-pointer overflow-hidden rounded border-2 border-slate-200 bg-white transition",
              spread.id === activeSpreadId && "border-indigo-500",
              dragOverId === spread.id && draggedId !== spread.id && "border-indigo-400 ring-2 ring-indigo-300",
              draggedId === spread.id && "opacity-40"
            )}
            style={{ width: naturalWidth * THUMB_SCALE, height: naturalHeight * THUMB_SCALE }}
            title={`Spread ${spread.spreadNumber}`}
          >
            <div
              className="pointer-events-none origin-top-left"
              style={{ transform: `scale(${THUMB_SCALE})`, width: naturalWidth, height: naturalHeight }}
            >
              <TwoPageSpreadEditor spread={spread} settings={settings} showGuides={false} />
            </div>

            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
              <span>{spread.spreadNumber}</span>
              <GripVertical size={10} />
            </div>

            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-slate-900/70 py-1 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(spread.id);
                }}
                aria-label={`Duplicate spread ${spread.spreadNumber}`}
                title="Duplicate"
                className="rounded p-0.5 text-white hover:bg-white/20"
              >
                <Copy size={11} />
              </button>
              {spreads.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(spread.id);
                  }}
                  aria-label={`Delete spread ${spread.spreadNumber}`}
                  title="Delete"
                  className="rounded p-0.5 text-white hover:bg-red-500/60"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
