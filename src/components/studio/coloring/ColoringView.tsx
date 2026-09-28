"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type Konva from "konva";
import { ChevronLeft, Undo2, Download, PaintBucket, Paintbrush, Printer, Images, PartyPopper, X } from "lucide-react";
import FillStylePicker from "@/components/studio/editor/FillStylePicker";
import { printPageImage, Sticker, STICKERS } from "@/components/studio/coloring/rewards";
import CanvasArea from "@/components/studio/editor/CanvasArea";
import { captureStage } from "@/components/editor/CanvasEditor";
import ColorSwatch from "@/components/studio/ui/ColorSwatch";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { getBook, saveBook, type BookStatus, type StoredBook } from "@/utils/storage";
import type { BookPage, FillStyle, PageSpace } from "@/types/editor";
import { convertPages, interiorSpace, needsConversion } from "@/utils/pageGeometry";

// Bright first (what kids reach for), then the softer studio tones.
const PALETTE = ["#e5484d", "#f08c2e", "#f5c518", "#3cb371", "#2f80ed", "#8e5ad6", "#e05a9b", "#8a5a3c", "#e4b7a0", "#8fae8b", "#7b8fa8", "#111827"];
const BRUSH_SIZES = [
  { label: "Thin", width: 8 },
  { label: "Medium", width: 16 },
  { label: "Thick", width: 28 },
];
const THUMB_RATIO = 0.3;
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
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(bookId ? getBook(bookId) : null)
      .then(async (book) => {
        // Same page-size normalization the editor does on open.
        const target = interiorSpace(book?.trimSize, book?.bleed ?? false);
        if (book && needsConversion(book.pages, target)) book = { ...book, pages: await convertPages(book.pages, target) };
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
    return <div className="flex min-h-screen items-center justify-center bg-surface text-body text-ink-secondary">{t("Loading…")}</div>;
  }

  return <ColoringViewLoaded bookId={bookId} initialBook={loaded.book} />;
}

function ColoringViewLoaded({ bookId, initialBook }: { bookId: string; initialBook: StoredBook | null }) {
  const router = useRouter();
  const t = useT();
  const createdAtRef = useRef(initialBook?.createdAt ?? new Date().toISOString());
  const statusRef = useRef<BookStatus>(initialBook?.status ?? "draft");

  if (!initialBook || initialBook.pages.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface p-8 text-center">
        <p className="text-body text-ink-secondary">{t("We couldn't find that book.")}</p>
        <button type="button" onClick={() => router.push("/studio")} className="text-body text-accent underline outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          {t("Back to library")}
        </button>
      </div>
    );
  }

  return (
    <ColoringBoard
      title={initialBook.title}
      initialPages={initialBook.pages}
      space={interiorSpace(initialBook.trimSize, initialBook.bleed ?? false)}
      backHref="/studio"
      save={(pages) => saveBook({ id: bookId, title: initialBook.title, pages, status: statusRef.current, createdAt: createdAtRef.current, updatedAt: new Date().toISOString() })}
    />
  );
}

export interface ColoringBoardProps {
  title: string;
  initialPages: BookPage[];
  space: PageSpace;
  /** Where the page's progress goes — the book itself, or (for a share link) this device. Debounced by the board. */
  save: (pages: BookPage[]) => Promise<void>;
  /** The back button's destination; null hides it (share links have nowhere to go back to). */
  backHref: string | null;
}

