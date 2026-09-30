"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { SHORTCUT_GROUPS } from "@/components/studio/editor/keyboard";
import { useT } from "@/lib/i18n";

/** The "?" overlay — every editor shortcut, grouped. Closes on Esc, the X, or a click outside. */
export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-full w-[720px] max-w-full flex-col gap-5 overflow-auto rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="shortcuts-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Keyboard shortcuts")}
          </p>
          <button
            ref={closeRef}
            type="button"
            aria-label={t("Close")}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <MetaLabel>{t(group.title)}</MetaLabel>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-body text-ink-secondary">
                    <span>{t(item.label)}</span>
                    <span className="flex shrink-0 gap-1">
                      {item.keys.map((k) => (
                        <kbd key={k} className="rounded-[6px] border border-hairline bg-inset-alt px-1.5 py-0.5 font-pw-mono text-mono font-medium text-ink">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
