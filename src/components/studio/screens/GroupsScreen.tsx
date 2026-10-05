"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, GraduationCap, House, KeyRound, Loader2, Printer, Trash2, UserPlus, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { listBooks, type StoredBook } from "@/utils/storage";
import { KidAvatar, PIN_PICTURES, PinPicture } from "@/components/kids/kidIcons";
import { Sticker, STICKERS } from "@/components/studio/coloring/rewards";
import {
  addMembers,
  createGroup,
  deleteGroup,
  deleteMember,
  isMissingGroupsTable,
  listGroupBooks,
  listGroups,
  listGroupWork,
  listMembers,
  renameGroup,
  resetMember,
  rewardWork,
  setGroupBook,
  updateMember,
  type GroupKind,
  type KidGroup,
  type KidMember,
  type KidWork,
} from "@/utils/kidGroups";

const FIELD = "h-9 rounded-row-sm border border-hairline bg-panel px-2.5 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * Classes & families (grown-up side): make a group, add the children, give
 * it books, and see — and reward — what each child has colored.
 * Children sign in at /kids/<code> (see sql/10_kid_groups.sql).
 */
export default function GroupsScreen() {
  const t = useT();
  const [groups, setGroups] = useState<KidGroup[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<GroupKind>("class");

  const load = useCallback(async () => {
    try {
      const list = await listGroups();
      setGroups(list);
      setSelectedId((id) => (id && list.some((g) => g.id === id) ? id : (list[0]?.id ?? null)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(isMissingGroupsTable(message) ? t("Classes aren't set up yet — run sql/10_kid_groups.sql in Supabase.") : message);
      setGroups([]);
    }
  }, [t]);

  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch, state set after await
  }, [load]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const g = await createGroup(newName, newKind);
      setGroups((prev) => [...(prev ?? []), g]);
      setSelectedId(g.id);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not create the group."));
    }
  }

  const selected = groups?.find((g) => g.id === selectedId) ?? null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <MetaLabel>Pagewright</MetaLabel>
          <h1 className="text-page-title font-semibold tracking-[-0.02em] text-ink">{t("Classes & families")}</h1>
          <p className="text-body text-ink-secondary">{t("Children color the books you give them on any tablet; their pages are kept here for you.")}</p>
        </div>
        <Link href="/studio" className="text-body font-medium text-ink-secondary hover:text-ink">
          ← {t("Back to the studio")}
        </Link>
      </header>

      {error && (
        <p role="alert" className="rounded-row-sm bg-error/10 px-4 py-3 text-body text-error">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="flex h-fit flex-col gap-3 p-4">
          <MetaLabel>{t("Your groups")}</MetaLabel>
          {groups === null ? (
            <p className="text-helper text-ink-muted">{t("Loading…")}</p>
          ) : groups.length === 0 ? (
            <p className="text-helper text-ink-muted">{t("No groups yet. Make one for your class or your family.")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {groups.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => setSelectedId(g.id)} aria-current={g.id === selectedId} className={cn("flex w-full items-center gap-2 rounded-row-sm px-2.5 py-2 text-left text-body outline-none focus-visible:ring-2 focus-visible:ring-accent", g.id === selectedId ? "bg-accent-tint font-semibold text-accent" : "text-ink hover:bg-inset-alt")}>
                    {g.kind === "class" ? <GraduationCap size={15} aria-hidden /> : <House size={15} aria-hidden />}
                    <span className="truncate">{g.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-col gap-2 border-t border-hairline pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <MetaLabel>{t("New group")}</MetaLabel>
            <div role="radiogroup" aria-label={t("Kind of group")} className="flex gap-1.5">
              {(["class", "family"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={newKind === k} onClick={() => setNewKind(k)} className={cn("flex-1 rounded-pill border px-2 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", newKind === k ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary")}>
                  {k === "class" ? t("Class") : t("Family")}
                </button>
              ))}
            </div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} placeholder={newKind === "class" ? t("e.g. Class 2B") : t("e.g. The Papadopoulos kids")} aria-label={t("Group name")} className={FIELD} />
            <Button type="submit" variant="primary" size="sm" disabled={!newName.trim()}>
              {t("Create")}
            </Button>
          </form>
        </Card>

        {selected ? <GroupDetail key={selected.id} group={selected} onChanged={(g) => setGroups((prev) => prev?.map((x) => (x.id === g.id ? g : x)) ?? null)} onDeleted={() => void load()} /> : groups && groups.length > 0 ? null : <Card className="p-8 text-center text-body text-ink-secondary">{t("Make a group on the left to start.")}</Card>}
      </div>
    </div>
  );
}

function GroupDetail({ group, onChanged, onDeleted }: { group: KidGroup; onChanged: (g: KidGroup) => void; onDeleted: () => void }) {
  const t = useT();
  const [members, setMembers] = useState<KidMember[] | null>(null);
  const [books, setBooks] = useState<StoredBook[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [work, setWork] = useState<KidWork[]>([]);
  const [names, setNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rewarding, setRewarding] = useState<KidWork | null>(null);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/kids/${group.code}` : `/kids/${group.code}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [m, b, a] = await Promise.all([listMembers(group.id), listBooks().catch(() => []), listGroupBooks(group.id)]);
      const w = await listGroupWork(m.map((x) => x.id));
      if (cancelled) return;
      setMembers(m);
      setBooks(b);
      setAssigned(a);
      setWork(w);
    })();
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  async function handleAdd() {
    const list = names.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    try {
      const added = await addMembers(group.id, list);
      setMembers((prev) => [...(prev ?? []), ...added].sort((a, b) => a.name.localeCompare(b.name)));
      setNames("");
    } finally {
      setBusy(false);
    }
  }

  async function toggleBook(bookId: string, on: boolean) {
    setAssigned((prev) => (on ? [...prev, bookId] : prev.filter((id) => id !== bookId)));
    await setGroupBook(group.id, bookId, on).catch(() => setAssigned((prev) => (on ? prev.filter((id) => id !== bookId) : [...prev, bookId])));
  }

  async function handleReset(m: KidMember) {
    if (!window.confirm(t("Give {name} new pictures? Tablets where {name} is signed in will ask again.", { name: m.name }))) return;
    const fresh = await resetMember(m.id);
    setMembers((prev) => prev?.map((x) => (x.id === m.id ? fresh : x)) ?? null);
  }

  async function handleDeleteMember(m: KidMember) {
    if (!window.confirm(t("Remove {name}? Their colored pages are deleted too.", { name: m.name }))) return;
    await deleteMember(m.id);
    setMembers((prev) => prev?.filter((x) => x.id !== m.id) ?? null);
    setWork((prev) => prev.filter((w) => w.member_id !== m.id));
  }

  async function handleDeleteGroup() {
    if (!window.confirm(t("Delete “{name}” with all its children and their pages? This can't be undone.", { name: group.name }))) return;
    await deleteGroup(group.id);
    onDeleted();
  }

  const workByMember = useMemo(() => {
    const map = new Map<string, KidWork[]>();
    for (const w of work) if (w.completed_at && w.thumb) map.set(w.member_id, [...(map.get(w.member_id) ?? []), w]);
    return map;
  }, [work]);
  const bookTitle = (id: string) => books.find((b) => b.id === id)?.title ?? t("A book");

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <MetaLabel>{group.kind === "class" ? t("Class") : t("Family")}</MetaLabel>
          <input
            defaultValue={group.name}
            aria-label={t("Group name")}
            maxLength={80}
            onBlur={(e) => {
              const name = e.target.value.trim();
              if (name && name !== group.name) void renameGroup(group.id, name).then(() => onChanged({ ...group, name }));
            }}
            className="bg-transparent text-section-title font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-row-sm bg-inset-alt px-4 py-2">
          <MetaLabel>{t("Code for the children")}</MetaLabel>
          <p className="font-pw-mono text-[28px] font-bold tracking-[0.2em] text-ink" data-testid="group-code">
            {group.code}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy size={13} />}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(joinUrl)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => undefined);
            }}
          >
            {copied ? t("Copied") : t("Copy the link")}
          </Button>
          <Button variant="secondary" size="sm" icon={<Printer size={13} />} onClick={() => printLoginCards(group, members ?? [], joinUrl, t)} disabled={!members?.length}>
            {t("Print sign-in cards")}
          </Button>
        </div>
        <p className="w-full text-helper text-ink-muted">{t("Children open {url} (or type the code at /kids), tap their name, then their two pictures.", { url: joinUrl })}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <p className="text-section-title font-semibold text-ink">{t("Children")}</p>
        {members === null ? (
          <p className="text-helper text-ink-muted">{t("Loading…")}</p>
        ) : members.length === 0 ? (
          <p className="text-helper text-ink-muted">{t("No children yet — add their first names below.")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2">
                <button type="button" title={t("Change picture")} aria-label={t("Change {name}'s picture", { name: m.name })} onClick={() => void updateMember(m.id, { avatar: (m.avatar + 1) % STICKERS.length }).then(() => setMembers((prev) => prev?.map((x) => (x.id === m.id ? { ...x, avatar: (x.avatar + 1) % STICKERS.length } : x)) ?? null))} className="rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <KidAvatar index={m.avatar} size={36} />
                </button>
                <span className="flex-1 truncate text-body font-medium text-ink">{m.name}</span>
                <span className="flex items-center gap-1" title={t("{name}'s pictures", { name: m.name })} aria-label={t("{name}'s pictures: {a} and {b}", { name: m.name, a: t(PIN_PICTURES[m.pin[0]].name), b: t(PIN_PICTURES[m.pin[1]].name) })}>
                  <PinPicture index={m.pin[0]} size={30} />
                  <PinPicture index={m.pin[1]} size={30} />
                </span>
                <span className="w-16 text-right text-helper text-ink-muted">{t("{n} done", { n: workByMember.get(m.id)?.length ?? 0 })}</span>
                <button type="button" title={t("New pictures")} aria-label={t("New pictures for {name}", { name: m.name })} onClick={() => void handleReset(m)} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
                  <KeyRound size={14} />
                </button>
                <button type="button" title={t("Remove")} aria-label={t("Remove {name}", { name: m.name })} onClick={() => void handleDeleteMember(m)} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex items-start gap-2 border-t border-hairline pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}
        >
          <textarea value={names} onChange={(e) => setNames(e.target.value)} rows={2} placeholder={t("First names, one per line (or separated by commas)")} aria-label={t("Children's names")} className={cn(FIELD, "h-auto flex-1 py-2")} />
          <Button type="submit" variant="primary" size="sm" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />} disabled={busy || !names.trim()}>
            {t("Add")}
          </Button>
        </form>
        <p className="text-helper text-ink-muted">{t("First names or nicknames are enough — no email, no surnames.")}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-5">
        <p className="text-section-title font-semibold text-ink">{t("Books to color")}</p>
        {books.length === 0 ? (
          <p className="text-helper text-ink-muted">{t("You have no books yet. Make one in the studio first.")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {books.map((b) => (
              <label key={b.id} className="flex items-center gap-2.5 rounded-row-sm px-2 py-1.5 text-body text-ink hover:bg-inset-alt">
                <input type="checkbox" checked={assigned.includes(b.id)} onChange={(e) => void toggleBook(b.id, e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
                <span className="truncate">{b.title}</span>
                <span className="ml-auto text-helper text-ink-muted">{t("{n} pages", { n: b.pages.filter((p) => !p.isBlankBack).length })}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <p className="text-section-title font-semibold text-ink">{t("Their pages")}</p>
        {(members ?? []).every((m) => !workByMember.get(m.id)?.length) ? (
          <p className="text-helper text-ink-muted">{t("Finished pages show up here. Click one to give a sticker or a note.")}</p>
        ) : (
          (members ?? []).map((m) => {
            const done = workByMember.get(m.id) ?? [];
            if (done.length === 0) return null;
            return (
              <section key={m.id} aria-label={m.name} className="flex flex-col gap-2">
                <p className="flex items-center gap-2 text-body font-semibold text-ink">
                  <KidAvatar index={m.avatar} size={24} /> {m.name}
                </p>
                <div className="flex flex-wrap gap-3">
                  {done.map((w) => (
                    <button key={`${w.book_id}/${w.page_id}`} type="button" onClick={() => setRewarding(w)} title={bookTitle(w.book_id)} aria-label={t("{name}'s page from “{title}”", { name: m.name, title: bookTitle(w.book_id) })} className="relative h-[130px] w-[100px] overflow-hidden rounded-paper-sm bg-white shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      {/* eslint-disable-next-line @next/next/no-img-element -- the child's page snapshot (data URL) */}
                      <img src={w.thumb!} alt="" className="h-full w-full object-contain" />
                      {w.sticker !== null && (
                        <span className="absolute right-1 top-1">
                          <Sticker index={w.sticker} size={28} />
                        </span>
                      )}
                      {w.comment && <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-1.5 py-0.5 text-[10px] text-white">{w.comment}</span>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => void handleDeleteGroup()}>
          {t("Delete this group")}
        </Button>
      </div>

      {rewarding && (
        <RewardDialog
          work={rewarding}
          childName={members?.find((m) => m.id === rewarding.member_id)?.name ?? ""}
          onSave={async (changes) => {
            await rewardWork(rewarding, changes);
            setWork((prev) => prev.map((w) => (w.member_id === rewarding.member_id && w.book_id === rewarding.book_id && w.page_id === rewarding.page_id ? { ...w, ...changes } : w)));
            setRewarding(null);
          }}
          onClose={() => setRewarding(null)}
        />
      )}
    </div>
  );
}

function RewardDialog({ work, childName, onSave, onClose }: { work: KidWork; childName: string; onSave: (changes: { sticker: number | null; comment: string | null }) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [sticker, setSticker] = useState<number | null>(work.sticker);
  const [comment, setComment] = useState(work.comment ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="reward-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()} className="flex w-[520px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel">
        <div className="flex items-center justify-between">
          <p id="reward-title" className="text-modal-title font-semibold text-ink">
            {t("{name}'s page", { name: childName })}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- the child's page snapshot (data URL) */}
        <img src={work.thumb!} alt={t("{name}'s page", { name: childName })} className="mx-auto max-h-[300px] rounded-paper-sm bg-white object-contain shadow-resting" />
        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("Give a sticker")}</MetaLabel>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Give a sticker")}>
            {STICKERS.map((s, i) => (
              <button key={s.name} type="button" role="radio" aria-checked={sticker === i} aria-label={t(s.name)} onClick={() => setSticker(sticker === i ? null : i)} className={cn("rounded-pill p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent", sticker === i && "ring-2 ring-accent")}>
                <Sticker index={i} size={36} />
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <MetaLabel>{t("A note for {name}", { name: childName })}</MetaLabel>
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder={t("e.g. Beautiful colors!")} className={FIELD} />
        </label>
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void onSave({ sticker, comment: comment.trim() || null }).finally(() => setSaving(false));
            }}
          >
            {t("Save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** One card per child: name, group code, link and their two pictures — printed and cut out for the classroom. */
function printLoginCards(group: KidGroup, members: KidMember[], joinUrl: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const picture = (i: number) => {
    const p = PIN_PICTURES[i];
    return `<span class="pic" style="border-color:${p.color};color:${p.color}">${esc(t(p.name))}</span>`;
  };
  const cards = members
    .map((m) => `<div class="card"><p class="name">${esc(m.name)}</p><p class="label">${esc(t("Your pictures"))}</p><p class="pics">${picture(m.pin[0])}${picture(m.pin[1])}</p><p class="code">${esc(t("Code"))}: <b>${esc(group.code)}</b></p><p class="url">${esc(joinUrl)}</p></div>`)
    .join("");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(group.name)}</title><style>
    @page{size:A4;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#14151a}
    h1{font-size:18px;margin:0 0 8mm}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
    .card{border:2px dashed #9aa1ad;border-radius:6mm;padding:5mm 6mm;break-inside:avoid}
    .name{font-size:24px;font-weight:800;margin:0 0 3mm}.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 1.5mm}
    .pics{display:flex;gap:3mm;margin:0 0 3mm}.pic{border:2px solid;border-radius:3mm;padding:1.5mm 3mm;font-weight:700;font-size:15px}
    .code{font-size:14px;margin:0 0 1mm}.code b{font-family:monospace;font-size:18px;letter-spacing:.15em}.url{font-size:10px;color:#6b7280;margin:0;word-break:break-all}
  </style></head><body><h1>${esc(group.name)} · ${esc(t("Sign-in cards"))}</h1><div class="grid">${cards}</div></body></html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  }, 200);
}
