"use client";

import { useState } from "react";
import { Languages, Loader2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { aiErrorText, useT } from "@/lib/i18n";
import { TRANSLATE_BATCH, TRANSLATE_LANGUAGES, TRANSLATE_TEXT_MAX, type TranslateCode } from "@/services/bookTexts";
import { applyTranslations, chunk, collectTexts } from "@/utils/translateBook";
import type { BookPage } from "@/types/editor";

export interface TranslateBookDialogProps {
  pages: BookPage[];
  /** The wrap-around cover's page, when the book has one — its words are translated too. */
  coverPage: BookPage | null;
  /** Receives the translated pages (and cover page) to save as a new book. */
  onTranslated: (pages: BookPage[], coverPage: BookPage | null, target: TranslateCode) => Promise<void>;
  onClose: () => void;
}

/**
 * A copy of the book in another language: titles, captions, clues and
 * front matter are translated; the original book is left as it is.
 */
export default function TranslateBookDialog({ pages, coverPage, onTranslated, onClose }: TranslateBookDialogProps) {
  const t = useT();
  const [target, setTarget] = useState<TranslateCode>("en");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = coverPage ? [...pages, coverPage] : pages;
  const texts = collectTexts(all).filter((s) => s.length <= TRANSLATE_TEXT_MAX);
  const busy = progress !== null;

  async function run() {
    setError(null);
    setProgress({ done: 0, total: texts.length });
    const map = new Map<string, string>();
    try {
      for (const batch of chunk(texts, TRANSLATE_BATCH)) {
        const response = await fetch("/api/translate-texts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texts: batch, target }) });
        const body = (await response.json().catch(() => null)) as { translations?: string[]; error?: string } | null;
        if (!response.ok || !body?.translations) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Translation failed")));
        batch.forEach((source, i) => map.set(source, body.translations![i] ?? source));
        setProgress({ done: map.size, total: texts.length });
      }
      await onTranslated(applyTranslations(pages, map), coverPage ? applyTranslations([coverPage], map)[0] : null, target);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Translation failed"));
      setProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tr-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
        className="flex w-[460px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="tr-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <Languages size={19} aria-hidden />
            {t("Translate the book")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5">
          <MetaLabel>{t("Translate into")}</MetaLabel>
          <select value={target} onChange={(e) => setTarget(e.target.value as TranslateCode)} disabled={busy} className="h-9 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {TRANSLATE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {t(l.name)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-helper text-ink-muted">
          {texts.length === 0 ? t("This book has no text to translate.") : texts.length === 1 ? t("1 text will be translated into a new copy of the book. This book stays as it is.") : t("{n} texts will be translated into a new copy of the book. This book stays as it is.", { n: texts.length })}
        </p>
        <p className="text-helper text-ink-muted">{t("Letter grids (word search, crossword answers) and tracing rows are not changed — make those again in the new language.")}</p>
        {busy && (
          <p role="status" className="flex items-center gap-2 text-body text-ink-secondary">
            <Loader2 size={14} className="animate-spin" /> {t("Translating… {done} of {total}", { done: progress.done, total: progress.total })}
          </p>
        )}
        {error && <p className="text-helper text-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy || texts.length === 0}>
            {t("Translate into a new book")}
          </Button>
        </div>
      </div>
    </div>
  );
}
