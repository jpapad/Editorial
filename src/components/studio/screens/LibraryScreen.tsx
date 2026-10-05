"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, BookHeart, BookOpen, Lightbulb, BookPlus, Copy, LayoutTemplate, Palette, Plus, Search, ShieldCheck, Sparkles, Trash2, Upload, Users } from "lucide-react";
import Thumbnail from "@/components/studio/ui/Thumbnail";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import EmptyLibraryScreen from "@/components/studio/modals/EmptyLibraryScreen";
import TemplatesGallery from "@/components/studio/screens/TemplatesGallery";
import BookFromDescriptionDialog from "@/components/studio/screens/BookFromDescriptionDialog";
import StoryBookDialog from "@/components/studio/screens/StoryBookDialog";
import NicheIdeasDialog from "@/components/studio/screens/NicheIdeasDialog";
import { cn } from "@/utils/cn";
import { LanguageToggle, useT, type TFunction } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { useAiUsage } from "@/lib/aiUsage";
import { trimShortLabel } from "@/utils/trimSizes";
import { bookReadiness } from "@/utils/readiness";
import { ReadinessRing, readinessLabel } from "@/components/studio/editor/ReadinessCard";
import { supabase } from "@/lib/supabase/client";
import { nextVolumePages, nextVolumeTitle } from "@/utils/volumes";
import { createBook, deleteBook, duplicateBook, listBooks, readProjectFromFile, saveBook, type StoredBook } from "@/utils/storage";

const NAV_ITEMS = ["All books", "Drafts", "Published", "Templates"] as const;
type NavItem = (typeof NAV_ITEMS)[number];

function bookThumbnail(book: StoredBook): string | undefined {
  return book.pages.find((p) => p.isCover)?.thumbnailDataUrl ?? book.pages[0]?.thumbnailDataUrl;
}

