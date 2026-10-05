"use client";

import { useEffect, useState } from "react";
import { History, Save, Trash2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { useLanguage, useT } from "@/lib/i18n";
import { deleteVersion, listVersions, loadVersionPages, saveVersion, type BookVersion } from "@/utils/versions";
import type { BookPage } from "@/types/editor";

export interface VersionHistoryDialogProps {
  bookId: string;
  title: string;
  pages: BookPage[];
  onRestore: (pages: BookPage[]) => void;
  onClose: () => void;
}

/** Earlier states of this book kept on this device: save one now, or bring an old one back. */
export default function VersionHistoryDialog({ bookId, title, pages, onRestore, onClose }: VersionHistoryDialogProps) {
  const t = useT();
  const { lang } = useLanguage();
  const [versions, setVersions] = useState<BookVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listVersions(bookId).then(setVersions);
  }, [bookId]);

  const when = (iso: string) => new Date(iso).toLocaleString(lang === "el" ? "el-GR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  async function saveNow() {
    try {
      setVersions(await saveVersion(bookId, title, pages, true));
      setError(null);
    } catch {
      setError(t("Could not save a version on this device."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vh-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-full w-[480px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="vh-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <History size={19} aria-hidden />
            {t("Version history")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <p className="text-helper text-ink-muted">{t("A version is kept every 10 minutes while you work — on this device, and the latest few with your account when you are signed in. Restoring one can be undone.")}</p>
        <Button variant="secondary" size="sm" icon={<Save size={13} />} onClick={() => void saveNow()}>
          {t("Save a version now")}
        </Button>
        {error && <p className="text-helper text-error">{error}</p>}
        {versions && versions.length === 0 && <p className="text-body text-ink-secondary">{t("No versions yet.")}</p>}
        {versions && versions.length > 0 && (
          <ul aria-label={t("Versions")} className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-row border border-hairline px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-ink">{when(v.at)}</span>
                  <MetaLabel>
                    {v.pageCount === 1 ? t("1 page") : t("{n} pages", { n: v.pageCount })}
                    {v.manual ? ` · ${t("saved by you")}` : ""}
                    {v.pages ? "" : ` · ${t("from your account")}`}
                  </MetaLabel>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void loadVersionPages(v).then((saved) => {
                      if (!saved) return setError(t("This version could not be loaded."));
                      onRestore(saved);
                      onClose();
                    });
                  }}
                >
                  {t("Restore")}
                </Button>
                <button
                  type="button"
                  aria-label={t("Delete this version")}
                  onClick={() => void deleteVersion(bookId, v.id).then(setVersions)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-ink-muted outline-none hover:bg-inset-alt hover:text-error focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
