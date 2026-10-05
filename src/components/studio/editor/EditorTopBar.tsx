import Link from "next/link";
import { FolderOpen, Save, Loader2, Undo2, Redo2, Keyboard, BookOpen, MessageSquare, Share2, Eye, Users } from "lucide-react";
import { cn } from "@/utils/cn";
import Button from "@/components/studio/ui/Button";
import SegmentedControl from "@/components/studio/ui/SegmentedControl";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import type { EditorMode } from "@/components/studio/types";
import type { BookPage } from "@/types/editor";
import { useT } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";

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
  /** Opens share-link management; hidden when there's no signed-in owner to share as. */
  onShare?: () => void;
  /** Opens the people working on this book (sql/11) — shown when there is a book to share. */
  onTeam?: () => void;
  onExport: () => void;
  isExporting: boolean;
  onPublish: () => void;
}

const ICON_BUTTON_CLASS =
  "flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

const MODE_OPTIONS: { value: EditorMode; label: string }[] = [
  { value: "draw", label: "Draw" },
  { value: "color", label: "Color" },
  { value: "assemble", label: "Pages" },
  { value: "cover", label: "Cover" },
];

/**
 * Floating top bar: three glass islands (where you are · mode · actions),
 * absolute-positioned with 18px insets, height 52 —
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
export default function EditorTopBar({ title, onTitleChange, pages, activePageId, trimSizeLabel, mode, onModeChange, onSave, onLoad, onUndo, canUndo, onRedo, canRedo, onShowShortcuts, onPreview, commentCount, commentsActive, onToggleComments, onShare, onTeam, onExport, isExporting, onPublish }: EditorTopBarProps) {
  const pageIndex = pages.findIndex((p) => p.id === activePageId);
  const pageNumber = pageIndex === -1 ? 1 : pageIndex + 1;
  const t = useT();

  return (
    <header className="pointer-events-none absolute inset-x-[18px] top-[18px] z-10 flex h-[52px] items-center justify-between gap-3">
      {/* Left island: back to library + title + where you are in the book */}
      <div className="pw-glass pointer-events-auto flex h-full min-w-0 items-center gap-3 rounded-[18px] pl-2 pr-4 shadow-panel">
        <Link
          href="/studio"
          aria-label={t("Back to library")}
          title={t("Back to library")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-ink text-on-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <BookOpen size={17} strokeWidth={2} />
        </Link>
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            aria-label={t("Book title")}
            className="-mx-1 max-w-[260px] rounded-row-sm border border-transparent bg-transparent px-1 text-body font-semibold text-ink outline-none hover:border-hairline focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            style={{ width: `${Math.max(title.length, 8)}ch` }}
          />
          <MetaLabel className="block whitespace-nowrap">
            {t("Page")} {String(pageNumber).padStart(2, "0")} / {pages.length} · {trimSizeLabel}
          </MetaLabel>
        </div>
      </div>

      {/* Centre island: the mode switch */}
      <div className="pw-glass pointer-events-auto rounded-[18px] p-[5px] shadow-panel">
        <SegmentedControl options={MODE_OPTIONS.map((o) => ({ ...o, label: t(o.label) }))} value={mode} onChange={onModeChange} className="bg-transparent p-0" />
      </div>

      {/* Right island: file, history, collaboration, theme, output */}
      <div className="pw-glass pointer-events-auto flex h-full items-center gap-1.5 rounded-[18px] px-2 shadow-panel">
        <label title={t("Open project file")} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
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
        <button type="button" aria-label={t("Save project")} title={t("Save project")} onClick={onSave} className={ICON_BUTTON_CLASS}>
          <Save size={16} />
        </button>
        <button type="button" aria-label={t("Undo")} title={`${t("Undo")} (⌘/Ctrl Z)`} onClick={onUndo} disabled={!canUndo} className={ICON_BUTTON_CLASS}>
          <Undo2 size={16} />
        </button>
        <button type="button" aria-label={t("Redo")} title={`${t("Redo")} (⌘/Ctrl Shift Z)`} onClick={onRedo} disabled={!canRedo} className={ICON_BUTTON_CLASS}>
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          aria-label={commentCount ? t("Comments ({n} open)", { n: commentCount }) : t("Comments")}
          aria-pressed={commentsActive}
          title={t("Comments")}
          onClick={onToggleComments}
          className={cn(ICON_BUTTON_CLASS, "relative", commentsActive && "bg-accent-tint text-accent")}
        >
          <MessageSquare size={16} />
          {commentCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-error px-1 text-[9px] font-semibold text-on-ink">{commentCount}</span>
          )}
        </button>
        {onTeam && (
          <button type="button" aria-label={t("Work together")} title={t("Work together")} onClick={onTeam} className={ICON_BUTTON_CLASS}>
            <Users size={16} />
          </button>
        )}
        {onShare && (
          <button type="button" aria-label={t("Share for coloring")} title={t("Share for coloring")} onClick={onShare} className={ICON_BUTTON_CLASS}>
            <Share2 size={16} />
          </button>
        )}
        <button type="button" aria-label={t("Keyboard shortcuts")} title={`${t("Keyboard shortcuts")} (?)`} onClick={onShowShortcuts} className={ICON_BUTTON_CLASS}>
          <Keyboard size={16} />
        </button>
        <span className="mx-1 h-6 w-px bg-hairline" aria-hidden />
        <ThemeToggle />
        <span className="mx-1 h-6 w-px bg-hairline" aria-hidden />
        <button type="button" aria-label={t("Preview")} title={t("Preview")} onClick={onPreview} className={ICON_BUTTON_CLASS}>
          <Eye size={16} />
        </button>
        <Button variant="secondary" size="sm" onClick={onExport} disabled={isExporting} icon={isExporting ? <Loader2 size={14} className="animate-spin" /> : undefined}>
          {t("Export")}
        </Button>
        <Button variant="primary" size="sm" onClick={onPublish}>
          {t("Publish")}
        </Button>
      </div>
    </header>
  );
}
