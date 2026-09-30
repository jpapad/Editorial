"use client";

import { Copy, FlipHorizontal2, Group, Lock, Trash2, Ungroup } from "lucide-react";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import type { Bounds } from "@/utils/objectGeometry";

export interface SelectionToolbarProps {
  /** The selection's bounds in page points. */
  bounds: Bounds;
  /** Canvas zoom: page points → CSS px. */
  scale: number;
  count: number;
  canGroup: boolean;
  canUngroup: boolean;
  onDuplicate: () => void;
  onMirror: () => void;
  onLock: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDelete: () => void;
}

// Clears the transformer's rotate handle, which sits ~50px above the selection.
const GAP_PX = 58;
const BAR_H = 44;

/**
 * A small floating bar just above the current selection (below it when the
 * selection hugs the top edge): the actions you reach for most, next to the
 * thing they act on. Everything here is also in the right panel.
 */
export default function SelectionToolbar({ bounds, scale, count, canGroup, canUngroup, onDuplicate, onMirror, onLock, onGroup, onUngroup, onDelete }: SelectionToolbarProps) {
  const t = useT();
  const centerX = ((bounds.left + bounds.right) / 2) * scale;
  const above = bounds.top * scale - GAP_PX - BAR_H;
  const top = above >= 4 ? above : bounds.bottom * scale + 14;
  const button = "flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset hover:text-ink focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none";

  return (
    <div
      role="toolbar"
      aria-label={t("Selection actions")}
      className="pw-glass pointer-events-auto absolute z-10 flex h-11 -translate-x-1/2 items-center gap-0.5 rounded-[14px] px-1.5 shadow-toolbar"
      style={{ left: centerX, top }}
      // Keep canvas pointer handlers (deselect on empty click, marquee) from seeing clicks on the bar.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="px-1.5 font-pw-mono text-mono text-ink-muted" aria-hidden>
        {count > 1 ? count : "1"}
      </span>
      <button type="button" aria-label={t("Duplicate selection")} title={`${t("Duplicate")} (⌘/Ctrl D)`} onClick={onDuplicate} className={button}>
        <Copy size={16} />
      </button>
      <button type="button" aria-label={t("Mirror selection")} title={t("Flip horizontally")} onClick={onMirror} className={button}>
        <FlipHorizontal2 size={16} />
      </button>
      {canUngroup ? (
        <button type="button" aria-label={t("Ungroup")} title={`${t("Ungroup")} (⌘/Ctrl Shift G)`} onClick={onUngroup} className={button}>
          <Ungroup size={16} />
        </button>
      ) : (
        canGroup && (
          <button type="button" aria-label={t("Group")} title={`${t("Group")} (⌘/Ctrl G)`} onClick={onGroup} className={button}>
            <Group size={16} />
          </button>
        )
      )}
      <button type="button" aria-label={t("Lock selection")} title={t("Lock selection")} onClick={onLock} className={button}>
        <Lock size={16} />
      </button>
      <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />
      <button type="button" aria-label={t("Delete selection")} title={`${t("Delete")} (Del)`} onClick={onDelete} className={cn(button, "hover:text-error")}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
