"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import StatusDot from "@/components/studio/ui/StatusDot";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth";
import { deleteBook } from "@/utils/storage";
import type { AdminUserRow, BookRow } from "@/types/database";

type AdminBook = Pick<BookRow, "id" | "user_id" | "title" | "status" | "collection" | "updated_at">;

type LoadState = { kind: "loading" } | { kind: "forbidden" } | { kind: "error"; message: string } | { kind: "ready"; users: AdminUserRow[]; books: AdminBook[] };

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const formatDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

/**
 * Supervisor view — every account and every book. The real gate is in
 * Postgres (supabase/migrations/…_admin_role.sql): `admin_list_users()`
 * raises for non-admins and the books "read all" RLS policy only matches
 * admins. The `is_admin()` check here only decides what to render.
 */
export default function AdminScreen() {
  const { user: me } = useSession();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError) return setState({ kind: "error", message: adminError.message });
    if (!isAdmin) return setState({ kind: "forbidden" });

    const [usersRes, booksRes] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase.from("books").select("id, user_id, title, status, collection, updated_at").order("updated_at", { ascending: false }),
    ]);
    if (usersRes.error) return setState({ kind: "error", message: usersRes.error.message });
    if (booksRes.error) return setState({ kind: "error", message: booksRes.error.message });
    setState({ kind: "ready", users: usersRes.data ?? [], books: booksRes.data ?? [] });
  }, []);

  useEffect(() => {
    // Async fetch; setState happens after the awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const booksByUser = useMemo(() => {
    const map = new Map<string, AdminBook[]>();
    if (state.kind !== "ready") return map;
    for (const book of state.books) {
      const list = map.get(book.user_id) ?? [];
      list.push(book);
      map.set(book.user_id, list);
    }
    return map;
  }, [state]);

  async function handleDelete(book: AdminBook, ownerEmail: string) {
    if (!window.confirm(`Delete "${book.title}" (owned by ${ownerEmail})? This can't be undone.`)) return;
    try {
      await deleteBook(book.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't delete the book.");
      return;
    }
    await load();
  }

  async function handleSetSupervisor(user: AdminUserRow, makeSupervisor: boolean) {
    const prompt = makeSupervisor
      ? `Make ${user.email} a supervisor? They'll see every account and be able to delete any book.`
      : `Remove supervisor access from ${user.email}?`;
    if (!window.confirm(prompt)) return;
    const { error } = await supabase.rpc("admin_set_supervisor", { target_user: user.id, make_supervisor: makeSupervisor });
    if (error) {
      window.alert(error.message);
      return;
    }
    await load();
  }

  if (state.kind === "loading") {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (state.kind === "forbidden") {
    return (
      <CenteredMessage>
        <p className="text-section-title font-semibold text-ink">Supervisors only</p>
        <p>This account doesn&apos;t have access to the admin area.</p>
        <Link href="/studio" className="font-medium text-accent">
          Back to the studio
        </Link>
      </CenteredMessage>
    );
  }
  if (state.kind === "error") {
    return (
      <CenteredMessage>
        <p className="text-section-title font-semibold text-ink">Couldn&apos;t load the admin data</p>
        <p className="text-error">{state.message}</p>
        <Button variant="secondary" onClick={() => void load()}>
          Try again
        </Button>
      </CenteredMessage>
    );
  }

  const q = query.trim().toLowerCase();
  const users = q ? state.users.filter((u) => u.email.toLowerCase().includes(q)) : state.users;
  const confirmedCount = state.users.filter((u) => u.email_confirmed_at).length;
  const publishedCount = state.books.filter((b) => b.status === "published").length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <MetaLabel>Pagewright · Supervisor</MetaLabel>
          <h1 className="text-page-title font-semibold tracking-[-0.02em] text-ink">Admin</h1>
        </div>
        <Link href="/studio" className="text-body font-medium text-ink-secondary hover:text-ink">
          ← Back to studio
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accounts" value={state.users.length} />
        <Stat label="Confirmed" value={confirmedCount} />
        <Stat label="Books" value={state.books.length} />
        <Stat label="Published" value={publishedCount} />
      </div>

      <Card className="flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4">
          <p className="text-section-title font-semibold text-ink">Accounts</p>
          <label className="flex items-center gap-2 text-helper text-ink-secondary">
            <span className="sr-only">Search accounts by email</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email…"
              className="w-56 rounded-row-sm border border-hairline px-3 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-ring"
            />
          </label>
        </div>

        {users.length === 0 ? (
          <p className="px-5 py-8 text-center text-body text-ink-muted">No accounts match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {users.map((user) => {
              const open = openUserId === user.id;
              const books = booksByUser.get(user.id) ?? [];
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenUserId(open ? null : user.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-left outline-none hover:bg-inset-alt focus-visible:bg-inset-alt sm:grid-cols-[minmax(0,1fr)_130px_150px_70px_16px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusDot tone={user.email_confirmed_at ? "success" : "warning"} />
                      <span className="truncate text-body font-medium text-ink">{user.email}</span>
                      {user.is_admin && <MetaLabel tone="accent">Supervisor</MetaLabel>}
                    </span>
                    <span className="hidden text-helper text-ink-muted sm:block">{user.email_confirmed_at ? "Confirmed" : "Unconfirmed"}</span>
                    <span className="hidden text-helper text-ink-muted sm:block" title="Last sign-in">
                      {formatDate(user.last_sign_in_at)}
                    </span>
                    <span className="text-helper text-ink-secondary sm:text-right">
                      {user.book_count} {user.book_count === 1 ? "book" : "books"}
                    </span>
                    <span aria-hidden className={`hidden text-ink-muted transition-transform sm:block ${open ? "rotate-90" : ""}`}>
                      ›
                    </span>
                  </button>

                  {open && (
                    <div className="flex flex-col gap-2 bg-surface/60 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <MetaLabel>Joined {formatDate(user.created_at)}</MetaLabel>
                        {user.id === me?.id ? (
                          <MetaLabel>This is you</MetaLabel>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => void handleSetSupervisor(user, !user.is_admin)}>
                            {user.is_admin ? "Remove supervisor" : "Make supervisor"}
                          </Button>
                        )}
                      </div>
                      {books.length === 0 ? (
                        <p className="text-body text-ink-muted">No books yet.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {books.map((book) => (
                            <li key={book.id} className="flex items-center justify-between gap-3 rounded-row-sm bg-panel px-3 py-2 shadow-resting">
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate text-body font-medium text-ink">{book.title}</span>
                                <span className="text-helper text-ink-muted">
                                  {book.status === "published" ? "Published" : "Draft"}
                                  {book.collection ? ` · ${book.collection}` : ""} · edited {formatDate(book.updated_at)}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Link
                                  href={`/studio/editor?book=${encodeURIComponent(book.id)}`}
                                  title="Open in review mode to leave comments"
                                  className="rounded-pill px-3 py-1.5 text-helper font-medium text-accent outline-none hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent"
                                >
                                  Review
                                </Link>
                                <Button variant="ghost" size="sm" onClick={() => void handleDelete(book, user.email)}>
                                  Delete
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1 px-5 py-4">
      <MetaLabel>{label}</MetaLabel>
      <span className="text-page-title font-semibold text-ink">{value}</span>
    </Card>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center text-body text-ink-secondary">{children}</div>;
}