function relativeTime(iso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return t("just now");
  if (minutes < 60) return t("{n}m ago", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("{n}h ago", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return t("{n}d ago", { n: days });
  return t("{n}w ago", { n: Math.round(days / 7) });
}

function bookMeta(book: StoredBook, t: TFunction): string {
  const pageCount = book.pages.length === 1 ? t("1 page") : t("{n} pages", { n: book.pages.length });
  return book.status === "published" ? `${pageCount} · ${t("published")}` : `${pageCount} · ${relativeTime(book.updatedAt, t)}`;
}

const ISLAND = "pw-glass rounded-[18px] shadow-panel";
const CHIP =
  "flex h-9 items-center gap-2 rounded-[12px] px-3.5 text-helper font-semibold outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent";

/**
 * The library (/studio root), Pagewright 2026 layout: glass islands on the
 * dotted workspace — search in the top bar, "Continue" for the book you
 * touched last, quick starts, and filters/collections as chips. Backed by
 * utils/storage.ts (Supabase). "Collections" is the user-assigned
 * StoredBook.collection field; the chips are whatever values are in use.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const t = useT();
  const [activeNav, setActiveNav] = useState<NavItem>(NAV_ITEMS[0]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<StoredBook[] | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [describe, setDescribe] = useState("");
  const [describeOpen, setDescribeOpen] = useState<string | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [nicheOpen, setNicheOpen] = useState(false);

  function refresh() {
    listBooks()
      .then(setBooks)
      .catch((err) => window.alert(err instanceof Error ? err.message : t("Could not load your books.")));
  }

  useEffect(() => {
    refresh();
    // Only decides whether to show the Admin link; the admin page and RLS
    // enforce access on their own. An error (e.g. the admin_role migration
    // not run yet) just means no link.
    supabase.rpc("is_admin").then(({ data }) => setIsSupervisor(data === true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
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
    if (!window.confirm(t("Delete “{title}”? This can't be undone.", { title: book.title }))) return;
    try {
      await deleteBook(book.id);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not delete this book."));
    }
  }

  async function handleDuplicate(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation();
    try {
      await duplicateBook(book);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not duplicate this book."));
    }
  }

  /** A new book shaped like this one — front matter, frames, numbering and cover kept, pictures cleared — in the same collection. */
  async function handleNextVolume(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation();
    try {
      const next = await createBook(nextVolumeTitle(book.title), nextVolumePages(book.pages), book.trimSize);
      await saveBook({ ...next, collection: book.collection ?? book.title, bleed: book.bleed, paper: book.paper, cover: book.cover ? structuredClone(book.cover) : book.cover });
      // The first volume joins the series too, so the two sit together.
      if (!book.collection) await saveBook({ ...book, collection: book.title });
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not start the next volume."));
    }
  }

  async function handleAssignCollection(e: React.MouseEvent, book: StoredBook) {
    e.stopPropagation();
    const next = window.prompt(t("Collection name (leave blank to remove)"), book.collection ?? "");
    if (next === null) return;
    try {
      await saveBook({ ...book, collection: next.trim() || null, updatedAt: new Date().toISOString() });
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not update this book's collection."));
    }
  }

  const isLoading = books === null;
  const collections = Array.from(new Set((books ?? []).map((b) => b.collection).filter((c): c is string => Boolean(c)))).sort();
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = (books ?? []).filter((book) => {
    if (activeNav === "Drafts" && book.status !== "draft") return false;
    if (activeNav === "Published" && book.status !== "published") return false;
    if (activeCollection && book.collection !== activeCollection) return false;
    if (normalizedQuery && !book.title.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
  const counts: Record<NavItem, number | null> = {
    "All books": books?.length ?? 0,
    Drafts: (books ?? []).filter((b) => b.status === "draft").length,
    Published: (books ?? []).filter((b) => b.status === "published").length,
    Templates: null,
  };
  // listBooks() is newest-edited first, so the first book is the one to continue.
  const lastBook = books?.[0];
  const showHero = Boolean(lastBook) && activeNav === "All books" && !activeCollection && !normalizedQuery;

  return (
    <div className="pw-workspace flex min-h-screen flex-col gap-6 px-7 pb-10 pt-5 text-ink">
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

      <header className="flex items-center gap-4">
        <div className={cn(ISLAND, "flex h-[52px] items-center gap-2.5 pl-2 pr-4")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-ink text-on-ink" aria-hidden>
            <BookOpen size={17} />
          </span>
          <p className="text-section-title font-extrabold tracking-[-0.02em] text-ink">Pagewright</p>
        </div>

        <label className={cn(ISLAND, "mx-auto flex h-[52px] w-full max-w-[560px] items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-accent")}>
          <Search size={17} className="shrink-0 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search books…")}
            aria-label={t("Search books")}
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
          />
        </label>

        <div className={cn(ISLAND, "flex h-[52px] items-center gap-2 px-2")}>
          <AiCredits />
          <Link
            href="/studio/groups"
            className="flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-helper font-semibold text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Users size={15} aria-hidden />
            {t("Classes & families")}
          </Link>
          {isSupervisor && (
            <Link
              href="/studio/admin"
              className="flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-helper font-semibold text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ShieldCheck size={15} aria-hidden />
              {t("Admin")}
            </Link>
          )}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      {nicheOpen && (
        <NicheIdeasDialog
          onClose={() => setNicheOpen(false)}
          onPlan={(description) => {
            setNicheOpen(false);
            setDescribeOpen(description);
          }}
        />
      )}
      {storyOpen && <StoryBookDialog onClose={() => setStoryOpen(false)} onCreated={handleOpen} />}
      {describeOpen !== null && <BookFromDescriptionDialog initialDescription={describeOpen} onClose={() => setDescribeOpen(null)} onCreated={handleOpen} />}

      {!isLoading && (books?.length ?? 0) === 0 && activeNav !== "Templates" ? (
        <div className="flex min-h-[70vh] items-center justify-center">
          <EmptyLibraryScreen onNewBook={handleNewBook} onFromTemplate={() => setActiveNav("Templates")} onImportSketch={() => fileInputRef.current?.click()} />
        </div>
      ) : (
        <>
          {showHero && lastBook && (
            <section className="flex gap-5" aria-label={t("Continue where you left off")}>
              <div className={cn(ISLAND, "relative flex min-h-[260px] flex-1 gap-8 overflow-hidden rounded-[26px] px-7 py-6")}>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <MetaLabel>
                    {t("Continue")} · {relativeTime(lastBook.updatedAt, t)}
                  </MetaLabel>
                  <h1 className="truncate text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">{lastBook.title}</h1>
                  <p className="text-body text-ink-secondary">
                    {lastBook.pages.length === 1 ? t("1 page") : t("{n} pages", { n: lastBook.pages.length })} · {trimShortLabel(lastBook.trimSize)}
                    {lastBook.collection ? ` · ${lastBook.collection}` : ""}
                  </p>
                  <HeroReadiness book={lastBook} />
                  <div className="mt-auto flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpen(lastBook.id)}
                      className="h-11 rounded-[14px] bg-accent px-5 text-body font-bold text-on-accent outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      {t("Open in editor")}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleColor(e, lastBook.id)}
                      className="h-11 rounded-[14px] bg-inset px-5 text-body font-semibold text-ink outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {t("Color it")}
                    </button>
                  </div>
                </div>
                <PageStack book={lastBook} />
              </div>

              <div className={cn(ISLAND, "flex w-[400px] shrink-0 flex-col gap-3 rounded-[26px] p-5")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-section-title font-extrabold text-ink">{t("Start something new")}</p>
                  <button type="button" onClick={() => setNicheOpen(true)} className="flex items-center gap-1 rounded-pill px-2.5 py-1 text-helper font-semibold text-accent outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                    <Lightbulb size={13} aria-hidden /> {t("Find a book idea")}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <QuickStart icon={<Plus size={20} />} label={t("New book")} onClick={handleNewBook} />
                  <QuickStart icon={<LayoutTemplate size={20} />} label={t("From template")} onClick={() => setActiveNav("Templates")} />
                  <QuickStart icon={<Upload size={20} />} label={t("Import art")} onClick={() => fileInputRef.current?.click()} />
                  <QuickStart icon={<BookHeart size={20} />} label={t("Story book")} onClick={() => setStoryOpen(true)} />
                </div>
                <form
                  className="mt-auto flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDescribeOpen(describe.trim());
                  }}
                >
                  <label htmlFor="describe-book" className="flex items-center gap-1.5 font-pw-mono text-mono font-medium uppercase tracking-[0.09em] text-spark">
                    <Sparkles size={12} aria-hidden />
                    {t("Or describe it")}
                  </label>
                  <div className="flex h-12 items-center gap-2 rounded-[14px] border border-hairline bg-panel/60 pl-3.5 pr-1.5 focus-within:ring-2 focus-within:ring-accent">
                    <input
                      id="describe-book"
                      value={describe}
                      onChange={(e) => setDescribe(e.target.value)}
                      maxLength={500}
                      placeholder={t("A 20-page book of farm animals for 4-year-olds")}
                      className="min-w-0 flex-1 bg-transparent text-helper text-ink outline-none placeholder:text-ink-muted"
                    />
                    <button
                      type="submit"
                      aria-label={t("Plan the book")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-spark-fill text-[#1a0e08] outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <ArrowUp size={16} strokeWidth={2.4} />
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={activeNav === item}
                onClick={() => {
                  setActiveNav(item);
                  setActiveCollection(null);
                }}
                className={cn(CHIP, activeNav === item && !activeCollection ? "bg-ink text-on-ink" : "border border-hairline text-ink-secondary hover:bg-inset")}
              >
                {t(item)}
                {counts[item] !== null && (
                  <span className="font-pw-mono text-mono opacity-60" aria-hidden>
                    {counts[item]}
                  </span>
                )}
              </button>
            ))}
            {collections.length > 0 && <span className="mx-1 h-6 w-px bg-hairline" aria-hidden />}
            {collections.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={activeCollection === c}
                onClick={() => {
                  setActiveNav("All books");
                  setActiveCollection((current) => (current === c ? null : c));
                }}
                className={cn(CHIP, activeCollection === c ? "bg-ink text-on-ink" : "border border-hairline text-ink-secondary hover:bg-inset")}
              >
                <span className="h-2 w-2 rounded-pill bg-accent" aria-hidden />
                {c}
              </button>
            ))}
            {activeNav !== "Templates" && (
              <MetaLabel className="ml-auto">{t("{books} books · {pages} pages", { books: filtered.length, pages: filtered.reduce((n, b) => n + b.pages.length, 0) })}</MetaLabel>
            )}
          </div>

          {activeNav === "Templates" ? (
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-page-title font-bold tracking-[-0.02em] text-ink">{t("Templates")}</h1>
                <MetaLabel>{t("Books other creators shared. Using one makes your own copy.")}</MetaLabel>
              </div>
              <TemplatesGallery onOpenBook={handleOpen} />
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-[18px]">
              {filtered.map((book) => (
                <div key={book.id} className="group relative flex flex-col gap-2.5">
                  <div className="pw-glass relative flex h-[230px] items-center justify-center rounded-[18px]">
                    <Thumbnail
                      src={bookThumbnail(book)}
                      style={{ width: 138, height: 178, boxShadow: "var(--shadow-paper)" }}
                      radius="paper-sm"
                      onClick={() => handleOpen(book.id)}
                      alt={book.title}
                    />
                    <StatusBadge status={book.status} />
                    <ScoreBadge book={book} />
                  </div>
                  <div className="flex items-start gap-1">
                    <button type="button" onClick={() => handleOpen(book.id)} className="min-w-0 flex-1 px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      <p className="truncate text-body font-bold leading-8 text-ink">{book.title}</p>
                    </button>
                    {/* Always visible (not hover-only): these are how you colour, copy and delete a book. */}
                    <button type="button" onClick={(e) => handleColor(e, book.id)} aria-label={t("Color {title}", { title: book.title })} title={t("Color it")} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent hover:text-accent">
                      <Palette size={15} />
                    </button>
                    <button type="button" onClick={(e) => handleDuplicate(e, book)} aria-label={t("Duplicate {title}", { title: book.title })} title={t("Duplicate")} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent hover:text-accent">
                      <Copy size={15} />
                    </button>
                    <button type="button" onClick={(e) => handleNextVolume(e, book)} aria-label={t("Start the next volume of {title}", { title: book.title })} title={t("Next volume: same layout, new pictures")} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent hover:text-accent">
                      <BookPlus size={15} />
                    </button>
                    <button type="button" onClick={(e) => handleDelete(e, book)} aria-label={t("Delete {title}", { title: book.title })} title={t("Delete")} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent hover:text-error">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <MetaLabel className="-mt-2 block px-1">{bookMeta(book, t)}</MetaLabel>
                  <button
                    type="button"
                    onClick={(e) => handleAssignCollection(e, book)}
                    className="-mt-1.5 px-1 text-left text-helper text-ink-muted outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {book.collection ?? `+ ${t("Add to collection")}`}
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={handleNewBook}
                className="flex h-[230px] flex-col items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-hairline text-ink-secondary outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-inset text-accent">
                  <Plus size={20} />
                </span>
                <span className="text-body font-bold">{t("New book")}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AiCredits() {
  const t = useT();
  const { usage } = useAiUsage();
  if (!usage || usage.limit === null) return null;
  const share = usage.limit ? Math.min(1, usage.used / usage.limit) : 1;
  const extra = usage.extra ?? 0;
  return (
    <Link
      href="/studio/billing"
      className="flex h-9 items-center gap-2 rounded-[12px] px-2 outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent"
      title={`${t("{left} of {limit} AI credits left this month", { left: Math.max(0, usage.limit - usage.used), limit: usage.limit })}${extra ? ` · ${t("{n} bought credits", { n: extra })}` : ""} · ${t("Plans & credits")}`}
    >
      <span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-pill"
        style={{ background: `conic-gradient(var(--color-accent) 0 ${share * 100}%, var(--color-inset) ${share * 100}% 100%)` }}
        aria-hidden
      >
        <span className="h-[18px] w-[18px] rounded-pill bg-panel" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-pw-mono text-mono text-ink">
          {usage.used} / {usage.limit}
        </span>
        <span className="text-[10px] text-ink-muted">{extra ? `${t("AI images")} · +${extra}` : t("AI images")}</span>
      </span>
    </Link>
  );
}

function HeroReadiness({ book }: { book: StoredBook }) {
  const t = useT();
  const r = bookReadiness(book.pages);
  return (
    <div className="flex items-center gap-2.5">
      <ReadinessRing score={r.score} level={r.level} size={34} />
      <span className="text-helper font-semibold text-ink-secondary">{readinessLabel(r.level, t)}</span>
    </div>
  );
}

/** The book's print-readiness score, small, on its cover card. */
function ScoreBadge({ book }: { book: StoredBook }) {
  const t = useT();
  const r = bookReadiness(book.pages);
  return (
    <span
      className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-pill bg-panel/90 px-2 py-0.5 font-pw-mono text-mono font-medium text-ink-secondary shadow-resting"
      title={`${readinessLabel(r.level, t)} · ${r.score}/100`}
      aria-label={`${readinessLabel(r.level, t)} · ${r.score}/100`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-pill", r.level === "ready" ? "bg-success" : r.level === "almost" ? "bg-warning" : "bg-error")} aria-hidden />
      {r.score}
    </span>
  );
}

function QuickStart({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[88px] flex-col items-center justify-center gap-2 rounded-[16px] border border-hairline bg-panel/40 text-helper font-semibold text-ink outline-none transition-colors duration-150 hover:bg-inset motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: StoredBook["status"] }) {
  const t = useT();
  const draft = status === "draft";
  return (
    <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-pill bg-panel/90 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary shadow-resting">
      <span className={cn("h-1.5 w-1.5 rounded-pill", draft ? "bg-warning" : "bg-success")} aria-hidden />
      {draft ? t("Draft") : t("Published")}
    </span>
  );
}

/** The book's first pages as a small stack of paper — the cover-ish page in front. */
function PageStack({ book }: { book: StoredBook }) {
  const front = bookThumbnail(book);
  const others = book.pages.filter((p) => p.thumbnailDataUrl && p.thumbnailDataUrl !== front).slice(0, 2);
  return (
    <div className="relative hidden w-[340px] shrink-0 lg:block" aria-hidden>
      {others.map((p, i) => (
        <div
          key={p.id}
          className="absolute top-7 h-[190px] w-[146px] rounded-paper-sm bg-white bg-cover bg-center opacity-80 shadow-panel"
          style={{ left: i === 0 ? 14 : 180, transform: `rotate(${i === 0 ? -8 : 8}deg)`, backgroundImage: `url(${p.thumbnailDataUrl})` }}
        />
      ))}
      <Thumbnail src={front} className="absolute left-[92px] top-1" style={{ width: 166, height: 214, boxShadow: "var(--shadow-paper)" }} radius="paper-sm" />
    </div>
  );
}
