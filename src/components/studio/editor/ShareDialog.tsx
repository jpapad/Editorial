"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import { createShare, isMissingSharesTable, listShares, revokeShare, shareUrl } from "@/utils/shares";
import type { BookShareRow } from "@/types/database";
import { useT } from "@/lib/i18n";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Share links for the book: children open them and color with no account; their work stays on their device. */
export default function ShareDialog({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const t = useT();
  const [shares, setShares] = useState<BookShareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    listShares(bookId)
      .then(setShares)
      .catch((err: Error) => setError(isMissingSharesTable(err.message) ? "Sharing isn't set up yet — run the book_shares migration in Supabase." : err.message));
  }, [bookId]);

  async function handleCreate() {
    setBusy(true);
    try {
      const share = await createShare(bookId);
      setShares((prev) => [share, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Couldn't create the link."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(token: string) {
    if (!window.confirm(t("Turn off this link? Anyone who has it won't be able to open the book any more."))) return;
    try {
      await revokeShare(token);
      setShares((prev) => (prev ?? []).filter((s) => s.token !== token));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Couldn't turn off the link."));
    }
  }

  function copy(token: string) {
    void navigator.clipboard.writeText(shareUrl(token)).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex w-[520px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="share-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Share for coloring")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <p className="text-body text-ink-secondary">
          {t("Anyone with the link can color this book in their browser — no account needed. Their coloring is saved on their own device and never changes your book. Blank backs are left out.")}
        </p>

        {error ? (
          <p className="text-helper text-error">{t(error)}</p>
        ) : shares === null ? (
          <p className="flex items-center gap-2 text-helper text-ink-muted">
            <Loader2 size={12} className="animate-spin" /> {t("Loading…")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shares.length === 0 && <li className="text-helper text-ink-muted">{t("No active links yet.")}</li>}
            {shares.map((s) => (
              <li key={s.token} className="flex items-center gap-2 rounded-row-sm bg-inset-alt p-2 pl-3">
                <Link2 size={14} className="shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1 truncate font-pw-mono text-helper text-ink" title={shareUrl(s.token)}>
                  {shareUrl(s.token)}
                </span>
                <span className="shrink-0 text-[10px] text-ink-muted">{dateFmt.format(new Date(s.created_at))}</span>
                <button type="button" onClick={() => copy(s.token)} className="flex h-7 shrink-0 items-center gap-1 rounded-pill px-2 text-helper font-medium text-accent outline-none hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent">
                  {copied === s.token ? <Check size={12} /> : <Copy size={12} />}
                  {copied === s.token ? t("Copied") : t("Copy")}
                </button>
                <button type="button" onClick={() => void handleRevoke(s.token)} className="h-7 shrink-0 rounded-pill px-2 text-helper font-medium text-error outline-none hover:bg-error/10 focus-visible:ring-2 focus-visible:ring-accent">
                  {t("Turn off")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button variant="primary" onClick={() => void handleCreate()} disabled={busy || Boolean(error)} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}>
            {t("Create link")}
          </Button>
        </div>
      </div>
    </div>
  );
}
