"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Trash2, Users, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { useT } from "@/lib/i18n";
import { createInvite, inviteUrl, isMissingCollaborators, listInvites, listMembers, removeMember, revokeInvite, setMemberRole, type BookRole } from "@/utils/collaborators";
import type { BookInviteRow, BookMemberRow } from "@/types/database";

const ROLE_LABEL: Record<BookMemberRow["role"], string> = { editor: "Can edit", viewer: "Can view and comment" };

/**
 * The people working on this book. The owner makes invite links (edit or
 * view), changes roles and removes people; everyone else sees the team
 * and can leave.
 */
export default function TeamDialog({ bookId, role, currentUserId, onClose, onLeft }: { bookId: string; role: BookRole; currentUserId: string; onClose: () => void; onLeft: () => void }) {
  const t = useT();
  const owner = role === "owner";
  const [members, setMembers] = useState<BookMemberRow[] | null>(null);
  const [invites, setInvites] = useState<BookInviteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listMembers(bookId), owner ? listInvites(bookId) : Promise.resolve([])])
      .then(([m, i]) => {
        setMembers(m);
        setInvites(i);
      })
      .catch((err: Error) => setError(isMissingCollaborators(err.message) ? t("Working together isn't set up yet — run sql/11_book_members.sql in Supabase.") : err.message));
  }, [bookId, owner, t]);

  async function invite(r: BookInviteRow["role"]) {
    setBusy(r);
    try {
      const made = await createInvite(bookId, r);
      setInvites((prev) => [...prev, made]);
      copy(made.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Couldn't create the link."));
    } finally {
      setBusy(null);
    }
  }

  function copy(token: string) {
    // The browser may refuse clipboard access; the link stays on screen to copy by hand.
    void navigator.clipboard
      ?.writeText(inviteUrl(token))
      .then(() => {
        setCopied(token);
        setTimeout(() => setCopied(null), 1400);
      })
      .catch(() => undefined);
  }

  async function act(f: () => Promise<void>) {
    try {
      await f();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Try again in a moment."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="team-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()} className="flex w-[540px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel">
        <div className="flex items-center justify-between">
          <p id="team-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <Users size={19} aria-hidden />
            {t("Work together")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <p className="text-body text-ink-secondary">{t("Invite a co-author, an illustrator or a reviewer. They sign in with their own account; the book stays yours.")}</p>
        {error && <p className="text-helper text-error">{error}</p>}

        {owner && !error && (
          <div className="flex flex-col gap-2">
            <MetaLabel>{t("Invite with a link")}</MetaLabel>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void invite("editor")} disabled={busy !== null} icon={busy === "editor" ? <Loader2 size={13} className="animate-spin" /> : undefined}>
                {t("Link to edit")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void invite("viewer")} disabled={busy !== null} icon={busy === "viewer" ? <Loader2 size={13} className="animate-spin" /> : undefined}>
                {t("Link to view and comment")}
              </Button>
            </div>
            {invites.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {invites.map((inv) => (
                  <li key={inv.token} className="flex items-center gap-2 rounded-row-sm bg-inset-alt px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate font-pw-mono text-mono text-ink-secondary" data-testid="invite-url">
                      {inviteUrl(inv.token)}
                    </span>
                    <span className="shrink-0 text-helper text-ink-muted">{t(ROLE_LABEL[inv.role])}</span>
                    <button type="button" aria-label={t("Copy the link")} onClick={() => copy(inv.token)} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                      {copied === inv.token ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button type="button" aria-label={t("Turn off")} title={t("Turn off")} onClick={() => void act(async () => { await revokeInvite(inv.token); setInvites((prev) => prev.filter((x) => x.token !== inv.token)); })} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-helper text-ink-muted">{t("Anyone with a link can join once signed in. Turn a link off when everyone's in.")}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <MetaLabel>{t("People on this book")}</MetaLabel>
          {members === null && !error ? (
            <p className="text-helper text-ink-muted">{t("Loading…")}</p>
          ) : members && members.length === 0 ? (
            <p className="text-helper text-ink-muted">{t("Just you so far.")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {(members ?? []).map((m) => (
                <li key={m.user_id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1 truncate text-body text-ink">
                    {m.email ?? m.user_id}
                    {m.user_id === currentUserId && <span className="text-ink-muted"> · {t("you")}</span>}
                  </span>
                  {owner ? (
                    <select
                      value={m.role}
                      aria-label={t("Role of {email}", { email: m.email ?? "" })}
                      onChange={(e) => {
                        const next = e.target.value as BookMemberRow["role"];
                        void act(async () => {
                          await setMemberRole(bookId, m.user_id, next);
                          setMembers((prev) => prev?.map((x) => (x.user_id === m.user_id ? { ...x, role: next } : x)) ?? null);
                        });
                      }}
                      className="h-8 rounded-row-sm border border-hairline bg-panel px-2 text-helper text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <option value="editor">{t(ROLE_LABEL.editor)}</option>
                      <option value="viewer">{t(ROLE_LABEL.viewer)}</option>
                    </select>
                  ) : (
                    <span className="text-helper text-ink-muted">{t(ROLE_LABEL[m.role])}</span>
                  )}
                  {(owner || m.user_id === currentUserId) && (
                    <button
                      type="button"
                      aria-label={m.user_id === currentUserId ? t("Leave this book") : t("Remove {email}", { email: m.email ?? "" })}
                      title={m.user_id === currentUserId ? t("Leave this book") : t("Remove")}
                      onClick={() => {
                        const leaving = m.user_id === currentUserId;
                        if (!window.confirm(leaving ? t("Leave this book? You'll need a new link to come back.") : t("Remove {email} from this book?", { email: m.email ?? "" }))) return;
                        void act(async () => {
                          await removeMember(bookId, m.user_id);
                          if (leaving) onLeft();
                          else setMembers((prev) => prev?.filter((x) => x.user_id !== m.user_id) ?? null);
                        });
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
