"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { ChevronLeft, Undo2, Circle, Download } from "lucide-react";
import CanvasArea from "@/components/studio/editor/CanvasArea";
import { captureStage } from "@/components/editor/CanvasEditor";
import ColorSwatch from "@/components/studio/ui/ColorSwatch";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { getBook, saveBook, type BookStatus, type StoredBook } from "@/utils/storage";
import type { BookPage } from "@/types/editor";

const PALETTE = ["#e4b7a0", "#cfa77e", "#8fae8b", "#5d7f6f", "#d9cf9e", "#b98a8a", "#7b8fa8", "#42505f"];
const SWIPE_THRESHOLD_PX = 60;
const AUTOSAVE_DEBOUNCE_MS = 500;

function readInitialBookId(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("book") ?? "";
}

function slugify(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "coloring-page";
}

/**
 * 3a: end-user coloring, zero chrome. Hosts the real drawing engine
 * (CanvasArea/CanvasEditor's raster flood fill, same as the main
 * editor's Color mode) against a real book's real pages — no more the
 * standalone SVG-vector FloodFillCanvas fixture with one hardcoded page.
 * Reads ?book=<id>(&page=<pageId>) the same way the editor route does
 * (see EditorShell's own comment for why this stays a plain window.location
 * read in a pure useState initializer, not useSearchParams/an effect).
 */
export default function ColoringView() {
  const [bookId] = useState(readInitialBookId);
  const [loaded, setLoaded] = useState<{ book: StoredBook | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(bookId ? getBook(bookId) : null)
      .then((book) => {
        if (!cancelled) setLoaded({ book });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ book: null });
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-body text-ink-secondary">Loading…</div>;
  }

  return <ColoringViewLoaded bookId={bookId} initialBook={loaded.book} />;
}

