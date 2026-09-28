"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2, Sparkles } from "lucide-react";
import TwoPageSpreadEditor from "@/components/TwoPageSpreadEditor";
import PageManager, { duplicateSpread } from "@/components/PageManager";
import BookWizard from "@/components/BookWizard";
import PreflightPanel from "@/components/PreflightPanel";
import PreflightChecklist from "@/components/PreflightChecklist";
import { runPreflightCheck } from "@/utils/preflightChecker";
import type { PreflightIssue } from "@/utils/preflightChecker";
import type { BookState, PageSpread } from "@/types/book";

/**
 * Sprint 4's interactive demo: Book Wizard -> PageManager (reorder /
 * duplicate / delete) -> live PDF export of whatever's actually in state.
 * Not part of the deliverable itself (that's BookWizard.tsx, PageManager.tsx,
 * and utils/pdfExporter.ts) — this is the client-side wiring that proves
 * they work together end-to-end, including a real export of
 * wizard-generated content rather than only the fixed sample data in
 * /api/export-test.
 */
export default function ClientApp() {
  const [book, setBook] = useState<BookState | null>(null);
  const [activeSpreadId, setActiveSpreadId] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeSpread = useMemo(
    () => book?.spreads.find((s) => s.id === activeSpreadId) ?? book?.spreads[0] ?? null,
    [book, activeSpreadId]
  );
  const issues = useMemo(() => (book ? runPreflightCheck(book) : []), [book]);

  function handleGenerate(newBook: BookState) {
    setBook(newBook);
    setActiveSpreadId(newBook.spreads[0]?.id ?? null);
    setExportError(null);
  }

  function handleReorder(spreads: PageSpread[]) {
    if (!book) return;
    setBook({ ...book, spreads, updatedAt: new Date().toISOString() });
  }

  function handleDuplicate(spreadId: string) {
    if (!book) return;
    const index = book.spreads.findIndex((s) => s.id === spreadId);
    if (index === -1) return;
    const copy = duplicateSpread(book.spreads[index]);
    const next = [...book.spreads];
    next.splice(index + 1, 0, copy);
    setBook({ ...book, spreads: next.map((s, i) => ({ ...s, spreadNumber: i + 1 })), updatedAt: new Date().toISOString() });
    setActiveSpreadId(copy.id);
  }

  function handleDelete(spreadId: string) {
    if (!book) return;
    const next = book.spreads.filter((s) => s.id !== spreadId);
    const renumbered = next.map((s, i) => ({ ...s, spreadNumber: i + 1 }));
    setBook({ ...book, spreads: renumbered, updatedAt: new Date().toISOString() });
    if (activeSpreadId === spreadId) setActiveSpreadId(renumbered[0]?.id ?? null);
  }

  /** Jumps the spread editor to whichever spread owns the clicked Pre-Flight issue, so clicking a checklist row actually takes you to the problem. */
  function handleSelectIssue(issue: PreflightIssue) {
    if (!book || !issue.elementId) return;
    const owner = book.spreads.find((s) => s.leftPage.elements.some((e) => e.id === issue.elementId) || s.rightPage.elements.some((e) => e.id === issue.elementId));
    if (owner) setActiveSpreadId(owner.id);
  }

  async function handleExport() {
    if (!book || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const response = await fetch("/api/export-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${book.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "book"}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4 rounded-lg border border-slate-200 bg-slate-100 p-4">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sprint 4 — Book Wizard + PDF Export</h2>
          <p className="text-xs text-slate-500">
            {book ? `${book.title} — ${book.spreads.length} spreads (${book.spreads.length * 2} pages)` : "No book generated yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Sparkles size={16} />
            Open Book Wizard
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!book || isExporting}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            Export Book PDF
          </button>
        </div>
      </div>

      {exportError && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{exportError}</p>}

      {book && activeSpread ? (
        <>
          <div className="flex items-start justify-center overflow-auto rounded-lg bg-slate-200 p-6">
            <TwoPageSpreadEditor spread={activeSpread} settings={book.settings} showGuides />
          </div>
          <PageManager
            spreads={book.spreads}
            activeSpreadId={activeSpread.id}
            settings={book.settings}
            onSelectSpread={setActiveSpreadId}
            onReorder={handleReorder}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
          <PreflightChecklist issues={issues} onSelectIssue={handleSelectIssue} />
        </>
      ) : (
        <p className="py-20 text-center text-sm text-slate-500">Open the Book Wizard to generate a book.</p>
      )}

      <BookWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} onGenerate={handleGenerate} />
      {book && <PreflightPanel issues={issues} />}
    </div>
  );
}
