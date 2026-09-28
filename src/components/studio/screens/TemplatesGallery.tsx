"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { useT } from "@/lib/i18n";
import { useSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import { createBookFromTemplate, deleteTemplate, isMissingTemplatesTable, listTemplates, type BookTemplate } from "@/utils/templates";
import { trimShortLabel } from "@/utils/trimSizes";

type Row = Omit<BookTemplate, "pages">;

/** Library › Templates: books other creators shared, ready to copy into a book of your own. */
export default function TemplatesGallery({ onOpenBook }: { onOpenBook: (id: string) => void }) {
  const t = useT();
  const { user } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);

  const load = useCallback(() => {
    listTemplates()
      .then(setRows)
      .catch((err: Error) => setError(isMissingTemplatesTable(err.message) ? "Templates aren't set up yet — run the usage_and_templates migration in Supabase." : err.message));
  }, []);

  useEffect(() => {
    load();
    supabase.rpc("is_admin").then(({ data }) => setIsSupervisor(data === true));
  }, [load]);

  async function use(id: string) {
    setBusyId(id);
    try {
      const book = await createBookFromTemplate(id);
      onOpenBook(book.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Couldn't copy the template."));
      setBusyId(null);
    }
  }

  async function remove(row: Row) {
    if (!window.confirm(t("Remove the template “{title}” for everyone?", { title: row.title }))) return;
    try {
      await deleteTemplate(row.id);
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Couldn't remove the template."));
    }
  }

  if (error) return <p className="text-body text-error">{t(error)}</p>;
  if (!rows) return <p className="flex items-center gap-2 text-body text-ink-muted"><Loader2 size={14} className="animate-spin" /> {t("Loading…")}</p>;
  if (rows.length === 0) return <p className="text-body text-ink-muted">{t("No templates yet. Open a book and choose “Share as a template” to add the first one.")}</p>;

  return (
    <div className="grid grid-cols-4 gap-4">
      {rows.map((row) => (
        <div key={row.id} className="flex flex-col gap-2 rounded-panel bg-panel p-2.5 shadow-panel">
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-paper bg-paper-warm">
            {row.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- stage snapshot data URL
              <img src={row.thumbnail} alt="" className="h-full w-full object-contain" />
            ) : (
              <MetaLabel>{t("No preview")}</MetaLabel>
            )}
          </div>
          <div className="flex flex-col gap-0.5 px-0.5">
            <p className="truncate text-body font-medium text-ink" title={row.title}>
              {row.title}
            </p>
            <MetaLabel>
              {row.page_count === 1 ? t("1 page") : t("{n} pages", { n: row.page_count })} · {trimShortLabel(row.trim_size ?? undefined)}
              {row.author_id === user?.id ? ` · ${t("by you")}` : ""}
            </MetaLabel>
            {row.description && <p className="line-clamp-2 text-helper text-ink-secondary">{row.description}</p>}
          </div>
          <div className="mt-auto flex items-center gap-1">
            <Button variant="primary" size="sm" className="flex-1" disabled={busyId !== null} onClick={() => void use(row.id)} icon={busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : undefined}>
              {t("Use template")}
            </Button>
            {(row.author_id === user?.id || isSupervisor) && (
              <button type="button" aria-label={t("Remove template")} title={t("Remove template")} onClick={() => void remove(row)} className="flex h-8 w-8 items-center justify-center rounded-pill text-error outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
