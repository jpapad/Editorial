"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Star, Copy } from "lucide-react";
import { cn } from "@/utils/cn";
import Thumbnail from "@/components/studio/ui/Thumbnail";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { PAGE_TEMPLATE_OPTIONS } from "@/components/editor/pageTemplates";
import type { BookPage, PageTemplate } from "@/types/editor";

export interface PageFilmstripProps {
  pages: BookPage[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onAddPage: (template: PageTemplate) => void;
  onDeletePage: (id: string) => void;
  onDuplicatePage: (id: string) => void;
  /** Drag-and-drop reorder — receives the whole list in its new order. */
  onReorderPages: (pages: BookPage[]) => void;
  /** Adds (or removes) a blank reverse after every page, for single-sided coloring books. */
  onToggleBlankBacks: () => void;
  /** Open comments per page id — shown as a small badge on the thumbnail. */
  commentCounts?: Record<string, number>;
}

const THUMB_RADIUS_PX = 5; // exact spec value ("44x58 thumbnails radius 5") — doesn't match any named radius token, so passed as a raw style override

/**
 * `flex: none` on the outer element is load-bearing, not decorative — in
 * EditorShell's fixed-height column (canvas area `flex:1 min-height:0`
 * above it), a filmstrip left at the default `flex: 1 1 auto` would get
 * squeezed to zero height by the canvas area's own growth instead of
 * keeping its own 92px. Called out explicitly in the README for exactly
 * this reason.
 *
 * Real page data now (the old editor's BookPage[], not a static demo
 * array) — add/delete/select all work, restyled from the old
 * PageManager's template-picker + delete-on-hover pattern onto the new
 * tokens/primitives.
 */
export default function PageFilmstrip({ pages, activePageId, onSelectPage, onAddPage, onDeletePage, onDuplicatePage, onReorderPages, onToggleBlankBacks, commentCounts = {} }: PageFilmstripProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const hasBlankBacks = pages.some((p) => p.isBlankBack);

  function handleDrop() {
    if (dragIndex === null || dropIndex === null) return;
    const next = [...pages];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex > dragIndex ? dropIndex - 1 : dropIndex, 0, moved);
    if (next.some((p, i) => p.id !== pages[i].id)) onReorderPages(next);
  }

  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; bottom: number } | null>(null);
  const addButtonRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showTemplateMenu) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || addButtonRef.current?.contains(target)) return;
      setShowTemplateMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTemplateMenu]);

  function openMenu() {
    const rect = addButtonRef.current?.getBoundingClientRect();
    if (rect) setMenuPosition({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
    setShowTemplateMenu((v) => !v);
  }

  return (
    <div className="flex h-[92px] shrink-0 items-center gap-3 rounded-panel bg-panel px-4 shadow-panel" style={{ flex: "none" }}>
      <div className="flex flex-col items-start gap-1.5">
        <MetaLabel>Pages</MetaLabel>
        <button
          type="button"
          aria-pressed={hasBlankBacks}
          title="Single-sided printing: a blank reverse after every page, so markers don't bleed onto the next picture"
          onClick={onToggleBlankBacks}
          className={cn(
            "whitespace-nowrap rounded-pill border px-2 py-0.5 text-[10px] font-medium outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            hasBlankBacks ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
          )}
        >
          {hasBlankBacks ? "✓ Blank backs" : "Blank backs"}
        </button>
      </div>
      <div
        className="flex flex-1 items-center gap-2 overflow-x-auto py-2"
        onDragOver={(e) => dragIndex !== null && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop();
          setDragIndex(null);
          setDropIndex(null);
        }}
      >
        {pages.map((page, index) => (
          <div
            key={page.id}
            draggable
            onDragStart={(e) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", page.id);
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              setDropIndex(e.clientX < rect.left + rect.width / 2 ? index : index + 1);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDropIndex(null);
            }}
            className={cn("group relative shrink-0 cursor-grab active:cursor-grabbing", dragIndex === index && "opacity-40")}
          >
            {dragIndex !== null && dropIndex === index && <span className="absolute -left-[5px] top-0 h-full w-[2px] rounded-pill bg-accent" aria-hidden />}
            {dragIndex !== null && dropIndex === index + 1 && index === pages.length - 1 && <span className="absolute -right-[5px] top-0 h-full w-[2px] rounded-pill bg-accent" aria-hidden />}
            <Thumbnail
              src={page.thumbnailDataUrl}
              selected={page.id === activePageId}
              onClick={() => onSelectPage(page.id)}
              style={{ width: 44, height: 58, borderRadius: THUMB_RADIUS_PX }}
              alt={page.isBlankBack ? `Page ${index + 1} (blank back)` : `Page ${index + 1}`}
              badge={
                page.isCover ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-pill bg-warning text-white">
                    <Star size={9} fill="currentColor" />
                  </span>
                ) : undefined
              }
            >
              {page.isBlankBack && !page.thumbnailDataUrl && <span className="font-pw-mono text-[7px] uppercase tracking-[0.09em] text-ink-muted">back</span>}
            </Thumbnail>
            <span className="pointer-events-none absolute -bottom-3.5 left-0 right-0 text-center font-pw-mono text-[8px] text-ink-muted">{index + 1}</span>
            {commentCounts[page.id] > 0 && (
              <span
                className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-error px-1 text-[9px] font-semibold text-white"
                title={`${commentCounts[page.id]} open comment${commentCounts[page.id] === 1 ? "" : "s"}`}
              >
                {commentCounts[page.id]}
              </span>
            )}
            <div className="absolute -right-1.5 -top-1.5 hidden gap-0.5 group-hover:flex group-focus-within:flex">
              <button
                type="button"
                aria-label={`Duplicate page ${index + 1}`}
                title="Duplicate page"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicatePage(page.id);
                }}
                className="rounded-pill bg-panel p-0.5 text-ink-secondary shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Copy size={11} />
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  aria-label={`Delete page ${index + 1}`}
                  title="Delete page"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(page.id);
                  }}
                  className="rounded-pill bg-panel p-0.5 text-error shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}

        <div ref={addButtonRef} className="relative shrink-0">
          <Thumbnail dashed onClick={openMenu} style={{ width: 44, height: 58, borderRadius: THUMB_RADIUS_PX }} alt="Add page">
            <Plus size={16} className="text-ink-muted" />
          </Thumbnail>
        </div>
      </div>

      {/*
       * Portal, not a normal absolutely-positioned child: this menu pops
       * up ABOVE the filmstrip, over the canvas area. Found by actually
       * driving "add a page" in a real browser (not visible from a
       * static screenshot) that a plain z-index bump wasn't enough to
       * reliably win against Konva's own absolutely-positioned <canvas>
       * elements nested several stacking contexts away — rendering the
       * menu as a direct child of <body> with `position: fixed`
       * sidesteps the whole ancestor-stacking-context question rather
       * than fighting it.
       */}
      {showTemplateMenu &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 flex w-56 flex-col gap-0.5 rounded-panel bg-panel p-1.5 shadow-panel"
            style={{ left: menuPosition.left, bottom: menuPosition.bottom }}
          >
            <p className="px-2 py-1 text-helper font-medium text-ink-muted">Layout templates</p>
            {PAGE_TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onAddPage(option.id);
                  setShowTemplateMenu(false);
                }}
                className="flex flex-col items-start rounded-row-sm px-2 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <span className="text-body font-medium text-ink">{option.label}</span>
                <span className="text-helper text-ink-muted">{option.description}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
