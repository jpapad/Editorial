"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { useT } from "@/lib/i18n";
import { isMissingTemplatesTable, publishTemplate } from "@/utils/templates";
import type { BookPage } from "@/types/editor";

/** Share this book's pages as a community template other creators can start from. */
export default function PublishTemplateDialog({ title, pages, trimSize, bleed, onClose }: { title: string; pages: BookPage[]; trimSize?: string; bleed: boolean; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(title);
  const [description, setDescription] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || state === "busy") return;
    setState("busy");
    setError(null);
    try {
      await publishTemplate({ title: name, description, trimSize, bleed, pages });
      setState("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(isMissingTemplatesTable(message) ? t("Templates aren't set up yet — run the usage_and_templates migration in Supabase.") : message || t("Couldn't publish the template."));
      setState("idle");
    }
  }

  const input = "rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpl-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={submit}
        className="flex w-[460px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="tpl-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Share as a template")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        {state === "done" ? (
          <>
            <p className="text-body text-ink-secondary">{t("Published! It's now in Library › Templates for everyone.")}</p>
            <div className="flex justify-end">
              <Button type="button" variant="primary" onClick={onClose}>
                {t("OK")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-body text-ink-secondary">{t("All signed-in users will be able to see this book's {n} pages and copy them into a book of their own. Coloring and progress are left out.", { n: pages.length })}</p>
            <label className="flex flex-col gap-1">
              <MetaLabel>{t("Name")}</MetaLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <MetaLabel>{t("Description")}</MetaLabel>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder={t("What's inside, who it's for…")} className={`${input} resize-y`} />
            </label>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("Cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={!name.trim() || state === "busy"} icon={state === "busy" ? <Loader2 size={14} className="animate-spin" /> : undefined}>
                {t("Publish template")}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
