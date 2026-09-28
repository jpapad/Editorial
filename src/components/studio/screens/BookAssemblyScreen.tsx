"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Thumbnail from "@/components/studio/ui/Thumbnail";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import StatusDot from "@/components/studio/ui/StatusDot";
import { cn } from "@/utils/cn";
import type { BookPage } from "@/types/editor";

export interface BookAssemblyScreenProps {
  bookTitle?: string;
  binding?: string;
  pages: BookPage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onReorder: (pages: BookPage[]) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
}

/**
 * 1g: book assembly — 6-col page grid, native HTML5 drag-to-reorder (same
 * approach this repo's earlier PageManager component already used, not a
 * new pattern), a dashed drop target while dragging, and a footer
 * validation strip that only appears when the page count genuinely isn't
 * a multiple of 4 (saddle stitch's real constraint, not decorative copy).
 * Real `pages` from the book being edited, not demo fixture data — each
 * tile shows that page's real `thumbnailDataUrl` (captured by EditorShell
 * on page-switch/export) when one exists yet, falling back to the striped
 * placeholder for a never-visited page rather than a fabricated preview.
 */
export default function BookAssemblyScreen({ bookTitle = "Untitled Book", binding = "Saddle stitch", pages, activePageId, onSelectPage, onReorder, onAddPage, onDeletePage }: BookAssemblyScreenProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const needsPages = pages.length % 4 !== 0;
  const pagesToAdd = needsPages ? 4 - (pages.length % 4) : 0;

  function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }
    const next = [...pages];
    const fromIndex = next.findIndex((p) => p.id === draggingId);
    const toIndex = next.findIndex((p) => p.id === targetId);
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
    setDraggingId(null);
    setDropTargetId(null);
  }

  function handleFixAutomatically() {
    for (let i = 0; i < pagesToAdd; i++) onAddPage();
  }

  return (
    <div className="flex flex-col gap-4 rounded-panel bg-panel p-5 shadow-panel" style={{ width: 900 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">{bookTitle}</p>
          <MetaLabel>
            {pages.length} pages · {Math.ceil(pages.length / 2)} spreads · {binding}
          </MetaLabel>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onAddPage}>
            Insert blank
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {pages.map((page, i) => (
          <div key={page.id} className="group flex flex-col items-center gap-1.5">
            <div
              draggable
              onDragStart={() => setDraggingId(page.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTargetId(page.id);
              }}
              onDragLeave={() => setDropTargetId((current) => (current === page.id ? null : current))}
              onDrop={() => handleDrop(page.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTargetId(null);
              }}
              className="relative"
            >
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeletePage(page.id)}
                  aria-label={`Delete page ${i + 1}`}
                  className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-pill bg-panel text-ink-muted opacity-0 shadow-toolbar outline-none transition-opacity duration-150 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <X size={11} />
                </button>
              )}
              <Thumbnail
                src={page.thumbnailDataUrl}
                onClick={() => onSelectPage(page.id)}
                selected={page.id === activePageId}
                dashed={dropTargetId === page.id && draggingId !== page.id}
                className={cn("cursor-grab active:cursor-grabbing", draggingId === page.id && "opacity-40")}
                style={{ width: 118, height: 152 }}
              />
            </div>
            <MetaLabel>{draggingId === page.id ? "Dragging" : dropTargetId === page.id && draggingId ? "Drop here" : i === 0 ? "Cover" : String(i + 1).padStart(2, "0")}</MetaLabel>
          </div>
        ))}
      </div>

      {needsPages && (
        <div className="flex items-center gap-2 border-t border-hairline pt-3">
          <StatusDot tone="warning" />
          <p className="text-helper text-ink-secondary">Page count must be a multiple of 4 — add {pagesToAdd} pages</p>
          <button type="button" onClick={handleFixAutomatically} className="text-helper font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            Fix automatically
          </button>
        </div>
      )}
    </div>
  );
}
