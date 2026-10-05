"use client";

import { useState } from "react";
import { UserRound, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { useT } from "@/lib/i18n";

/**
 * Puts a child's name into the book wherever a text says {name}. With no
 * placeholder yet, it offers to add a name line to the current page.
 */
export default function PersonalizeDialog({ slots, onApply, onAddSlot, onClose }: { slots: number; onApply: (name: string) => void; onAddSlot: () => void; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const input = "h-10 rounded-row-sm border border-hairline bg-panel px-3 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="pz-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={(e) => {
          e.preventDefault();
          if (slots === 0) return;
          onApply(name);
          onClose();
        }}
        className="flex w-[440px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="pz-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <UserRound size={19} aria-hidden />
            {t("Personalize for a child")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <p className="text-helper text-ink-muted">{t("Write {name} in any text of the book — a title, “This book belongs to {name}”, a caption. The child's name goes in everywhere at once, and you can change it again for the next child.")}</p>
        {slots === 0 ? (
          <>
            <p className="text-body text-ink-secondary">{t("No text in this book has {name} yet.")}</p>
            <Button
              variant="secondary"
              onClick={() => {
                onAddSlot();
                onClose();
              }}
            >
              {t("Add a name line to this page")}
            </Button>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Child's name")}</MetaLabel>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
            </label>
            <p className="text-helper text-ink-muted">{slots === 1 ? t("1 place in the book takes the name. Leave it empty to put {name} back.") : t("{n} places in the book take the name. Leave it empty to put {name} back.", { n: slots })}</p>
            <div className="flex justify-end gap-2 border-t border-hairline pt-4">
              <Button variant="ghost" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" variant="primary">
                {t("Put the name in")}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
