"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2, BookOpen, Image as ImageIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import TwoPageSpreadEditor from "@/components/kdp-editor/TwoPageSpreadEditor";
import PageThumbnailGrid from "@/components/kdp-editor/PageThumbnailGrid";
import BookWizard from "@/components/kdp-editor/BookWizard";
import PreflightPanel from "@/components/kdp-editor/PreflightPanel";
import CoverCanvas from "@/components/kdp-editor/CoverCanvas";
import { generateBookFromTopic } from "@/lib/bookWizard";
import { runPreflightCheck, type PreflightIssue } from "@/lib/preflightChecker";
import { exportBookToPdf, exportCoverToPdf } from "@/utils/kdpPdfExport";
import { DEFAULT_PRINT_SPEC } from "@/lib/kdpPrintSpec";
import { DEFAULT_COVER_SPEC, calculateSpineWidthIn } from "@/lib/coverSpec";
import { OCTOPUS_SVG } from "@/lib/oceanArtAssets";
import type { BookState, BookWizardConfig, CoverState, PaperType } from "@/types/kdpBook";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDefaultCover(book: BookState | null): CoverState {
  const pageCount = book ? book.spreads.length * 2 : 52;
  return {
    spec: { ...DEFAULT_COVER_SPEC, pageCount },
    elements: [
      {
        id: makeId("cover-title"),
        panel: "front",
        kind: "text",
        // A long generated title (topic + " Alphabet Coloring & Tracing
        // Book") wraps to 2-3 lines — width/height/fontSize are sized to
        // give it room rather than colliding with the art below.
        x: DEFAULT_PRINT_SPEC.bleedIn + calculateSpineWidthIn(pageCount, "white") + DEFAULT_PRINT_SPEC.trimWidthIn / 2 - 3.25,
        y: 0.9,
        width: 6.5,
        height: 2,
        rotation: 0,
        text: book?.title ?? "My Coloring Book",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 26,
        align: "center",
        fill: "#000000",
      },
      {
        id: makeId("cover-art"),
        panel: "front",
        kind: "art",
        x: DEFAULT_PRINT_SPEC.bleedIn + calculateSpineWidthIn(pageCount, "white") + DEFAULT_PRINT_SPEC.trimWidthIn / 2 - 2,
        y: 3.4,
        width: 4,
        height: 4,
        rotation: 0,
        svgMarkup: OCTOPUS_SVG,
        strokeWeight: 3,
      },
    ],
  };
}

export default function KdpApp() {
  const [book, setBook] = useState<BookState | null>(null);
  const [activeSpreadId, setActiveSpreadId] = useState<string | null>(null);
  const [cover, setCover] = useState<CoverState>(() => buildDefaultCover(null));
  const [view, setView] = useState<"editor" | "cover">("editor");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const activeSpread = useMemo(
    () => book?.spreads.find((s) => s.id === activeSpreadId) ?? book?.spreads[0] ?? null,
    [book, activeSpreadId]
  );

  const issues = useMemo<PreflightIssue[]>(() => (book ? runPreflightCheck(book) : []), [book]);

  function handleGenerate(config: BookWizardConfig) {
    setIsGenerating(true);
    const newBook = generateBookFromTopic(config, DEFAULT_PRINT_SPEC);
    setBook(newBook);
    setActiveSpreadId(newBook.spreads[0].id);
    setCover(buildDefaultCover(newBook));
    setIsGenerating(false);
  }

  function handleReorder(spreads: BookState["spreads"]) {
    if (!book) return;
    setBook({ ...book, spreads, updatedAt: new Date().toISOString() });
  }

  function handleSelectIssue(issue: PreflightIssue) {
    if (!book) return;
    const spread = book.spreads.find((s) => s.spreadNumber === issue.spreadNumber);
    if (spread) setActiveSpreadId(spread.id);
    setView("editor");
  }

  function handlePaperTypeChange(paperType: PaperType) {
    setCover((prev) => ({ ...prev, spec: { ...prev.spec, paperType } }));
  }

  async function handleExportBook() {
    if (!book || isExporting) return;
    setIsExporting(true);
    try {
      await exportBookToPdf(book);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportCover() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportCoverToPdf(cover, DEFAULT_PRINT_SPEC);
    } finally {
      setIsExporting(false);
    }
  }

  const spineWidthIn = calculateSpineWidthIn(cover.spec.pageCount, cover.spec.paperType);

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 p-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Children&apos;s Activity &amp; Coloring Book Editor</h1>
          <p className="text-xs text-slate-500">{book ? `${book.title} — ${book.spreads.length} spreads (${book.spreads.length * 2} pages)` : "No book generated yet"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("editor")}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", view === "editor" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <BookOpen size={14} />
            Interior
          </button>
          <button
            type="button"
            onClick={() => setView("cover")}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", view === "cover" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}
          >
            <ImageIcon size={14} />
            Cover
          </button>
          {view === "editor" ? (
            <button
              type="button"
              onClick={handleExportBook}
              disabled={!book || isExporting}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              Export Book PDF
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportCover}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              Export Cover PDF
            </button>
          )}
        </div>
      </div>

      {view === "editor" ? (
        <div className="flex flex-1 gap-4">
          <div className="flex w-72 shrink-0 flex-col gap-4">
            <BookWizard onGenerate={handleGenerate} isGenerating={isGenerating} />
            {book && <PreflightPanel issues={issues} onSelectIssue={handleSelectIssue} />}
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex flex-1 items-start justify-center overflow-auto rounded-lg bg-slate-200 p-6">
              {activeSpread ? (
                <TwoPageSpreadEditor spread={activeSpread} printSpec={DEFAULT_PRINT_SPEC} showGuides />
              ) : (
                <p className="mt-20 text-sm text-slate-500">Run the Book Wizard to generate a spread.</p>
              )}
            </div>

            {book && (
              <div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  {book.spreads.length} spreads — drag a thumbnail to reorder
                </p>
                <PageThumbnailGrid
                  spreads={book.spreads}
                  activeSpreadId={activeSpread?.id ?? null}
                  onSelectSpread={setActiveSpreadId}
                  onReorder={handleReorder}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 gap-4">
          <div className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Cover spec</h2>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Paper type
              <select
                value={cover.spec.paperType}
                onChange={(e) => handlePaperTypeChange(e.target.value as PaperType)}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
              >
                <option value="white">White</option>
                <option value="cream">Cream</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              Interior page count
              <input
                type="number"
                min={24}
                value={cover.spec.pageCount}
                onChange={(e) => setCover((prev) => ({ ...prev, spec: { ...prev.spec, pageCount: Number(e.target.value) } }))}
                className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
              />
            </label>
            <dl className="grid grid-cols-2 gap-1 text-xs text-slate-500">
              <dt>Spine width</dt>
              <dd className="text-right font-medium text-slate-700">{spineWidthIn.toFixed(4)}&quot;</dd>
            </dl>
          </div>

          <div className="flex flex-1 items-start justify-center overflow-auto rounded-lg bg-slate-200 p-6">
            <CoverCanvas cover={cover} printSpec={DEFAULT_PRINT_SPEC} showGuides />
          </div>
        </div>
      )}
    </div>
  );
}