function ColoringViewLoaded({ bookId, initialBook }: { bookId: string; initialBook: StoredBook | null }) {
  const router = useRouter();
  const createdAtRef = useRef(initialBook?.createdAt ?? new Date().toISOString());
  const [title] = useState(initialBook?.title ?? "Untitled Book");
  const statusRef = useRef<BookStatus>(initialBook?.status ?? "draft");

  const [pages, setPages] = useState<BookPage[]>(initialBook?.pages ?? []);
  const [pageIndex, setPageIndex] = useState(() => {
    if (!initialBook) return 0;
    const requestedPageId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("page") : null;
    const found = requestedPageId ? initialBook.pages.findIndex((p) => p.id === requestedPageId) : -1;
    return found >= 0 ? found : 0;
  });

  const [activeColor, setActiveColor] = useState(PALETTE[0]);
  const [quietMode, setQuietMode] = useState(false);
  const [undoSignal, setUndoSignal] = useState(0);
  const [canUndoFill, setCanUndoFill] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const swipeState = useRef<{ startX: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const activePage = pages[pageIndex] as BookPage | undefined;

  function persist(nextPages: BookPage[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveBook({ id: bookId, title, pages: nextPages, status: statusRef.current, createdAt: createdAtRef.current, updatedAt: new Date().toISOString() }).catch((err) =>
        window.alert(err instanceof Error ? err.message : "Could not save this page.")
      );
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function handleFillChange(dataUrl: string) {
    setPages((prev) => {
      const next = prev.map((p, i) => (i === pageIndex ? { ...p, fillDataUrl: dataUrl } : p));
      persist(next);
      return next;
    });
  }

  function handleSaveNow() {
    saveBook({ id: bookId, title, pages, status: statusRef.current, createdAt: createdAtRef.current, updatedAt: new Date().toISOString() })
      .then(() => {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1500);
      })
      .catch((err) => window.alert(err instanceof Error ? err.message : "Could not save this book."));
  }

  /** Downloads just this one page's finished artwork as a PNG — separate from the whole-book PDF export, for "save what I just colored" rather than "export the whole book". */
  function handleDownloadPage() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = captureStage(stage, 3); // 3× the native page, whatever size it's shown at
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${slugify(title)}-page-${pageIndex + 1}.png`;
    link.click();
  }

  function goToPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setPageIndex(nextIndex);
    const url = new URL(window.location.href);
    url.searchParams.set("page", pages[nextIndex].id);
    window.history.replaceState(null, "", url.toString());
  }

  function handlePaperPointerDown(e: React.PointerEvent) {
    swipeState.current = { startX: e.clientX };
  }

  function handlePaperPointerUp(e: React.PointerEvent) {
    if (!swipeState.current) return;
    const dx = e.clientX - swipeState.current.startX;
    swipeState.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) goToPage(pageIndex + 1);
    else goToPage(pageIndex - 1);
  }

  if (!initialBook || !activePage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface p-8 text-center">
        <p className="text-body text-ink-secondary">We couldn&apos;t find that book.</p>
        <button type="button" onClick={() => router.push("/studio")} className="text-body text-accent underline outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-8">
      {/* Tablet bezel */}
      <div className="rounded-[34px] bg-[#15181d] p-4 shadow-canvas-dark">
        <div className="relative overflow-hidden rounded-[22px] bg-tablet-ground" style={{ width: 900, height: 660 }}>
          {/* Top bar — hidden in Quiet mode */}
          <div className={cn("flex h-[46px] items-center justify-between px-4 transition-opacity duration-200 motion-reduce:transition-none", quietMode && "pointer-events-none opacity-0")}>
            <button
              type="button"
              onClick={() => router.push("/studio")}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-panel text-ink-secondary shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="text-body font-medium text-ink">{title}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuietMode(true)}
                className="rounded-pill bg-[rgba(16,20,26,0.06)] px-3.5 py-1.5 text-helper font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Quiet mode
              </button>
              <button
                type="button"
                onClick={handleDownloadPage}
                aria-label="Download this page as PNG"
                className="flex h-8 w-8 items-center justify-center rounded-pill bg-[rgba(16,20,26,0.06)] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Download size={14} />
              </button>
              <button
                type="button"
                onClick={handleSaveNow}
                className="rounded-pill bg-accent px-3.5 py-1.5 text-helper font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {justSaved ? "Saved" : "Save"}
              </button>
            </div>
          </div>

          {/* Quiet mode dims the shell (the tablet ground outside the paper), not the paper itself. */}
          <div className={cn("absolute inset-0 bg-ink/0 transition-colors duration-200 motion-reduce:transition-none", quietMode && "bg-ink/15")} style={{ top: quietMode ? 0 : 46 }} aria-hidden />

          {/* Paper — aspect-ratio locked to the real page (595x842), not a fixed box, so it never stretches real book content. */}
          <div className="flex items-center justify-center" style={{ height: quietMode ? 660 : 660 - 46 - 104 }}>
            <div
              onPointerDown={handlePaperPointerDown}
              onPointerUp={handlePaperPointerUp}
              className="relative flex items-center justify-center rounded-[6px] bg-white p-[18px] shadow-paper"
              style={{ height: "100%", aspectRatio: "595 / 842", touchAction: "pan-y" }}
            >
              <CanvasArea
                page={activePage}
                mode="color"
                tool="fill"
                strokeWidth={1}
                onStrokeWidthChange={() => {}}
                activeColor={activeColor}
                onSampleColor={setActiveColor}
                onFillChange={handleFillChange}
                undoFillSignal={undoSignal}
                onCanUndoFillChange={setCanUndoFill}
                pendingPlacement={null}
                selectedIds={[]}
                onSelectObject={() => {}}
                onSelectIds={() => {}}
                onAddLines={() => {}}
                onPlaceObject={() => {}}
                onUpdateObjects={() => {}}
                hideViewControls
                onTextDragStateChange={() => {}}
                onStageReady={(stage) => {
                  stageRef.current = stage;
                }}
              />
            </div>
          </div>

          {/* Bottom zone: floating toolbar + mono caption — hidden in Quiet mode */}
          <div className={cn("absolute inset-x-0 bottom-0 flex h-[104px] flex-col items-center justify-center gap-2 transition-opacity duration-200 motion-reduce:transition-none", quietMode && "pointer-events-none opacity-0")}>
            <div className="flex items-center gap-2 rounded-pill bg-panel px-3 py-2 shadow-toolbar">
              {PALETTE.map((hex) => (
                <ColorSwatch key={hex} hex={hex} sizePx={38} context="toolbar" selected={activeColor === hex} onClick={() => setActiveColor(hex)} />
              ))}

              <div className="mx-1 h-6 w-px bg-hairline" />

              <div
                aria-label="Fill tool (always on in coloring mode)"
                className="relative flex h-11 w-11 items-center justify-center rounded-pill bg-ink"
              >
                <Circle size={10} className="fill-white text-white" />
              </div>
              <button
                type="button"
                aria-label="Undo last fill"
                disabled={!canUndoFill}
                onClick={() => setUndoSignal((s) => s + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-pill bg-inset-alt text-ink-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Undo2 size={18} />
              </button>
            </div>
            <MetaLabel>
              Σελίδα {pageIndex + 1} από {pages.length} · Σύρε για επόμενη
            </MetaLabel>
          </div>
        </div>
      </div>
    </div>
  );
}
