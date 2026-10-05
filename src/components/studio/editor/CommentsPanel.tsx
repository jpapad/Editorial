"use client";

import { useState } from "react";
import { Check, RotateCcw, Trash2, X } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import type { PageComment } from "@/utils/comments";
import { useT } from "@/lib/i18n";

export interface CommentsPanelProps {
  comments: PageComment[];
  /** null while loading; a message when comments can't be loaded (e.g. migration not run). */
  loadError: string | null;
  loading: boolean;
  activePageId: string;
  pageLabel: (pageId: string) => string;
  currentUserId: string | null;
  isSupervisor: boolean;
  onAdd: (body: string) => Promise<void>;
  onSetResolved: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onGoToPage: (pageId: string) => void;
  onClose: () => void;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Review notes per page — supervisors and the book's owner add them; the owner resolves them as they fix things. */
export default function CommentsPanel(props: CommentsPanelProps) {
  const { comments, activePageId } = props;
  const t = useT();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [allPages, setAllPages] = useState(false);

  const visible = comments.filter((c) => (allPages || c.page_id === activePageId) && (showResolved || !c.resolved));
  const openOnPage = comments.filter((c) => c.page_id === activePageId && !c.resolved).length;
  const openTotal = comments.filter((c) => !c.resolved).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await props.onAdd(body);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="absolute bottom-[18px] right-[18px] top-[106px] flex w-[264px] flex-col gap-3.5 overflow-y-auto pb-1">
      <div className="flex shrink-0 items-center justify-between px-1">
        <MetaLabel>{t("Comments · {n} open", { n: openTotal })}</MetaLabel>
        <button
          type="button"
          aria-label={t("Close comments")}
          onClick={props.onClose}
          className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={14} />
        </button>
      </div>

      <Card className="flex shrink-0 flex-col gap-2.5 p-4">
        <p className="text-card-title font-semibold text-ink">{t("Page")} {props.pageLabel(activePageId)}</p>
        {props.loadError ? (
          <p className="text-helper text-error">{props.loadError}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="comment-draft" className="sr-only">
              {t("Add a comment on this page")}
            </label>
            <textarea
              id="comment-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
              }}
              rows={3}
              maxLength={2000}
              placeholder={props.isSupervisor ? t("Leave a note for the author…") : t("Add a note on this page…")}
              className="resize-y rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!draft.trim() || sending}>
              {sending ? t("Posting…") : t("Comment")}
            </Button>
          </form>
        )}
      </Card>

      <Card className="flex shrink-0 flex-col gap-2.5 p-4">
        <div className="flex flex-col gap-1.5">
          <Toggle checked={allPages} onChange={setAllPages} label={t("All pages")} />
          <Toggle checked={showResolved} onChange={setShowResolved} label={t("Show resolved")} />
        </div>
        {props.loading ? (
          <p className="text-helper text-ink-muted">{t("Loading…")}</p>
        ) : visible.length === 0 ? (
          <p className="text-helper text-ink-muted">{allPages ? t("No comments on this book yet.") : openOnPage === 0 ? t("No open comments on this page.") : ""}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((c) => {
              const mine = c.author_id === props.currentUserId;
              return (
                <li key={c.id} className={cn("flex flex-col gap-1.5 rounded-row-sm border p-2.5", c.resolved ? "border-hairline bg-inset-alt opacity-70" : "border-hairline bg-panel")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-helper font-medium text-ink" title={c.author_email}>
                      {mine ? t("You") : c.author_email}
                    </span>
                    {allPages && (
                      <button type="button" onClick={() => props.onGoToPage(c.page_id)} className="shrink-0 font-pw-mono text-mono font-medium uppercase tracking-[0.09em] text-accent hover:underline">
                        p.{props.pageLabel(c.page_id)}
                      </button>
                    )}
                  </div>
                  <p className={cn("whitespace-pre-wrap break-words text-body text-ink", c.resolved && "line-through decoration-ink-muted")}>{c.body}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-ink-muted">{timeFmt.format(new Date(c.created_at))}</span>
                    <span className="flex gap-0.5">
                      <button
                        type="button"
                        title={c.resolved ? t("Reopen") : t("Mark resolved")}
                        aria-label={c.resolved ? t("Reopen comment") : t("Mark comment resolved")}
                        onClick={() => props.onSetResolved(c.id, !c.resolved)}
                        className="flex h-6 w-6 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {c.resolved ? <RotateCcw size={12} /> : <Check size={13} />}
                      </button>
                      {(mine || props.isSupervisor) && (
                        <button
                          type="button"
                          title={t("Delete")}
                          aria-label={t("Delete comment")}
                          onClick={() => window.confirm(t("Delete this comment?")) && props.onDelete(c.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-pill text-error outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </aside>
  );
}
