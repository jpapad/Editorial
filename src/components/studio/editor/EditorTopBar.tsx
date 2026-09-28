import Link from "next/link";
import { FolderOpen, Save, Loader2, Undo2, Redo2, Keyboard, BookOpen, MessageSquare } from "lucide-react";
import { cn } from "@/utils/cn";
import Button from "@/components/studio/ui/Button";
import SegmentedControl from "@/components/studio/ui/SegmentedControl";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import type { EditorMode } from "@/components/studio/types";
import type { BookPage } from "@/types/editor";

export interface EditorTopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  pages: BookPage[];
  activePageId: string;
  trimSizeLabel: string;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onShowShortcuts: () => void;
  /** Book preview (single pages or open-book spreads) without publishing. */
  onPreview: () => void;
  /** Open (unresolved) comments across the book. */
  commentCount: number;
  commentsActive: boolean;
  onToggleComments: () => void;
  onExport: () => void;
  isExporting: boolean;
  onPublish: () => void;
}

const ICON_BUTTON_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

const MODE_OPTIONS: { value: EditorMode; label: string }[] = [
  { value: "draw", label: "Σχέδιο" },
  { value: "color", label: "Χρώμα" },
  { value: "assemble", label: "Σελίδες" },
  { value: "cover", label: "Εξώφυλλο" },
];

/**
 * Floating top bar (2b): absolute-positioned, 18px insets, height 56 —
 * "floating" rather than a normal document-flow header because the tool
 * rail and right panel both start their own `margin-top:88px` below it
 * independently (see EditorShell), not because it's a layout container
 * for them.
 *
 * Save/Load are real, existing capabilities from the old Toolbar (JSON
 * project download/upload) with no natural slot in the mock's
 * Export/Publish pair — added as small ghost icon buttons rather than
 * silently dropped. Export -> the real PDF export (README's "Export"
 * literally means this); Publish -> the book preview modal (the closest
 * existing capability to "review before publishing" — there's no real
 * hosting/publish flow anywhere in this codebase, old or new).
 */
export default function EditorTopBar({ title, onTitleChange, pages, activePageId, trimSizeLabel, mode, onModeChange, onSave, onLoad, onUndo, canUndo, onRedo, canRedo, onShowShortcuts, onPreview, commentCount, commentsActive, onToggleComments, onExport, isExporting, onPublish }: EditorTopBarProps) {
  const pageIndex = pages.findIndex((p) => p.id === activePageId);
  const pageNumber = pageIndex === -1 ? 1 : pageIndex + 1;

  return (
    <header className="absolute inset-x-[18px] top-[18px] z-10 flex h-14 items-center justify-between rounded-panel bg-panel px-4 shadow-panel">
      <div className="flex items-center gap-3">
        <Link
          href="/studio"
          aria-label="Back to library"
          className="h-[26px] w-[26px] shrink-0 rounded-[9px] bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        />
        <div>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            aria-label="Book title"
            className="-mx-1 rounded-row-sm border border-transparent bg-transparent px-1 text-card-title font-semibold text-ink outline-none hover:border-hairline focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            style={{ width: `${Math.max(title.length, 8)}ch` }}
          />
          <MetaLabel className="block whitespace-nowrap">
            Page {String(pageNumber).padStart(2, "0")} / {pages.length} · {trimSizeLabel}
          </MetaLabel>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={onModeChange} />

        <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
          <FolderOpen size={16} />
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onLoad(file);
            }}
          />
        </label>
        <button
          type="button"
          aria-label="Save project"
          onClick={onSave}
          className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Save size={16} />
        </button>
        <div className="flex items-center">
          <button type="button" aria-label="Undo" title="Undo (⌘/Ctrl Z)" onClick={onUndo} disabled={!canUndo} className={ICON_BUTTON_CLASS}>
            <Undo2 size={16} />
          </button>
          <button type="button" aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" onClick={onRedo} disabled={!canRedo} className={ICON_BUTTON_CLASS}>
            <Redo2 size={16} />
          </button>
        </div>
        <button
          type="button"
          aria-label={`Comments${commentCount ? ` (${commentCount} open)` : ""}`}
          aria-pressed={commentsActive}
          title="Comments"
          onClick={onToggleComments}
          className={cn(ICON_BUTTON_CLASS, "relative", commentsActive && "bg-accent-tint text-accent")}
        >
          <MessageSquare size={16} />
          {commentCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-error px-1 text-[9px] font-semibold text-white">{commentCount}</span>
          )}
        </button>
        <button type="button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={onShowShortcuts} className={ICON_BUTTON_CLASS}>
          <Keyboard size={16} />
        </button>

        <Button variant="secondary" onClick={onPreview} icon={<BookOpen size={14} />}>
          Preview
        </Button>
        <Button variant="secondary" onClick={onExport} disabled={isExporting} icon={isExporting ? <Loader2 size={14} className="animate-spin" /> : undefined}>
          Export
        </Button>
        <Button variant="primary" onClick={onPublish}>
          Publish
        </Button>
      </div>
    </header>
  );
}
