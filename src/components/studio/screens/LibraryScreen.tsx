"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Palette, Plus, Search, ShieldCheck, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Thumbnail from "@/components/studio/ui/Thumbnail";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import EmptyLibraryScreen from "@/components/studio/modals/EmptyLibraryScreen";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase/client";
import { createBook, deleteBook, duplicateBook, listBooks, readProjectFromFile, saveBook, type StoredBook } from "@/utils/storage";

const NAV_ITEMS = ["All books", "Drafts", "Published", "Loose pages", "Templates"] as const;
type NavItem = (typeof NAV_ITEMS)[number];

function bookThumbnail(book: StoredBook): string | undefined {
  return book.pages.find((p) => p.isCover)?.thumbnailDataUrl ?? book.pages[0]?.thumbnailDataUrl;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function bookMeta(book: StoredBook): string {
  const pageCount = `${book.pages.length} page${book.pages.length === 1 ? "" : "s"}`;
  return book.status === "published" ? `${pageCount} · published` : `${pageCount} · ${relativeTime(book.updatedAt)}`;
}

/**
 * 2c: library, restyled to the light shell — the real /studio root.
 * Backed by utils/storage.ts's multi-book library (localStorage), not
 * mock data. "Collections" is a real, user-assigned free-text field now
 * (StoredBook.collection) — the sidebar list is derived from whatever
 * values are actually in use, not a fixed decorative list.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState<NavItem>(NAV_ITEMS[0]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<StoredBook[] | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function refresh() {
    listBooks()
      .then(setBooks)
      .catch((err) => window.alert(err instanceof Error ? err.message : "Could not load your books."));
  }

  useEffect(() => {
    refresh();
    // Only decides whether to show the Admin link; the admin page and RLS
    // enforce access on their own. An error (e.g. the admin_role migration
    // not run yet) just means no link.
    supabase.rpc("is_admin").then(({ data }) => setIsSupervisor(data === true));
  }, []);

  function handleOpen(id: string) {
    router.push(`/studio/editor?book=${id}`);
  }

  function handleColor(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    router.push(`/studio/color?book=${id}`);
  }

  function handleNewBook() {
    router.push("/studio/onboarding");
  }

  async function handleImportFile(file: File) {
    try {
      const project = await readProjectFromFile(file);
      const book = await createBook(project.title, project.pages);
      handleOpen(book.id);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not import that file.");
    }
  }

  async function handleDelete(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${book.title}"? This can't be undone.`)) return;
    try {
      await deleteBook(book.id);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete this book.");
    }
  }

  async function handleDuplicate(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation();
    try {
      await duplicateBook(book);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not duplicate this book.");
    }
  }

  async function handleAssignCollection(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation();
    const next = window.prompt("Collection name (leave blank to remove)", book.collection ?? "");
    if (next === null) return;
    try {
      await saveBook({ ...book, collection: next.trim() || undefined, updatedAt: new Date().toISOString() });
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not update this book's collection.");
    }
  }

  const isLoading = books === null;
  const collections = Array.from(new Set((books ?? []).map((b) => b.collection).filter((c): c is string => Boolean(c)))).sort();
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = (books ?? []).filter((book) => {
    if (activeNav === "Drafts" && book.status !== "draft") return false;
    if (activeNav === "Published" && book.status !== "published") return false;
    if (activeNav === "Loose pages" || activeNav === "Templates") return false; // no such concept in the data model yet — honest empty, not fabricated
    if (activeCollection && book.collection !== activeCollection) return false;
    if (normalizedQuery && !book.title.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
  const totalPages = (books ?? []).reduce((sum, b) => sum + b.pages.length, 0);

  return (
    <div className="flex min-h-screen bg-surface">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleImportFile(file);
        }}
      />

      <aside className="flex w-[196px] shrink-0 flex-col gap-6 border-r border-hairline bg-panel p-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-[26px] w-[26px] rounded-[9px] bg-accent" aria-hidden />
          <p className="text-card-title font-semibold text-ink">Pagewright</p>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveNav(item)}
              className={cn(
                "rounded-row-sm px-3 py-2 text-left text-body outline-none transition-colors duration-150 motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                activeNav === item ? "bg-panel text-ink shadow-resting" : "text-ink-secondary hover:bg-inset-alt"
              )}
            >
              {item}
            </button>
          ))}
        </nav>

        {collections.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <MetaLabel className="px-3">Collections</MetaLabel>
            {collections.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCollection((current) => (current === c ? null : c))}
                className={cn(
                  "rounded-row-sm px-3 py-2 text-left text-body outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  activeCollection === c ? "bg-panel text-ink shadow-resting" : "text-ink-secondary hover:bg-inset-alt"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {isSupervisor && (
          <Link
            href="/studio/admin"
            className="mt-auto flex items-center gap-2 rounded-row-sm px-3 py-2 text-body text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <ShieldCheck size={14} aria-hidden />
            Admin
          </Link>
        )}
      </aside>

      <div className="flex-1 p-8">
        {!isLoading && (books?.length ?? 0) === 0 ? (
          <div className="flex min-h-[70vh] items-center justify-center">
            <EmptyLibraryScreen onNewBook={handleNewBook} onFromTemplate={handleNewBook} onImportSketch={() => fileInputRef.current?.click()} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-page-title font-semibold tracking-[-0.02em] text-ink">{activeCollection ?? activeNav}</h1>
                <MetaLabel>
                  {filtered.length} books · {totalPages} pages
                </MetaLabel>
              </div>
              <div className="flex flex-1 items-center justify-end gap-2">
                <div className="relative w-full max-w-[220px]">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search books…"
                    aria-label="Search books"
                    className="w-full rounded-pill border border-hairline bg-panel py-1.5 pl-8 pr-3 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  />
                </div>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  Import art
                </Button>
                <Button variant="primary" onClick={handleNewBook}>
                  New book
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-4">
              {filtered.map((book) => (
                <div key={book.id} className="group relative flex flex-col gap-2 rounded-panel bg-panel p-2.5 shadow-panel">
                  <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => handleColor(e, book.id)}
                      aria-label={`Color ${book.title}`}
                      className="flex h-6 w-6 items-center justify-center rounded-pill bg-panel text-ink-muted shadow-toolbar outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      <Palette size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDuplicate(e, book)}
                      aria-label={`Duplicate ${book.title}`}
                      className="flex h-6 w-6 items-center justify-center rounded-pill bg-panel text-ink-muted shadow-toolbar outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, book)}
                      aria-label={`Delete ${book.title}`}
                      className="flex h-6 w-6 items-center justify-center rounded-pill bg-panel text-ink-muted shadow-toolbar outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <Thumbnail
                    src={bookThumbnail(book)}
                    style={{ width: "100%", aspectRatio: "3 / 4" }}
                    onClick={() => handleOpen(book.id)}
                    alt={book.title}
                    badge={book.status === "draft" ? <span className="rounded-pill bg-accent px-2 py-0.5 text-mono font-medium uppercase tracking-[0.09em] text-white">Draft</span> : undefined}
                  />
                  <button type="button" onClick={() => handleOpen(book.id)} className="px-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                    <p className="text-body font-medium text-ink">{book.title}</p>
                    <MetaLabel>{bookMeta(book)}</MetaLabel>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleAssignCollection(e, book)}
                    className="px-0.5 pb-1 text-left text-helper text-ink-muted outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {book.collection ?? "+ Add to collection"}
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={handleNewBook}
                className="flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-hairline text-ink-muted outline-none transition-colors duration-150 hover:bg-inset-alt motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ aspectRatio: "3 / 4" }}
              >
                <Plus size={20} />
                <MetaLabel>New book</MetaLabel>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
