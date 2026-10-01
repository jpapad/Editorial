"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import EditorTopBar from "@/components/studio/editor/EditorTopBar";
import ToolRail from "@/components/studio/editor/ToolRail";
import CanvasArea, { BRUSH_PRESETS } from "@/components/studio/editor/CanvasArea";
import PageFilmstrip from "@/components/studio/editor/PageFilmstrip";
import RightPanel from "@/components/studio/editor/RightPanel";
import ShortcutsModal from "@/components/studio/editor/ShortcutsModal";
import AiStudioPanel, { type ImageSize } from "@/components/studio/editor/AiStudioPanel";
import CommentsPanel from "@/components/studio/editor/CommentsPanel";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth";
import { addComment, deleteComment, isMissingCommentsTable, listComments, setCommentResolved, type PageComment } from "@/utils/comments";
import BookAssemblyScreen from "@/components/studio/screens/BookAssemblyScreen";
import BookPreviewModal from "@/components/editor/BookPreviewModal";
import PreflightBlockingModal, { type FlaggedPage, type PreflightIssue } from "@/components/studio/modals/PreflightBlockingModal";
import { createFrameStamp, createPageFromTemplate, duplicatePage, makeId } from "@/components/editor/pageTemplates";
import { defaultShapeSize, isOpenStroke } from "@/components/editor/shapeGeometry";
import { moveStrokes } from "@/components/editor/strokeTools";
import { captureInk, captureRegion, captureStage, type GuideSpec } from "@/components/editor/CanvasEditor";
import { deleteMyStamp, listMyStamps, placeMyStamp, saveMyStamp, toMyStamp, type MyStamp } from "@/utils/myStamps";
import { BookPrintCard, CoverCard } from "@/components/studio/editor/PrintSettingsCards";
import PublishTemplateDialog from "@/components/studio/editor/PublishTemplateDialog";
import SelectionToolbar from "@/components/studio/editor/SelectionToolbar";
import ReadinessCard from "@/components/studio/editor/ReadinessCard";
import CommandBar, { type CommandOutcome } from "@/components/studio/editor/CommandBar";
import { applyCommandActions, parseCommandResult, summarizePage, type CommandPictures } from "@/utils/editorCommand";
import { generateLineArtPicture } from "@/lib/lineArt";
import { bookReadiness } from "@/utils/readiness";
import { fullPageStamp, pageFromImage } from "@/utils/imagePages";
import ColorPreviewModal from "@/components/studio/editor/ColorPreviewModal";
import type { PixelBuffer } from "@/components/studio/editor/rasterFloodFill";
import ImportImagesDialog from "@/components/studio/editor/ImportImagesDialog";
import { applyFrameToAll, applyPatternToAll, propagateRepeats, setLineWidth, withRepeats } from "@/utils/bookTools";
import PageToolsCard from "@/components/studio/editor/PageToolsCard";
import { applyPageNumbers, pageNumberMode, removeRepeats, repeatOnAllPages, syncPageNumbers, type PageNumberMode } from "@/utils/pageNumbers";
import ListingKitModal from "@/components/studio/editor/ListingKitModal";
import WorksheetDialog from "@/components/studio/editor/WorksheetDialog";
import ShareDialog from "@/components/studio/editor/ShareDialog";
import { convertPages, geometryFromSpace, interiorSpace, needsConversion } from "@/utils/pageGeometry";
import { coverLayout, coverSafeAreas, emptyCover, refitCover, type CoverLayout } from "@/utils/coverGeometry";
import { findGaps, type GapMarker } from "@/components/studio/editor/gapCheck";
import { checkAge, type AgeCheckResult, type AgeGroup } from "@/components/studio/editor/ageCheck";
import { isPrimaryModifier, isTypingTarget } from "@/components/studio/editor/keyboard";
import { FONT_OPTIONS } from "@/components/editor/kidFonts";
import { aiErrorText, useLanguage, useT, type TFunction } from "@/lib/i18n";
import type { EditorMode } from "@/components/studio/types";
import type {
  BookPage,
  CoverDesign,
  DrawingTool,
  FillStyle,
  LineData,
  LineStyle,
  ObjectChanges,
  ObjectUpdate,
  PageObject,
  PageSpace,
  PageTemplate,
  PaperType,
  PendingPlacement,
  ShapeKind,
  StampFilter,
  SymmetryMode,
  TextData,
} from "@/types/editor";
import { coverExportPage, EXPORT_PIXEL_RATIO, exportPagesToPdf, interiorExportPage } from "@/utils/pdfExport";
import { downloadProjectAsJson, getBook, readProjectFromFile, saveBook, type BookStatus, type StoredBook } from "@/utils/storage";
import { clampObjectsToMargin, pagesNeededForMultipleOf4, runEditorPreflightCheck, thickenThinStrokes, type EditorPreflightIssue } from "@/utils/editorPreflight";
import { alignDeltas, distributeDeltas, flippedHorizontally, flippedVertically, objectBounds, unionBounds, type AlignEdge } from "@/utils/objectGeometry";
import { DEFAULT_TRIM_SIZE_ID, trimShortLabel } from "@/utils/trimSizes";

const MAX_HISTORY = 50;
const DEFAULT_STAMP_SIZE = 120;
const MAX_STAMP_DIMENSION = 220;
const DEFAULT_TITLE = "My Coloring Book";
const AUTOSAVE_DEBOUNCE_MS = 500;
const THUMBNAIL_PIXEL_RATIO = 0.2; // low-res preview art for Library/Assemble — not print quality, just enough to replace the striped placeholder
const PREVIEW_PIXEL_RATIO = 1.5;
const NUDGE_HISTORY_WINDOW_MS = 600; // a burst of arrow-key nudges is one undo step

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOOL_KEYS: Record<string, DrawingTool> = { v: "select", p: "pen", e: "eraser", s: "stamp", r: "shape", t: "text", f: "fill", b: "brush", l: "lasso", c: "curve" };

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function computeStampDimensions(naturalSize?: { width: number; height: number }) {
  if (!naturalSize || !naturalSize.width || !naturalSize.height) {
    return { width: DEFAULT_STAMP_SIZE, height: DEFAULT_STAMP_SIZE };
  }
  const scale = Math.min(MAX_STAMP_DIMENSION / naturalSize.width, MAX_STAMP_DIMENSION / naturalSize.height, 1);
  return { width: naturalSize.width * scale, height: naturalSize.height * scale };
}

function slugify(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "coloring-book-project";
}

function coverGuides(layout: CoverLayout, t: TFunction): GuideSpec {
  const { back, spineRect, front } = layout;
  const label = (x: number, text: string) => ({ x: x + 6, y: back.top + 6, text, color: "#3357d4" });
  return {
    trim: layout.trim,
    safe: coverSafeAreas(layout),
    folds: [
      [spineRect.left, 0, spineRect.left, layout.space.height],
      [spineRect.right, 0, spineRect.right, layout.space.height],
    ],
    blocked: [layout.barcode],
    labels: [label(back.left, t("BACK COVER")), label(front.left, t("FRONT COVER"))],
  };
}

/** Counts an export for the admin statistics. Fire-and-forget: never blocks or fails an export (e.g. before the usage migration exists). */
function logExport(kind: "export_pdf" | "export_cover") {
  void supabase.rpc("log_export", { export_kind: kind }).then(() => undefined);
}

/** Page numbers follow array order — re-stamp them after any structural change. */
function renumber(pages: BookPage[]): BookPage[] {
  return syncPageNumbers(pages.map((p, i) => (p.pageNumber === i + 1 ? p : { ...p, pageNumber: i + 1 })));
}

/**
 * The real, merged Pagewright editor — 2b's chrome (top bar, tool rail,
 * canvas area, filmstrip, right panel) hosting the old editor's actual
 * state/canvas/export logic, not a demo. Most of the state and handlers
 * below are ported directly from the pre-existing components/editor/
 * EditorShell.tsx (same names, same behavior) — this is a chrome swap,
 * not a rewrite of working drawing/export logic. New: `mode`/`activeColor`
 * state and their handlers, needed for Color-mode bucket fill and the
 * mode switch itself.
 */