/** The child-facing coloring surface — used by /studio/color and by public share links. */
export function ColoringBoard({ title, initialPages, space, save, backHref }: ColoringBoardProps) {
  const router = useRouter();
  const t = useT();
  const [pages, setPages] = useState<BookPage[]>(initialPages);
  const [pageIndex, setPageIndex] = useState(() => {
    const requestedPageId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("page") : null;
    const found = requestedPageId ? initialPages.findIndex((p) => p.id === requestedPageId) : -1;
    return found >= 0 ? found : 0;
  });

  const [activeColor, setActiveColor] = useState(PALETTE[0]);
  const [quietMode, setQuietMode] = useState(false);
  const [undoSignal, setUndoSignal] = useState(0);
  const [canUndoFill, setCanUndoFill] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [kidTool, setKidTool] = useState<"fill" | "brush">("fill");
  const [fillStyle, setFillStyle] = useState<FillStyle>("solid");
  const [brushSize, setBrushSize] = useState(16);
  const [reward, setReward] = useState<number | null>(null); // sticker index just earned
  const [showGallery, setShowGallery] = useState(false);

  const swipeState = useRef<{ startX: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  const activePage = pages[pageIndex] as BookPage | undefined;
  const finished = pages.filter((p) => p.completedAt);

  function persist(nextPages: BookPage[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save(nextPages).catch((err) =>
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
    save(pages)
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

  /** "I'm done!": snapshot the colored page for the gallery, mark it finished and hand out the next sticker. */
  function handleDone() {
    const stage = stageRef.current;
    if (!stage || !activePage) return;
    const alreadyDone = Boolean(activePage.completedAt);
    const thumb = captureStage(stage, THUMB_RATIO);
    setPages((prev) => {
      const next = prev.map((p, i) => (i === pageIndex ? { ...p, completedAt: p.completedAt ?? new Date().toISOString(), thumbnailDataUrl: thumb } : p));
      persist(next);
      return next;
    });
    if (!alreadyDone) setReward(finished.length);
  }

  function handlePrintPage() {
    const stage = stageRef.current;
    if (!stage) return;
    printPageImage(captureStage(stage, 300 / 72), space, `${title} — ${pageIndex + 1}`);
  }

  function goToPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setPageIndex(nextIndex);
    const url = new URL(window.location.href);
    url.searchParams.set("page", pages[nextIndex].id);
    window.history.replaceState(null, "", url.toString());
  }

  function handlePaperPointerDown(e: React.PointerEvent) {
    // A brush stroke is a drag too — only the bucket leaves swiping free for turning pages.
    if (kidTool !== "fill") return;
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

  if (!activePage) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-8">
      {/* Tablet bezel */}
      <div className="rounded-[34px] bg-[#15181d] p-4 shadow-canvas-dark">
        <div className="relative overflow-hidden rounded-[22px] bg-tablet-ground" style={{ width: 900, height: 660 }}>
          {/* Top bar — hidden in Quiet mode */}
          <div className={cn("flex h-[46px] items-center justify-between px-4 transition-opacity duration-200 motion-reduce:transition-none", quietMode && "pointer-events-none opacity-0")}>
            <button
              type="button"
              onClick={() => backHref && router.push(backHref)}
              aria-label={t("Back")}
              aria-hidden={!backHref}
              tabIndex={backHref ? undefined : -1}
              style={{ visibility: backHref ? "visible" : "hidden" }}
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
                {t("Quiet mode")}
              </button>
              <button
                type="button"
                onClick={() => setShowGallery(true)}
                aria-label={t("My collection ({n})", { n: finished.length })}
                className="flex h-8 items-center gap-1.5 rounded-pill bg-[rgba(16,20,26,0.06)] px-2.5 text-helper font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Images size={14} /> {finished.length}
              </button>
              <button
                type="button"
                onClick={handlePrintPage}
                aria-label={t("Print this page")}
                title={t("Print this page")}
                className="flex h-8 w-8 items-center justify-center rounded-pill bg-[rgba(16,20,26,0.06)] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Printer size={14} />
              </button>
              <button
                type="button"
                onClick={handleDownloadPage}
                aria-label={t("Download this page as PNG")}
                title={t("Download this page as PNG")}
                className="flex h-8 w-8 items-center justify-center rounded-pill bg-[rgba(16,20,26,0.06)] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <Download size={14} />
              </button>
              <button
                type="button"
                onClick={handleSaveNow}
                className="rounded-pill bg-accent px-3.5 py-1.5 text-helper font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {justSaved ? t("Saved") : t("Save")}
              </button>
            </div>
          </div>

          {/* Quiet mode dims the shell (the tablet ground outside the paper), not the paper itself. */}
          <div className={cn("absolute inset-0 bg-ink/0 transition-colors duration-200 motion-reduce:transition-none", quietMode && "bg-ink/15")} style={{ top: quietMode ? 0 : 46 }} aria-hidden />

          {/* Paper — aspect-ratio locked to the real page size, not a fixed box, so it never stretches real book content. */}
          <div className="flex items-center justify-center" style={{ height: quietMode ? 660 : 660 - 46 - 104 }}>
            <div
              onPointerDown={handlePaperPointerDown}
              onPointerUp={handlePaperPointerUp}
              className="relative flex items-center justify-center rounded-[6px] bg-white p-[18px] shadow-paper"
              style={{ height: "100%", aspectRatio: `${space.width} / ${space.height}`, touchAction: "pan-y" }}
            >
              {/* A definite box for the canvas viewport: CanvasArea sizes itself from its container, and a flex item with no height of its own would collapse to 0 here. */}
              <div className="absolute inset-[18px] flex">
              <CanvasArea
                page={activePage}
                space={space}
                padding={0}
                mode="color"
                tool={kidTool}
                strokeWidth={brushSize}
                onStrokeWidthChange={setBrushSize}
                activeColor={activeColor}
                fillStyle={fillStyle}
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
          </div>

          {/* Bottom zone: floating toolbar + mono caption — hidden in Quiet mode */}
          <div className={cn("absolute inset-x-0 bottom-0 flex h-[104px] flex-col items-center justify-center gap-2 transition-opacity duration-200 motion-reduce:transition-none", quietMode && "pointer-events-none opacity-0")}>
            <div className="flex items-center gap-2 rounded-pill bg-panel px-3 py-2 shadow-toolbar">
              <div className="grid grid-cols-6 gap-1.5">
                {PALETTE.map((hex) => (
                  <ColorSwatch key={hex} hex={hex} sizePx={26} context="toolbar" selected={activeColor === hex} onClick={() => setActiveColor(hex)} />
                ))}
              </div>

              <div className="mx-1 h-10 w-px bg-hairline" />

              {(
                [
                  { id: "fill", label: t("Bucket"), Icon: PaintBucket },
                  { id: "brush", label: t("Brush"), Icon: Paintbrush },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  aria-pressed={kidTool === id}
                  title={label}
                  onClick={() => setKidTool(id)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    kidTool === id ? "bg-ink text-white" : "bg-inset-alt text-ink-secondary"
                  )}
                >
                  <Icon size={18} />
                </button>
              ))}

              <div className="flex min-w-[150px] items-center justify-center">
                {kidTool === "fill" ? (
                  <FillStylePicker value={fillStyle} color={activeColor} onChange={setFillStyle} size={26} />
                ) : (
                  <div className="flex gap-1" role="group" aria-label={t("Brush size")}>
                    {BRUSH_SIZES.map((b, i) => (
                      <button
                        key={b.width}
                        type="button"
                        aria-label={t(b.label)}
                        aria-pressed={brushSize === b.width}
                        title={t(b.label)}
                        onClick={() => setBrushSize(b.width)}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          brushSize === b.width ? "bg-accent-tint ring-2 ring-accent" : "bg-inset-alt"
                        )}
                      >
                        <span className="rounded-pill" style={{ width: 6 + i * 6, height: 6 + i * 6, background: activeColor }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                aria-label={t("Undo")}
                disabled={!canUndoFill}
                onClick={() => setUndoSignal((s) => s + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-pill bg-inset-alt text-ink-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Undo2 size={18} />
              </button>
              <button
                type="button"
                onClick={handleDone}
                className="flex h-11 items-center gap-1.5 rounded-pill bg-success px-4 text-body font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <PartyPopper size={16} />
                {activePage.completedAt ? t("Again!") : t("I'm done!")}
              </button>
            </div>
            <MetaLabel>
              {t("Page {n} of {total}", { n: pageIndex + 1, total: pages.length })} · {kidTool === "fill" ? t("Swipe for the next page") : t("Paint with the brush")}
            </MetaLabel>
          </div>

          {reward !== null && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 p-6" onClick={() => setReward(null)}>
              <div role="dialog" aria-modal="true" aria-label={t("You earned a sticker")} onClick={(e) => e.stopPropagation()} className="flex w-[340px] flex-col items-center gap-4 rounded-panel bg-panel p-6 text-center shadow-panel">
                <Sticker index={reward} size={96} />
                <p className="text-modal-title font-semibold text-ink">{t("Well done!")}</p>
                <p className="text-body text-ink-secondary">
                  {t(reward === 0 ? "You earned the “{name}” sticker. That's your first sticker!" : "You earned the “{name}” sticker. You have {n} stickers!", { name: t(STICKERS[reward % STICKERS.length].name), n: reward + 1 })}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => {
                      setReward(null);
                      setShowGallery(true);
                    }} className="rounded-pill bg-inset-alt px-4 py-2 text-body font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {t("My collection")}
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      setReward(null);
                      if (pageIndex < pages.length - 1) goToPage(pageIndex + 1);
                    }}
                    className="rounded-pill bg-accent px-4 py-2 text-body font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {pageIndex < pages.length - 1 ? t("Next page") : t("OK")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showGallery && (
            <div className="absolute inset-0 z-30 flex flex-col gap-4 bg-tablet-ground p-6" role="dialog" aria-modal="true" aria-label={t("My collection")}>
              <div className="flex items-center justify-between">
                <p className="text-modal-title font-semibold text-ink">{t("My collection")}</p>
                <button type="button" aria-label={t("Close")} onClick={() => setShowGallery(false)} className="flex h-9 w-9 items-center justify-center rounded-pill bg-panel text-ink-secondary shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <X size={16} />
                </button>
              </div>
              <div className="flex min-h-[64px] flex-wrap items-center gap-2 rounded-panel bg-panel p-3 shadow-resting">
                {finished.length === 0 ? (
                  <p className="text-body text-ink-muted">{t("Finish a page to earn your first sticker!")}</p>
                ) : (
                  finished.map((_, i) => <Sticker key={i} index={i} size={44} />)
                )}
              </div>
              <div className="grid flex-1 auto-rows-min grid-cols-5 gap-3 overflow-auto">
                {finished.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      goToPage(pages.findIndex((x) => x.id === p.id));
                      setShowGallery(false);
                    }}
                    className="overflow-hidden rounded-paper bg-white shadow-resting outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    style={{ aspectRatio: `${space.width} / ${space.height}` }}
                    aria-label={t("Page {n}", { n: pages.findIndex((x) => x.id === p.id) + 1 })}
                  >
                    {p.thumbnailDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- stage snapshot data URL
                      <img src={p.thumbnailDataUrl} alt="" className="h-full w-full object-contain" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