export interface EditorShellProps {
  /** Renders the dark canvas-surround treatment (the 2a variant) — a prop, not internal state; whether it's ever user-toggleable in the real product wasn't specified. */
  darkSurround?: boolean;
}

/**
 * Outer loader: resolves the book id synchronously (same reasoning as
 * before — plain `window.location`, not useSearchParams, since this whole
 * tree is browser-only with nothing to server-prerender), then fetches the
 * book from Supabase (async, unlike the old localStorage read) before
 * mounting the actual editor. Splitting it this way means everything
 * below — autosave, undo, preflight, all of it — keeps working exactly as
 * it did against localStorage: it just now receives an already-resolved
 * `initialBook`, the same shape a synchronous read used to hand it.
 */
export default function EditorShell({ darkSurround = false }: EditorShellProps) {
  const [bookId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    // books.id is a uuid column — anything else in the URL (e.g. an old
    // "book-…" id from before this was fixed) starts a fresh book instead.
    const requested = new URLSearchParams(window.location.search).get("book");
    return requested && UUID_RE.test(requested) ? requested : crypto.randomUUID();
  });
  const [loaded, setLoaded] = useState<{ book: StoredBook | null } | null>(null);
  const t = useT();

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    getBook(bookId)
      .then(async (book) => {
        // Pages drawn on the old fixed A4 canvas (or before bleed was
        // toggled) are re-expressed in this book's real page size first.
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
    return <div className="flex h-screen items-center justify-center bg-surface text-body text-ink-secondary">{t("Loading…")}</div>;
  }

  return <EditorShellLoaded darkSurround={darkSurround} bookId={bookId} initialBook={loaded.book} />;
}

interface EditorShellLoadedProps extends EditorShellProps {
  bookId: string;
  initialBook: StoredBook | null;
}

function EditorShellLoaded({ darkSurround = false, bookId, initialBook }: EditorShellLoadedProps) {
  const t = useT();
  const { lang } = useLanguage();
  const createdAtRef = useRef(initialBook?.createdAt ?? new Date().toISOString());

  const [title, setTitle] = useState(initialBook?.title || t(DEFAULT_TITLE));
  // Fixed at creation (Onboarding's trim-size row), not editable here — see
  // utils/trimSizes.ts's own note on why re-flowing existing pages to a new
  // trim size mid-book isn't attempted in this pass.
  const trimSizeId = initialBook?.trimSize ?? DEFAULT_TRIM_SIZE_ID;
  const [bleed, setBleed] = useState(initialBook?.bleed ?? false);
  const [paper, setPaper] = useState<PaperType>(initialBook?.paper ?? "white");
  const [convertingBleed, setConvertingBleed] = useState(false);
  const space: PageSpace = interiorSpace(trimSizeId, bleed);
  const [pages, setPages] = useState<BookPage[]>(initialBook && initialBook.pages.length > 0 ? initialBook.pages : [createPageFromTemplate(1, space)]);
  const [coverDesign, setCoverDesign] = useState<CoverDesign | null>(initialBook?.cover ?? null);
  const [bookStatus, setBookStatus] = useState<BookStatus>(initialBook?.status ?? "draft");
  const [activePageId, setActivePageId] = useState(pages[0].id);
  const [mode, setMode] = useState<EditorMode>(() => {
    if (typeof window === "undefined") return "draw";
    const requested = new URLSearchParams(window.location.search).get("mode");
    return requested === "color" || requested === "assemble" || requested === "cover" ? requested : "draw";
  });
  // Color mode's only real job is the bucket, so it starts armed with it.
  const [tool, setTool] = useState<DrawingTool>(() => (mode === "color" ? "fill" : "select"));
  const lastShapeRef = useRef<ShapeKind>("rectangle");
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [smoothing, setSmoothing] = useState(0.3);
  const [lineStyle, setLineStyle] = useState<LineStyle | undefined>(undefined);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [myStamps, setMyStamps] = useState<MyStamp[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [symmetry, setSymmetry] = useState<SymmetryMode>("off");
  const [showGrid, setShowGrid] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [activeColor, setActiveColor] = useState("#111827");
  const [fillStyle, setFillStyle] = useState<FillStyle>("solid");
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { user, loading: sessionLoading } = useSession();
  // A supervisor opening someone else's book: nothing autosaves (RLS would
  // refuse the write anyway) and the comments panel is the point.
  const reviewMode = Boolean(user && initialBook?.ownerId && initialBook.ownerId !== user.id);
  const [sidePanel, setSidePanel] = useState<"default" | "ai" | "comments">("default");
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [showListing, setShowListing] = useState(false);
  const [showPublishTemplate, setShowPublishTemplate] = useState(false);
  const [showWorksheets, setShowWorksheets] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [colorPreviewInk, setColorPreviewInk] = useState<PixelBuffer | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [comments, setComments] = useState<PageComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  // Tied to the exact page object it was computed for: any edit produces a
  // new page object, so stale markers disappear on their own.
  const [gapCheck, setGapCheck] = useState<{ page: BookPage; markers: GapMarker[] } | null>(null);
  const [ageCheck, setAgeCheck] = useState<{ page: BookPage; result: AgeCheckResult } | null>(null);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("3-5");

  // Undo/redo cover page content, page-list changes and the cover alike:
  // each entry is a full snapshot.
  type Snapshot = { pages: BookPage[]; cover: CoverDesign | null };
  const historyRef = useRef<Snapshot[]>([]);
  const redoRef = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const lastNudgeRef = useRef(0);

  const stageRef = useRef<Konva.Stage | null>(null);

  // The cover's size follows the book: spine = interior page count × paper.
  const cover: CoverLayout = coverLayout(trimSizeId, pages.length, paper);
  const fittedCover = coverDesign ? refitCover(coverDesign, cover) : emptyCover(cover, "cover");
  const editingCover = mode === "cover";
  const activePage = editingCover ? fittedCover.page : (pages.find((p) => p.id === activePageId) ?? pages[0]);
  const activeSpace = editingCover ? cover.space : space;
  const activeGeo = geometryFromSpace(activeSpace);
  const selectedObjects = activePage.objects.filter((o) => selectedIds.includes(o.id));
  const pickedLineIds = selectedLineIds.filter((id) => activePage.lines.some((l) => l.id === id));
  const gapMarkers = gapCheck && gapCheck.page === activePage ? gapCheck.markers : null;
  const ageResult = ageCheck && ageCheck.page === activePage ? ageCheck.result : null;

  // Reflects a freshly-generated id in the URL — the write half of the
  // pure/impure split from the state-init comment above. Runs once on
  // mount only: `initialBook` being null means this bookId didn't already
  // exist when the component mounted, not that it should keep re-checking
  // as `pages`/`title` change. The first save is the autosave below, which
  // also runs on mount (once the session is known).
  useEffect(() => {
    if (initialBook || !bookId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("book", bookId);
    window.history.replaceState(null, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed out (the local editor at /): nothing to save to, so don't try —
  // every attempt would fail with an alert.
  useEffect(() => {
    if (!bookId || sessionLoading || !user || reviewMode) return;
    const timer = setTimeout(() => {
      saveBook({ id: bookId, title, pages, status: bookStatus, trimSize: trimSizeId, bleed, paper, cover: coverDesign, createdAt: createdAtRef.current, updatedAt: new Date().toISOString() }).catch((err) =>
        window.alert(err instanceof Error ? err.message : t("Could not save this book."))
      );
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [bookId, title, pages, bookStatus, trimSizeId, bleed, paper, coverDesign, sessionLoading, user, reviewMode, t]);

  // Comments + supervisor flag. Both degrade quietly: no migration yet
  // means no comments table (a friendly note in the panel), not an error.
  useEffect(() => {
    if (sessionLoading || !user) return;
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data }) => {
      if (!cancelled) setIsSupervisor(data === true);
    });
    listComments(bookId)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        setCommentsError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setCommentsError(isMissingCommentsTable(err.message) ? "Comments aren't set up yet — run the page_comments migration in Supabase." : err.message);
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, user, sessionLoading]);

  // Reviewers land on the comments panel.
  const openedForReviewRef = useRef(false);
  useEffect(() => {
    if (!reviewMode || openedForReviewRef.current) return;
    openedForReviewRef.current = true;
    setSidePanel("comments");
  }, [reviewMode]);

  async function handleAddComment(body: string) {
    try {
      const created = await addComment(bookId, activePageId, body);
      setComments((prev) => [...prev, created]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not post the comment."));
      throw err;
    }
  }

  function handleSetCommentResolved(id: string, resolved: boolean) {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved } : c)));
    setCommentResolved(id, resolved).catch((err: Error) => {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: !resolved } : c)));
      window.alert(err.message);
    });
  }

  function handleDeleteComment(id: string) {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    deleteComment(id).catch((err: Error) => {
      setComments(previous);
      window.alert(err.message);
    });
  }

  const openCommentCounts = comments.reduce<Record<string, number>>((acc, c) => {
    if (!c.resolved) acc[c.page_id] = (acc[c.page_id] ?? 0) + 1;
    return acc;
  }, {});

  // ---------- History ----------

  function snapshot(): Snapshot {
    return structuredClone({ pages, cover: coverDesign });
  }

  function pushHistory() {
    historyRef.current = [...historyRef.current, snapshot()].slice(-MAX_HISTORY);
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function restoreSnapshot({ pages: next, cover: nextCover }: Snapshot) {
    setPages(next);
    setCoverDesign(nextCover);
    if (!next.some((p) => p.id === activePageId)) setActivePageId(next[0].id);
    const exists = (id: string) => next.some((p) => p.objects.some((o) => o.id === id)) || Boolean(nextCover?.page.objects.some((o) => o.id === id));
    setSelectedIds((ids) => ids.filter(exists));
  }

  function handleUndo() {
    const previous = historyRef.current.at(-1);
    if (!previous) return;
    historyRef.current = historyRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, snapshot()].slice(-MAX_HISTORY);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    restoreSnapshot(previous);
  }

  function handleRedo() {
    const next = redoRef.current.at(-1);
    if (!next) return;
    redoRef.current = redoRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, snapshot()].slice(-MAX_HISTORY);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    restoreSnapshot(next);
  }

  // ---------- Page content ----------

  /** Edits go to whatever the canvas shows: the current interior page, or the cover in Cover mode. */
  function updateActivePage(update: Partial<BookPage>) {
    if (editingCover) {
      setCoverDesign((prev) => {
        const base = prev ? refitCover(prev, cover) : fittedCover;
        return { ...base, page: { ...base.page, ...update } };
      });
      return;
    }
    // An edit to a repeated element is carried to its copies on the other pages.
    const before = activePage.objects;
    const pageId = activePage.id;
    setPages((prev) => {
      const next = prev.map((p) => (p.id === pageId ? { ...p, ...update } : p));
      return update.objects ? propagateRepeats(next, pageId, before) : next;
    });
  }

  function setActiveObjects(objects: PageObject[]) {
    updateActivePage({ objects });
  }

  function applyChanges(changesById: Map<string, ObjectChanges>) {
    setActiveObjects(activePage.objects.map((o) => (changesById.has(o.id) ? ({ ...o, ...changesById.get(o.id) } as PageObject) : o)));
  }

  function patchActiveObject(id: string, changes: ObjectChanges) {
    const patch = (p: BookPage): BookPage => ({ ...p, objects: p.objects.map((o) => (o.id === id ? ({ ...o, ...changes } as PageObject) : o)) });
    if (editingCover) {
      setCoverDesign((prev) => (prev ? { ...prev, page: patch(prev.page) } : prev));
      return;
    }
    const before = activePage.objects;
    const pageId = activePage.id;
    setPages((prev) => propagateRepeats(prev.map((p) => (p.id !== pageId ? p : patch(p))), pageId, before));
  }

  function handleAddLines(lines: LineData[]) {
    pushHistory();
    updateActivePage({ lines: [...activePage.lines, ...lines] });
  }

  // ---------- My stamps ----------

  useEffect(() => {
    void listMyStamps().then(setMyStamps);
  }, []);

  async function handleSaveMyStamp() {
    const stage = stageRef.current;
    const box = unionBounds(selectedObjects.map(objectBounds));
    const preview = stage && box ? captureRegion(stage, box, 160) : null;
    const first = selectedObjects[0];
    const name = (first?.kind === "stamp" && first.label) || (first?.kind === "text" && first.text.slice(0, 24)) || t("Stamp {n}", { n: myStamps.length + 1 });
    const stamp = preview ? toMyStamp(selectedObjects, name, preview) : null;
    if (!stamp) return;
    try {
      setMyStamps(await saveMyStamp(stamp));
      setNotice(t("Saved to my stamps — find it under the Stamp tool."));
    } catch {
      setNotice(t("Could not save the stamp on this device."));
    }
  }

  function handlePlaceMyStamp(stamp: MyStamp) {
    pushHistory();
    const { safe } = activeGeo;
    const copies = placeMyStamp(stamp, (safe.left + safe.right) / 2, (safe.top + safe.bottom) / 2);
    setActiveObjects([...activePage.objects, ...copies]);
    setPendingPlacement(null);
    setTool("select");
    setSelectedIds(copies.map((c) => c.id));
  }

  // ---------- Drawn strokes (the Select-strokes tool) ----------

  function handleSelectLines(ids: string[], additive: boolean) {
    setSelectedLineIds((prev) => (additive ? [...new Set([...prev, ...ids])] : ids));
  }

  function handleMoveLines(ids: string[], dx: number, dy: number) {
    if (ids.length === 0) return;
    pushHistory();
    updateActivePage({ lines: moveStrokes(activePage.lines, ids, dx, dy) });
  }

  function handleDeleteLines() {
    if (pickedLineIds.length === 0) return;
    pushHistory();
    updateActivePage({ lines: activePage.lines.filter((l) => !pickedLineIds.includes(l.id)) });
    setSelectedLineIds([]);
  }

  function handleDuplicateLines() {
    const copies = activePage.lines.filter((l) => pickedLineIds.includes(l.id)).map((l) => ({ ...l, id: makeId("line"), points: l.points.map((v) => v + 18) }));
    if (copies.length === 0) return;
    pushHistory();
    updateActivePage({ lines: [...activePage.lines, ...copies] });
    setSelectedLineIds(copies.map((c) => c.id));
  }

  function handleUpdateObjects(updates: ObjectUpdate[]) {
    if (updates.length === 0) return;
    pushHistory();
    applyChanges(new Map(updates.map((u) => [u.id, u.changes])));
  }

  function handlePickStamp(src: string, options?: { naturalSize?: { width: number; height: number }; filter?: StampFilter; threshold?: number }) {
    setPendingPlacement({ kind: "stamp", src, ...options });
    setTool("stamp");
  }

  function handleAddShape(shapeKind: ShapeKind) {
    lastShapeRef.current = shapeKind;
    setPendingPlacement({ kind: "shape", shapeKind });
    setTool("shape");
  }

  function handleAddText(fontFamily: string, fontSize: number, fill?: string) {
    setPendingPlacement({ kind: "text", fontFamily, fontSize, fill: fill ?? activeColor });
    setTool("text");
  }

  function handleSetBackgroundPattern(patternId: string | null) {
    pushHistory();
    updateActivePage({ backgroundPatternId: patternId });
  }

  function handleToggleCover() {
    pushHistory();
    updateActivePage({
      isCover: !activePage.isCover,
      coverBackgroundColor: activePage.coverBackgroundColor ?? "#ffffff",
    });
  }

  function handleSetCoverBackgroundColor(color: string) {
    pushHistory();
    updateActivePage({ coverBackgroundColor: color });
  }

  /** Replaces the page's frame (at most one, always at the back), or removes it for `null`. */
  function handleSetFrame(frameId: string | null) {
    const withoutFrame = activePage.objects.filter((o) => !(o.kind === "stamp" && o.isFrame));
    const frame = frameId ? createFrameStamp(frameId, activeGeo) : null;
    pushHistory();
    setActiveObjects(frame ? [frame, ...withoutFrame] : withoutFrame);
    setSelectedIds([]);
  }

  function handlePlaceObject(placement: PendingPlacement, x: number, y: number) {
    pushHistory();
    const id = makeId(placement.kind);
    let newObject: PageObject;

    if (placement.kind === "stamp") {
      const { width, height } = computeStampDimensions(placement.naturalSize);
      newObject = {
        kind: "stamp",
        id,
        src: placement.src,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        filter: placement.filter ?? "none",
        threshold: placement.threshold ?? 0.5,
      };
    } else if (placement.kind === "shape") {
      const { width, height } = defaultShapeSize(placement.shapeKind);
      newObject = {
        kind: "shape",
        id,
        shapeKind: placement.shapeKind,
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fill: isOpenStroke(placement.shapeKind) ? "transparent" : activeColor,
        stroke: "#111827",
        strokeWidth: 6,
      };
    } else {
      const width = 240;
      const height = placement.fontSize * 1.4;
      newObject = {
        kind: "text",
        id,
        text: t("Double-click to edit"),
        fontFamily: placement.fontFamily,
        fontSize: placement.fontSize,
        align: "left",
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fill: placement.fill ?? activeColor,
        isDragging: false,
      };
    }

    setActiveObjects([...activePage.objects, newObject]);
    setSelectedIds([id]);
    setPendingPlacement(null);
    setTool("select");
  }

  function handleTextDragStateChange(id: string, isDragging: boolean) {
    patchActiveObject(id, { isDragging });
  }

  // ---------- Selection ----------

  /** Selecting any member of a group selects the whole group. */
  function expandGroups(ids: string[]): string[] {
    const groups = new Set(activePage.objects.filter((o) => ids.includes(o.id) && o.groupId).map((o) => o.groupId));
    return activePage.objects.filter((o) => ids.includes(o.id) || (o.groupId && groups.has(o.groupId))).map((o) => o.id);
  }

  function handleSelectObject(id: string | null, additive: boolean) {
    if (id === null) {
      if (!additive) setSelectedIds([]);
      return;
    }
    const clicked = expandGroups([id]);
    if (!additive) {
      setSelectedIds(clicked);
      return;
    }
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => !clicked.includes(x)) : [...current, ...clicked.filter((x) => !current.includes(x))]));
  }

  function handleSelectIds(ids: string[], additive: boolean) {
    const expanded = expandGroups(ids);
    setSelectedIds((current) => (additive ? [...new Set([...current, ...expanded])] : expanded));
  }

  function handleSelectAll() {
    setTool("select");
    setSelectedIds(activePage.objects.filter((o) => !o.locked && !o.hidden).map((o) => o.id));
  }

  // ---------- Selection actions ----------

  function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    pushHistory();
    setActiveObjects(activePage.objects.filter((o) => !selectedIds.includes(o.id)));
    setSelectedIds([]);
  }

  /** Copies the selection onto every other page — or, when it's already repeated, removes it from all of them. */
  function handleToggleRepeat() {
    if (selectedObjects.length === 0) return;
    pushHistory();
    const repeatIds = selectedObjects.map((o) => o.repeatId).filter((id): id is string => Boolean(id));
    if (repeatIds.length === selectedObjects.length) {
      setPages((prev) => removeRepeats(prev, repeatIds));
      setSelectedIds([]);
    } else {
      setPages((prev) => repeatOnAllPages(prev, activePage.id, selectedIds));
    }
  }

  // ---------- Whole-book edits ----------

  function handleApplyFrameToAll() {
    const frame = activePage.objects.find((o) => o.kind === "stamp" && o.isFrame);
    pushHistory();
    setPages((prev) => applyFrameToAll(prev, frame?.kind === "stamp" ? (frame.frameId ?? null) : null));
  }

  function handleApplyPatternToAll() {
    pushHistory();
    setPages((prev) => applyPatternToAll(prev, activePage.backgroundPatternId ?? null));
  }

  function handleSetLineWidth(width: number, allPages: boolean) {
    pushHistory();
    if (editingCover) updateActivePage(setLineWidth([activePage], width)[0]);
    else setPages((prev) => setLineWidth(prev, width, allPages ? undefined : activePage.id));
  }

  function handlePageNumbers(mode: PageNumberMode) {
    pushHistory();
    setPages((prev) => applyPageNumbers(prev, mode));
  }

  function handleDuplicateSelected() {
    if (selectedObjects.length === 0) return;
    pushHistory();
    const groupIds = new Map<string, string>();
    const copies = selectedObjects.map((o) => {
      let groupId = o.groupId;
      if (groupId) {
        if (!groupIds.has(groupId)) groupIds.set(groupId, makeId("group"));
        groupId = groupIds.get(groupId);
      }
      return { ...o, id: makeId(o.kind), x: o.x + 24, y: o.y + 24, groupId, locked: false, isFrame: false, role: undefined, repeatId: undefined } as PageObject;
    });
    setActiveObjects([...activePage.objects, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  }

  /** Moves the selected objects one step up (+1) or down (−1) the stack, as a block, keeping their relative order. */
  function handleReorder(direction: 1 | -1) {
    if (selectedIds.length === 0) return;
    const next = [...activePage.objects];
    const indices = next.map((o, i) => (selectedIds.includes(o.id) ? i : -1)).filter((i) => i !== -1);
    const ordered = direction === 1 ? indices.reverse() : indices;
    let moved = false;
    for (const i of ordered) {
      const j = i + direction;
      if (j < 0 || j >= next.length || selectedIds.includes(next[j].id)) continue;
      [next[i], next[j]] = [next[j], next[i]];
      moved = true;
    }
    if (!moved) return;
    pushHistory();
    setActiveObjects(next);
  }

  /** Drag-reorder from the Layers list: `toIndex` is in back-to-front array order. */
  function handleMoveObject(id: string, toIndex: number) {
    const from = activePage.objects.findIndex((o) => o.id === id);
    if (from === -1 || from === toIndex) return;
    const next = [...activePage.objects];
    const [obj] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, obj);
    pushHistory();
    setActiveObjects(next);
  }

  /** `at` = the key event's timeStamp: nudges closer together than NUDGE_HISTORY_WINDOW_MS share one undo step. */
  function handleNudge(dx: number, dy: number, at: number) {
    const movable = selectedObjects.filter((o) => !o.locked);
    if (movable.length === 0) return;
    if (at - lastNudgeRef.current > NUDGE_HISTORY_WINDOW_MS) pushHistory();
    lastNudgeRef.current = at;
    applyChanges(new Map(movable.map((o) => [o.id, { x: o.x + dx, y: o.y + dy }])));
  }

  /** Aligns to the selection's own bounds, or to the page when a single object is selected. */
  function handleAlign(edge: AlignEdge) {
    const movable = selectedObjects.filter((o) => !o.locked);
    if (movable.length === 0) return;
    const target = movable.length === 1 ? activeGeo.trim : unionBounds(movable.map(objectBounds));
    if (!target) return;
    const deltas = alignDeltas(movable, edge, target);
    pushHistory();
    applyChanges(new Map(movable.map((o, i) => [o.id, { x: o.x + deltas[i].dx, y: o.y + deltas[i].dy }])));
  }

  function handleDistribute(axis: "x" | "y") {
    const movable = selectedObjects.filter((o) => !o.locked);
    if (movable.length < 3) return;
    const deltas = distributeDeltas(movable, axis);
    pushHistory();
    applyChanges(new Map(movable.map((o, i) => [o.id, { x: o.x + deltas[i].dx, y: o.y + deltas[i].dy }])));
  }

  function handleFlip(direction: "horizontal" | "vertical") {
    const movable = selectedObjects.filter((o) => !o.locked);
    if (movable.length === 0) return;
    pushHistory();
    applyChanges(new Map(movable.map((o) => [o.id, direction === "horizontal" ? flippedHorizontally(o) : flippedVertically(o)])));
  }

  function handleGroup() {
    if (selectedObjects.length < 2) return;
    const groupId = makeId("group");
    pushHistory();
    applyChanges(new Map(selectedObjects.map((o) => [o.id, { groupId }])));
  }

  function handleUngroup() {
    if (!selectedObjects.some((o) => o.groupId)) return;
    pushHistory();
    applyChanges(new Map(selectedObjects.map((o) => [o.id, { groupId: undefined }])));
  }

  function handleToggleObjectFlag(id: string, flag: "locked" | "hidden") {
    const obj = activePage.objects.find((o) => o.id === id);
    if (!obj) return;
    pushHistory();
    applyChanges(new Map([[id, { [flag]: !obj[flag] }]]));
    // A hidden or locked object can't stay in the canvas selection.
    if (!obj[flag]) setSelectedIds((ids) => ids.filter((x) => x !== id));
  }

  // ---------- AI command bar ----------

  const [commandStatus, setCommandStatus] = useState<string | null>(null);

  /** Runs one AI command on the current page: plan (server) → pictures, if any → one undo step. */
  async function handleCommand(command: string): Promise<CommandOutcome> {
    const pageId = activePage.id;
    const summary = summarizePage(activePage, activeGeo, selectedIds);
    setCommandStatus(t("Thinking…"));
    try {
      const response = await fetch("/api/editor-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, page: summary, lang }),
      });
      const body = (await response.json().catch(() => null)) as { reply?: string; actions?: unknown; error?: string } | null;
      if (!response.ok || !body) return { ok: false, changed: false, reply: aiErrorText(t, response.status, body?.error ?? t("The command failed")) };
      // Re-checked here too: only real objects of this page, only known actions.
      const result = parseCommandResult(body, summary.objects.map((o) => o.id));
      if (result.actions.length === 0) return { ok: true, changed: false, reply: result.reply || t("I couldn't do that on this page.") };

      const pictures: CommandPictures = new Map();
      const total = result.actions.filter((a) => a.type === "add_picture").length;
      let failed = 0;
      for (const [i, action] of result.actions.entries()) {
        if (action.type !== "add_picture") continue;
        setCommandStatus(total === 1 ? t("Drawing the picture…") : t("Drawing picture {n} of {total}…", { n: pictures.size + failed + 1, total }));
        try {
          pictures.set(i, await generateLineArtPicture(action.subject, "simple coloring page line art", t));
        } catch {
          failed++;
        }
      }
      const applied = applyCommandActions(activePage, activeGeo, result.actions, pictures);
      pushHistory();
      setPages((prev) => prev.map((p) => (p.id === pageId ? applied.page : p)));
      setTool("select");
      setSelectedIds(applied.selected);
      const note = failed === 0 ? "" : ` ${failed === 1 ? t("1 picture couldn't be made.") : t("{n} pictures couldn't be made.", { n: failed })}`;
      return { ok: true, changed: true, reply: `${result.reply || t("Done.")}${note}` };
    } finally {
      setCommandStatus(null);
    }
  }

  /** Locks every selected object (and drops them from the selection — locked objects can't be selected). */
  function handleLockSelected() {
    if (selectedObjects.length === 0) return;
    pushHistory();
    applyChanges(new Map(selectedObjects.map((o) => [o.id, { locked: true }])));
    setSelectedIds([]);
  }

  function handleUpdateSelectedText(changes: ObjectChanges) {
    const texts = selectedObjects.filter((o) => o.kind === "text");
    if (texts.length === 0) return;
    pushHistory();
    applyChanges(new Map(texts.map((o) => [o.id, changes])));
  }

  /** Seals every gap the check found with a pen stroke (as thick as the page's usual line), then re-checks. */
  function handleCloseGaps() {
    if (!gapMarkers || gapMarkers.length === 0) return;
    const pens = activePage.lines.filter((l) => l.tool === "pen").map((l) => l.strokeWidth).sort((a, b) => a - b);
    const typical = pens.length ? pens[Math.floor(pens.length / 2)] : strokeWidth;
    handleAddLines(gapMarkers.map((m) => ({ id: makeId("line"), tool: "pen" as const, strokeWidth: Math.max(m.bridge.width, typical), points: [...m.bridge.points] })));
    recheckGapsRef.current = true;
  }

  function handleRunAgeCheck(group: AgeGroup = ageGroup) {
    const stage = stageRef.current;
    const ink = stage ? captureInk(stage) : null;
    if (!ink) return;
    setAgeGroup(group);
    setAgeCheck({ page: activePage, result: checkAge(ink, group) });
  }

  function handleRunGapCheck() {
    const stage = stageRef.current;
    const ink = stage ? captureInk(stage) : null;
    if (!ink) return;
    setGapCheck({ page: activePage, markers: findGaps(ink) });
  }

  // After closing gaps, re-check once the page with the new strokes is on
  // screen — this render's closure holds the updated page, so the result
  // attaches to it (see gapCheck's page-identity rule).
  const recheckGapsRef = useRef(false);
  useEffect(() => {
    if (!recheckGapsRef.current) return;
    recheckGapsRef.current = false;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => handleRunGapCheck()));
    return () => cancelAnimationFrame(frame);
  });

  // ---------- Print settings & cover ----------

  /** Bleed on/off resizes every page canvas by 0.125in a side; content keeps its place relative to the trim. */
  async function handleToggleBleed(on: boolean) {
    if (on === bleed || convertingBleed) return;
    captureActiveThumbnail();
    pushHistory();
    setConvertingBleed(true);
    try {
      const converted = await convertPages(pages, interiorSpace(trimSizeId, on));
      setPages(syncPageNumbers(converted));
      setBleed(on);
      setSelectedIds([]);
    } finally {
      setConvertingBleed(false);
    }
  }

  function handlePaperChange(next: PaperType) {
    pushHistory();
    setCoverDesign(fittedCover); // pin the current layout so the refit on the next render moves content with the spine
    setPaper(next);
  }

  function handleCoverBackground(color: string) {
    pushHistory();
    updateActivePage({ isCover: true, coverBackgroundColor: color });
  }

  /** The book title, rotated to read top-to-bottom down the spine (the US/UK convention). */
  function handleAddSpineText() {
    if (!cover.spineTextAllowed) return;
    const s = cover.spineRect;
    const length = s.bottom - s.top - 72; // clear of the top and bottom edges
    const fontSize = Math.max(8, Math.min(24, cover.spine * 0.6));
    const spineText: TextData = {
      kind: "text",
      id: makeId("text"),
      text: title,
      fontFamily: FONT_OPTIONS[0].value,
      fontSize,
      align: "center",
      // Rotated 90° clockwise around its top-left: it then extends left of x.
      x: (s.left + s.right) / 2 + fontSize * 0.6,
      y: s.top + 36,
      width: length,
      height: fontSize * 1.2,
      rotation: 90,
      scaleX: 1,
      scaleY: 1,
      fill: "#111827",
      isDragging: false,
    };
    pushHistory();
    setActiveObjects([...activePage.objects, spineText]);
    setSelectedIds([spineText.id]);
  }

  const [isExportingCover, setIsExportingCover] = useState(false);
  async function handleExportCover() {
    const stage = stageRef.current;
    if (!stage || !editingCover || isExportingCover) return;
    setIsExportingCover(true);
    setSelectedIds([]);
    try {
      await waitForNextPaint();
      const src = captureStage(stage, EXPORT_PIXEL_RATIO);
      await exportPagesToPdf([coverExportPage(src, cover.space)], `${slugify(title)}-cover.pdf`);
      logExport("export_cover");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not export the cover."));
    } finally {
      setIsExportingCover(false);
    }
  }

  // ---------- AI & import ----------

  function handlePlaceFullPage(src: string, size: ImageSize) {
    const stamp = fullPageStamp(src, size, activeGeo);
    pushHistory();
    setActiveObjects([...activePage.objects, stamp]);
    setTool("select");
    setSelectedIds([stamp.id]);
  }

  function handleSeriesStart() {
    captureActiveThumbnail();
    pushHistory();
  }

  /** Called as each series page finishes — functional update, since the series runs across many renders. */
  function handleAppendImagePage(src: string, size: ImageSize, caption?: string) {
    const page = pageFromImage(src, size, space, caption);
    setPages((prev) => renumber([...prev, ...withRepeats([page], prev)]));
    setActivePageId(page.id);
    setSelectedIds([]);
  }

  // ---------- Pages ----------

  function handleAddPage(template: PageTemplate) {
    captureActiveThumbnail();
    pushHistory();
    const page = createPageFromTemplate(pages.length + 1, space, template, t);
    setPages((prev) => renumber([...prev, ...withRepeats([page], prev)]));
    setActivePageId(page.id);
    setSelectedIds([]);
  }

  /** Appends generated pages (worksheets) after the last page and shows the first of them. */
  function handleAppendPages(newPages: BookPage[]) {
    if (newPages.length === 0) return;
    captureActiveThumbnail();
    pushHistory();
    setPages((prev) => renumber([...prev, ...withRepeats(newPages, prev)]));
    setActivePageId(newPages[0].id);
    setSelectedIds([]);
  }

  function handleDuplicatePage(id: string) {
    const index = pages.findIndex((p) => p.id === id);
    if (index === -1) return;
    captureActiveThumbnail();
    pushHistory();
    const copy = duplicatePage(pages[index], index + 2);
    setPages((prev) => renumber([...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]));
    setActivePageId(copy.id);
    setSelectedIds([]);
  }

  function handleReorderPages(next: BookPage[]) {
    pushHistory();
    setPages(renumber(next));
  }

  /** Single-sided printing: a blank reverse after every page, so markers can't bleed through onto the next picture. Toggles the whole set. */
  function handleToggleBlankBacks() {
    captureActiveThumbnail();
    pushHistory();
    if (pages.some((p) => p.isBlankBack)) {
      const next = renumber(pages.filter((p) => !p.isBlankBack));
      setPages(next);
      if (!next.some((p) => p.id === activePageId)) setActivePageId(next[0].id);
    } else {
      setPages(renumber(pages.flatMap((p) => [p, { ...createPageFromTemplate(0, space), isBlankBack: true }])));
    }
    setSelectedIds([]);
  }

  /** Snapshots the CURRENTLY rendered page (before switching away from it) as low-res preview art — see BookPage.thumbnailDataUrl's own doc. */
  function captureActiveThumbnail() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = captureStage(stage, THUMBNAIL_PIXEL_RATIO);
    setPages((prev) => prev.map((p) => (p.id === activePageId ? { ...p, thumbnailDataUrl: dataUrl } : p)));
  }

  function handleSelectPage(id: string) {
    if (id !== activePageId) captureActiveThumbnail();
    setActivePageId(id);
    setSelectedIds([]);
  }

  function handleDeletePage(id: string) {
    if (pages.length <= 1) return;
    pushHistory();
    const index = pages.findIndex((p) => p.id === id);
    const next = renumber(pages.filter((p) => p.id !== id));
    setPages(next);
    if (id === activePageId) setActivePageId(next[Math.max(0, index - 1)].id);
    setSelectedIds([]);
  }

  // ---------- Save / load / export ----------

  function handleSaveProject() {
    downloadProjectAsJson({ title, pages, updatedAt: new Date().toISOString() }, `${slugify(title)}.json`);
  }

  async function handleLoadProjectFile(file: File) {
    try {
      const project = await readProjectFromFile(file);
      if (!window.confirm(t("Loading a project will replace your current work. Continue?"))) return;
      const nextPages = project.pages.length > 0 ? await convertPages(project.pages, space) : [createPageFromTemplate(1, space)];
      setPages(nextPages);
      setActivePageId(nextPages[0].id);
      setTitle(project.title || t(DEFAULT_TITLE));
      setSelectedIds([]);
      setPendingPlacement(null);
      historyRef.current = [];
      redoRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not load that project file."));
    }
  }

  /** Renders every page in turn and captures it at `pixelRatio` (plus a fresh thumbnail). Restores the active page after. */
  async function renderAllPages(pixelRatio: number): Promise<string[]> {
    setSelectedIds([]);
    const originalActivePageId = activePageId;
    // Cover and Assemble don't show interior pages on the canvas — render in Draw, then come back.
    const originalMode = mode;
    if (mode === "cover" || mode === "assemble") setMode("draw");
    const images: string[] = [];
    const thumbnails: Record<string, string> = {};
    try {
      await waitForNextPaint();
      for (const page of pages) {
        setActivePageId(page.id);
        await waitForNextPaint();
        const stage = stageRef.current;
        if (stage) {
          images.push(captureStage(stage, pixelRatio));
          thumbnails[page.id] = captureStage(stage, THUMBNAIL_PIXEL_RATIO);
        }
      }
      setPages((prev) => prev.map((p) => (thumbnails[p.id] ? { ...p, thumbnailDataUrl: thumbnails[p.id] } : p)));
    } finally {
      setActivePageId(originalActivePageId);
      setMode(originalMode);
    }
    return images;
  }

  async function runExport() {
    if (isExporting || pages.length === 0) return;
    setIsExporting(true);
    try {
      const dataUrls = await renderAllPages(EXPORT_PIXEL_RATIO);
      await exportPagesToPdf(
        dataUrls.map((src, i) => interiorExportPage(src, space, i + 1)),
        `${slugify(title)}.pdf`
      );
      logExport("export_pdf");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not export this book to PDF."));
    } finally {
      setIsExporting(false);
    }
  }

  /** Export's real gate: blocking preflight issues stop export outright; any issue at all (blocking or warning) surfaces the modal first. */
  function handleExport() {
    if (isExporting || pages.length === 0) return;
    const issues = runEditorPreflightCheck(pages);
    if (issues.length === 0) {
      void runExport();
      return;
    }
    setShowPreflight(true);
  }

  function pageLabel(id: string) {
    const index = pages.findIndex((p) => p.id === id);
    return index === -1 ? id : String(index + 1).padStart(2, "0");
  }

  // The preflight's one-click repairs — shared by the export gate and the readiness card.
  function fixPageCount() {
    const toAdd = pagesNeededForMultipleOf4(pages.length);
    if (toAdd === 0) return;
    pushHistory();
    setPages((prev) => renumber([...prev, ...withRepeats(Array.from({ length: toAdd }, () => createPageFromTemplate(0, space)), prev)]));
  }
  function fixThinStrokes() {
    pushHistory();
    setPages((prev) => thickenThinStrokes(prev));
  }
  function fixMargins() {
    pushHistory();
    setPages((prev) => clampObjectsToMargin(prev));
  }

  function mapPreflightIssue(issue: EditorPreflightIssue): PreflightIssue {
    if (issue.code === "PAGE_COUNT") {
      const toAdd = pagesNeededForMultipleOf4(pages.length);
      return {
        severity: issue.severity,
        cause: t("Total pages: {n}. Saddle stitch binding needs a multiple of 4.", { n: issue.count }),
        explanation: t("Saddle-stitch binding requires the total page count to be a multiple of 4."),
        autoFixLabel: toAdd === 1 ? t("Add 1 blank page") : t("Add {n} blank pages", { n: toAdd }),
        onAutoFix: fixPageCount,
      };
    }
    if (issue.code === "THIN_STROKE") {
      return {
        severity: issue.severity,
        cause: t("{n} lines below 3pt — may print faint.", { n: issue.count }),
        explanation: t("Very thin lines can print faint or drop out entirely."),
        autoFixLabel: t("Thicken all"),
        onAutoFix: fixThinStrokes,
      };
    }
    return {
      severity: issue.severity,
      cause: t("{n} pages — content extends past the 0.5in safe margin.", { n: issue.count }),
      explanation: t("Content should stay clear of the page edges to survive trimming."),
      autoFixLabel: t("Nudge shapes inside margin"),
      onAutoFix: fixMargins,
    };
  }

  const preflightIssues = runEditorPreflightCheck(pages);
  const preflightModalIssues: PreflightIssue[] = preflightIssues.map(mapPreflightIssue);
  const preflightFlaggedPages: FlaggedPage[] = preflightIssues
    .flatMap((issue) => issue.pageIds.map((id) => ({ id, ringColor: issue.severity === "blocking" ? ("error" as const) : ("warning" as const) })))
    .filter((entry, index, all) => all.findIndex((e) => e.id === entry.id) === index)
    .map((entry) => ({ ringColor: entry.ringColor, label: pageLabel(entry.id) }));

  /**
   * "Publish" — marks the book published (real status, not just a
   * label) and shows the preview as confirmation.
   */
  async function handlePublish() {
    if (pages.length === 0) return;
    setBookStatus("published");
    setPreviewImages(await renderAllPages(PREVIEW_PIXEL_RATIO));
  }

  async function handlePreview() {
    if (pages.length === 0) return;
    setPreviewImages(await renderAllPages(PREVIEW_PIXEL_RATIO));
  }

  function handleModeChange(next: EditorMode) {
    setMode(next);
    setSelectedIds([]); // a selection carrying over across a mode switch has no meaning here — also avoids a stale Transformer contaminating Color mode's flood-fill boundary snapshot
    setPendingPlacement(null);
    setTool(next === "color" ? "fill" : "select");
    setGapCheck(null);
  }

  function handleToolChange(next: DrawingTool) {
    setTool(next);
    if (next !== "lasso") setSelectedLineIds([]);
    if (next !== "select") setSelectedIds([]);
    // Shape and Text are ready to place straight away (last shape used /
    // the default text style), so a click on the page does something even
    // before an option in the panel is picked. Stamps need a choice first.
    if (next === "shape") setPendingPlacement({ kind: "shape", shapeKind: lastShapeRef.current });
    else if (next === "text") setPendingPlacement({ kind: "text", fontFamily: FONT_OPTIONS[0].value, fontSize: 32, fill: activeColor });
    else setPendingPlacement(null);
  }

  // ---------- Keyboard ----------

  // Handlers change every render; the window listener is registered once
  // and always calls the latest version through this ref.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || showPreflight || previewImages) return;
      const key = e.key.toLowerCase();
      const mod = isPrimaryModifier(e);

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (mode === "assemble") return;
      if (mod && key === "d") {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        handleSelectAll();
        return;
      }
      if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) handleUngroup();
        else handleGroup();
        return;
      }
      if (mod || e.altKey) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (tool === "lasso") handleDeleteLines();
        else handleDeleteSelected();
      } else if (e.key.startsWith("Arrow") && tool === "lasso" && pickedLineIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        handleMoveLines(pickedLineIds, e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      } else if (e.key === "Escape") {
        setSelectedLineIds([]);
        setSelectedIds([]);
        setPendingPlacement(null);
        setShowShortcuts(false);
      } else if (e.key.startsWith("Arrow") && selectedIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        handleNudge(dx, dy, e.timeStamp);
      } else if (e.key === "?") {
        setShowShortcuts((v) => !v);
      } else if (key === "g") {
        setShowGuides((v) => !v);
      } else if (key === "m" && (mode === "draw" || mode === "cover")) {
        setSymmetry((s) => (s === "off" ? "mirror-x" : "off"));
      } else if (e.key === "[" || e.key === "]") {
        const widths = [...new Set([1, 2, ...BRUSH_PRESETS.map((b) => b.width), 30, 40])].sort((a, b) => a - b);
        setStrokeWidth((w) => (e.key === "]" ? (widths.find((x) => x > w) ?? w) : ([...widths].reverse().find((x) => x < w) ?? w)));
      } else if (TOOL_KEYS[key]) {
        const next = TOOL_KEYS[key];
        const colorTool = next === "fill" || next === "brush";
        const allowed = next === "select" || (colorTool ? mode === "color" : mode === "draw" || mode === "cover");
        if (allowed) handleToolChange(next);
      }
    };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="pw-workspace relative h-screen p-[18px] font-pw-sans text-ink">
      <EditorTopBar
        title={title}
        onTitleChange={setTitle}
        pages={pages}
        activePageId={activePageId}
        trimSizeLabel={`${trimShortLabel(trimSizeId)}${bleed ? ` + ${t("bleed")}` : ""}`}
        mode={mode}
        onModeChange={handleModeChange}
        onSave={handleSaveProject}
        onLoad={handleLoadProjectFile}
        onUndo={handleUndo}
        canUndo={canUndo}
        onRedo={handleRedo}
        canRedo={canRedo}
        onShowShortcuts={() => setShowShortcuts(true)}
        onPreview={handlePreview}
        commentCount={Object.values(openCommentCounts).reduce((a, b) => a + b, 0)}
        commentsActive={sidePanel === "comments"}
        onToggleComments={() => setSidePanel((v) => (v === "comments" ? "default" : "comments"))}
        onShare={user && !reviewMode ? () => setShowShare(true) : undefined}
        onExport={handleExport}
        isExporting={isExporting}
        onPublish={handlePublish}
      />
      <ToolRail mode={mode} activeTool={tool} onToolChange={handleToolChange} onAiClick={() => setSidePanel((v) => (v === "ai" ? "default" : "ai"))} aiActive={sidePanel === "ai"} />

      {reviewMode && (
        <div role="status" className="absolute left-1/2 top-[80px] z-20 -translate-x-1/2 rounded-pill bg-warning px-4 py-1.5 text-helper font-medium text-ink shadow-toolbar">
          {t("Reviewing someone else's book — changes here aren't saved. Leave feedback in Comments.")}
        </div>
      )}

      <div className="ml-[78px] mr-[278px] mt-[88px] flex h-[calc(100%-88px)] min-w-0 flex-col gap-3.5">
        {mode === "assemble" ? (
          <div className="flex flex-1 items-start justify-center overflow-auto py-4">
            <BookAssemblyScreen
              bookTitle={title}
              pages={pages}
              activePageId={activePageId}
              onSelectPage={handleSelectPage}
              onReorder={handleReorderPages}
              onAddPage={() => handleAddPage("blank")}
              onDeletePage={handleDeletePage}
            />
          </div>
        ) : (
          <>
            <CanvasArea
              page={activePage}
              space={activeSpace}
              guides={editingCover ? coverGuides(cover, t) : undefined}
              mode={mode}
              tool={tool}
              strokeWidth={strokeWidth}
              onStrokeWidthChange={setStrokeWidth}
              activeColor={activeColor}
              fillStyle={fillStyle}
              onSampleColor={setActiveColor}
              onFillChange={(dataUrl) => updateActivePage({ fillDataUrl: dataUrl })}
              pendingPlacement={pendingPlacement}
              selectedIds={selectedIds}
              onSelectObject={handleSelectObject}
              onSelectIds={handleSelectIds}
              onAddLines={handleAddLines}
              onPlaceObject={handlePlaceObject}
              onUpdateObjects={handleUpdateObjects}
              onTextDragStateChange={handleTextDragStateChange}
              onStageReady={(stage) => {
                stageRef.current = stage;
              }}
              showGrid={showGrid}
              onShowGridChange={setShowGrid}
              showGuides={showGuides}
              onShowGuidesChange={setShowGuides}
              symmetry={symmetry}
              onSymmetryChange={setSymmetry}
              smoothing={smoothing}
              onSmoothingChange={setSmoothing}
              lineStyle={lineStyle}
              onLineStyleChange={setLineStyle}
              selectedLineIds={pickedLineIds}
              onSelectLines={handleSelectLines}
              onMoveLines={handleMoveLines}
              onDeleteLines={handleDeleteLines}
              onDuplicateLines={handleDuplicateLines}
              gapMarkers={gapMarkers}
              detailMarkers={ageResult?.tooSmall}
              darkSurround={darkSurround}
              overlay={(scale) => {
                const bounds = tool === "select" && !reviewMode && selectedObjects.length > 0 ? unionBounds(selectedObjects.map(objectBounds)) : null;
                return bounds ? (
                  <SelectionToolbar
                    bounds={bounds}
                    scale={scale}
                    count={selectedObjects.length}
                    canGroup={selectedObjects.length > 1}
                    canUngroup={selectedObjects.some((o) => o.groupId)}
                    onDuplicate={handleDuplicateSelected}
                    onMirror={() => handleFlip("horizontal")}
                    onLock={handleLockSelected}
                    repeated={!editingCover && selectedObjects.every((o) => o.repeatId)}
                    onToggleRepeat={handleToggleRepeat}
                    onSaveStamp={() => void handleSaveMyStamp()}
                    onGroup={handleGroup}
                    onUngroup={handleUngroup}
                    onDelete={handleDeleteSelected}
                  />
                ) : null;
              }}
              locked={commandStatus !== null}
              bottomBar={mode === "draw" && !reviewMode ? <CommandBar onRun={handleCommand} onUndo={handleUndo} status={commandStatus} /> : undefined}
            />
            {!editingCover && (
            <PageFilmstrip
              pages={pages}
              activePageId={activePageId}
              onSelectPage={handleSelectPage}
              onAddPage={handleAddPage}
              onDeletePage={handleDeletePage}
              onDuplicatePage={handleDuplicatePage}
              onReorderPages={handleReorderPages}
              onToggleBlankBacks={handleToggleBlankBacks}
              commentCounts={openCommentCounts}
              onOpenWorksheets={() => setShowWorksheets(true)}
              onOpenImport={() => setShowImport(true)}
            />
            )}
          </>
        )}
      </div>

      {sidePanel === "comments" && (
        <CommentsPanel
          comments={comments}
          loading={commentsLoading && Boolean(user)}
          loadError={!sessionLoading && !user ? t("Sign in to read and write comments.") : commentsError && t(commentsError)}
          activePageId={activePageId}
          pageLabel={pageLabel}
          currentUserId={user?.id ?? null}
          isSupervisor={isSupervisor}
          onAdd={handleAddComment}
          onSetResolved={handleSetCommentResolved}
          onDelete={handleDeleteComment}
          onGoToPage={(id) => pages.some((p) => p.id === id) && handleSelectPage(id)}
          onClose={() => setSidePanel("default")}
        />
      )}

      {sidePanel === "ai" && mode !== "assemble" && (
        <AiStudioPanel
          onClose={() => setSidePanel("default")}
          onPickStamp={handlePickStamp}
          onPlaceFullPage={handlePlaceFullPage}
          onSeriesStart={handleSeriesStart}
          onAppendImagePage={handleAppendImagePage}
          currentSubject={activePage.objects.flatMap((o) => (o.kind === "stamp" && o.label ? [o.label] : []))[0]}
        />
      )}

      {sidePanel === "default" && mode !== "assemble" && (
        <RightPanel
          mode={mode}
          tool={tool}
          activeColor={activeColor}
          onSelectColor={setActiveColor}
          fillStyle={fillStyle}
          onFillStyleChange={setFillStyle}
          page={activePage}
          selectedIds={selectedIds}
          onSelectObject={handleSelectObject}
          onBringForward={() => handleReorder(1)}
          onSendBackward={() => handleReorder(-1)}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onAlign={handleAlign}
          onDistribute={handleDistribute}
          onFlip={handleFlip}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onToggleObjectFlag={handleToggleObjectFlag}
          onMoveObject={handleMoveObject}
          onUpdateSelectedText={handleUpdateSelectedText}
          onPickStamp={handlePickStamp}
          onAddShape={handleAddShape}
          onAddText={handleAddText}
          myStamps={myStamps}
          onPlaceMyStamp={handlePlaceMyStamp}
          onDeleteMyStamp={(id) => void deleteMyStamp(id).then(setMyStamps)}
          onSetBackgroundPattern={handleSetBackgroundPattern}
          onSetFrame={handleSetFrame}
          onApplyFrameToAll={editingCover ? undefined : handleApplyFrameToAll}
          onApplyPatternToAll={editingCover ? undefined : handleApplyPatternToAll}
          onToggleCover={handleToggleCover}
          onSetCoverBackgroundColor={handleSetCoverBackgroundColor}
          gapCount={gapMarkers ? gapMarkers.length : null}
          onRunGapCheck={handleRunGapCheck}
          onCloseGaps={handleCloseGaps}
          ageGroup={ageGroup}
          ageResult={ageResult}
          onRunAgeCheck={handleRunAgeCheck}
          onClearAgeCheck={() => setAgeCheck(null)}
          onClearGapCheck={() => setGapCheck(null)}
          leadCard={
            mode === "draw" || mode === "color" ? (
              <ReadinessCard
                readiness={bookReadiness(pages)}
                fixes={{ "page-count": fixPageCount, "thin-strokes": fixThinStrokes, margin: fixMargins }}
                onGoToPage={(id) => pages.some((p) => p.id === id) && handleSelectPage(id)}
              />
            ) : undefined
          }
          extraCards={
            editingCover ? (
              <CoverCard
                layout={cover}
                pageCount={pages.length}
                paper={paper}
                onPaperChange={handlePaperChange}
                backgroundColor={fittedCover.page.coverBackgroundColor ?? "#ffffff"}
                onBackgroundColorChange={handleCoverBackground}
                onAddSpineText={handleAddSpineText}
                onExportCover={() => void handleExportCover()}
                exporting={isExportingCover}
              />
            ) : mode === "draw" ? (
              <>
                <PageToolsCard
                  pageNumbers={pageNumberMode(pages)}
                  onPageNumbersChange={handlePageNumbers}
                  defaultLineWidth={strokeWidth}
                  onSetLineWidth={handleSetLineWidth}
                  onColorPreview={() => setColorPreviewInk(stageRef.current ? captureInk(stageRef.current) : null)}
                  trace={activePage.traceImage}
                  onTraceChange={(traceImage) => {
                    pushHistory();
                    updateActivePage({ traceImage });
                  }}
                />
                <BookPrintCard trimLabel={trimShortLabel(trimSizeId)} bleed={bleed} onToggleBleed={(on) => void handleToggleBleed(on)} converting={convertingBleed} onOpenListing={() => setShowListing(true)} onShareTemplate={() => setShowPublishTemplate(true)} />
              </>
            ) : null
          }
        />
      )}

      {previewImages && <BookPreviewModal images={previewImages} onClose={() => setPreviewImages(null)} />}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {showShare && <ShareDialog bookId={bookId} onClose={() => setShowShare(false)} />}

      {notice && (
        <div role="status" className="pw-glass fixed left-1/2 top-24 z-40 flex -translate-x-1/2 items-center gap-3 rounded-pill px-4 py-2 text-helper text-ink shadow-toolbar">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="font-semibold text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent">
            {t("OK")}
          </button>
        </div>
      )}
      {colorPreviewInk && <ColorPreviewModal ink={colorPreviewInk} fileName={`${slugify(title)}-page-${activePage.pageNumber}`} onClose={() => setColorPreviewInk(null)} />}
      {showImport && <ImportImagesDialog space={space} onAdd={handleAppendPages} onClose={() => setShowImport(false)} />}
      {showWorksheets && <WorksheetDialog space={space} currentPage={activePage} captureInk={() => (stageRef.current ? captureInk(stageRef.current) : null)} onAdd={handleAppendPages} onClose={() => setShowWorksheets(false)} />}

      {showListing && <ListingKitModal input={{ title, pages, trimSizeId, bleed }} onClose={() => setShowListing(false)} />}
      {showPublishTemplate && <PublishTemplateDialog title={title} pages={pages} trimSize={trimSizeId} bleed={bleed} onClose={() => setShowPublishTemplate(false)} />}

      {showPreflight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={() => setShowPreflight(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <PreflightBlockingModal
              issues={preflightModalIssues}
              flaggedPages={preflightFlaggedPages}
              onExport={() => {
                setShowPreflight(false);
                void runExport();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
