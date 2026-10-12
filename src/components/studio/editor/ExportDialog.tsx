"use client";

import { useState } from "react";
import { BookOpen, Eye, Loader2, Printer, ShoppingBag, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import StatusDot from "@/components/studio/ui/StatusDot";
import Toggle from "@/components/studio/ui/Toggle";
import type { PreflightIssue } from "@/components/studio/modals/PreflightBlockingModal";
import { howToPrintPage } from "@/components/studio/editor/PrintAtHomeDialog";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { SHEETS, type SheetId } from "@/utils/printables";

export type ExportPurpose = "kdp" | "home" | "etsy" | "sample";

/** What to make; pages are 1-based and inclusive. Etsy packs go through DigitalPackDialog instead. */
export interface ExportRequest {
  purpose: "kdp" | "home" | "sample";
  from: number;
  to: number;
  dpi: 300 | 150;
  /** KDP: the cover as a second PDF. */
  cover: boolean;
  /** Home printing: one PDF per paper size, each optionally starting with a "how to print" page. */
  sheets: SheetId[];
  instructions: Partial<Record<SheetId, string>>;
}

export interface ExportDialogProps {
  title: string;
  pageCount: number;
  /** The page open in the editor (1-based): where a sample starts. */
  currentPage: number;
  /** e.g. "8.5 × 8.5 in + bleed". */
  printLabel: string;
  singleSided: boolean;
  onToggleSingleSided: () => void;
  /** The pre-export check; blocking issues stop a KDP export (they don't matter at home). */
  issues: PreflightIssue[];
  /** About KDP printing this book: its cost per copy, or the page range KDP prints. */
  kdpNote: string;
  onExport: (request: ExportRequest) => Promise<void>;
  onOpenPack: () => void;
  onOpenProfit: () => void;
  onClose: () => void;
}

const SAMPLE_PAGES = 4;

/**
 * One place for every way out of the editor: choose what the file is for
 * (KDP, home printer, Etsy, a quick sample) and the settings follow from
 * it; then which pages and at what quality.
 */
export default function ExportDialog({ title, pageCount, currentPage, printLabel, singleSided, onToggleSingleSided, issues, kdpNote, onExport, onOpenPack, onOpenProfit, onClose }: ExportDialogProps) {
  const t = useT();
  const [purpose, setPurpose] = useState<ExportPurpose>("kdp");
  const [allPages, setAllPages] = useState(true);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(pageCount);
  const [dpi, setDpi] = useState<300 | 150>(300);
  const [cover, setCover] = useState(true);
  const [sheets, setSheets] = useState<SheetId[]>(["a4"]);
  const [withInstructions, setWithInstructions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(next: ExportPurpose) {
    setPurpose(next);
    setError(null);
    if (next === "sample") {
      setAllPages(false);
      setFrom(currentPage);
      setTo(Math.min(pageCount, currentPage + SAMPLE_PAGES - 1));
      setDpi(150);
    } else {
      setAllPages(true);
      setFrom(1);
      setTo(pageCount);
      setDpi(300);
    }
  }

  const blocking = issues.filter((i) => i.severity === "blocking").length;
  // KDP takes the whole interior in one file.
  const range = purpose === "kdp" || allPages ? { from: 1, to: pageCount } : { from: Math.max(1, Math.min(from, pageCount)), to: Math.min(pageCount, Math.max(to, from)) };
  const rangeValid = range.from >= 1 && range.to >= range.from && range.to <= pageCount;
  const count = range.to - range.from + 1;
  const canExport = !busy && rangeValid && (purpose !== "kdp" || blocking === 0) && (purpose !== "home" || sheets.length > 0);

  async function run() {
    if (purpose === "etsy") {
      onOpenPack();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const instructions: ExportRequest["instructions"] = {};
      if (purpose === "home" && withInstructions) for (const sheet of sheets) instructions[sheet] = howToPrintPage(sheet, title, t);
      await onExport({ purpose, from: range.from, to: range.to, dpi, cover: purpose === "kdp" && cover, sheets, instructions });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not export this book to PDF."));
      setBusy(false);
    }
  }

  const chip = (on: boolean) => cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", on ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt");
  const input = "h-8 w-16 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";
  const purposes: { value: ExportPurpose; label: string; hint: string; Icon: typeof BookOpen }[] = [
    { value: "kdp", label: t("Amazon KDP"), hint: t("Print-ready interior and cover"), Icon: BookOpen },
    { value: "home", label: t("Print at home"), hint: t("A4 or US Letter, inside the printer's margin"), Icon: Printer },
    { value: "etsy", label: t("Digital product"), hint: t("A ZIP to sell on Etsy"), Icon: ShoppingBag },
    { value: "sample", label: t("Sample"), hint: t("A few pages, small file to send"), Icon: Eye },
  ];
  const buttonLabel =
    purpose === "etsy" ? t("Continue") : purpose === "kdp" && cover ? t("Download {n} PDFs", { n: 2 }) : purpose === "home" && sheets.length > 1 ? t("Download {n} PDFs", { n: sheets.length }) : t("Download PDF");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
        className="flex max-h-full w-[560px] max-w-full flex-col gap-4 overflow-y-auto rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="export-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Export")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("What is it for?")}</MetaLabel>
          <div role="radiogroup" aria-label={t("What is it for?")} className="grid grid-cols-2 gap-2">
            {purposes.map(({ value, label, hint, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={purpose === value}
                onClick={() => choose(value)}
                className={cn(
                  "flex items-start gap-2.5 rounded-row-sm border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  purpose === value ? "border-accent bg-accent-tint" : "border-hairline hover:bg-inset-alt"
                )}
              >
                <Icon size={18} aria-hidden className={purpose === value ? "mt-0.5 text-accent" : "mt-0.5 text-ink-secondary"} />
                <span className="flex flex-col">
                  <span className={cn("text-body font-semibold", purpose === value ? "text-accent" : "text-ink")}>{label}</span>
                  <span className="text-helper text-ink-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {purpose === "etsy" ? (
          <p className="text-helper text-ink-secondary">{t("One ZIP with a PDF for each paper size, a PNG of every page and a license — the next step sets them up.")}</p>
        ) : (
          <>
            {purpose !== "kdp" && (
              <div className="flex flex-col gap-1.5">
                <MetaLabel>{t("Pages")}</MetaLabel>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" aria-pressed={allPages} onClick={() => setAllPages(true)} className={chip(allPages)}>
                    {t("All ({n})", { n: pageCount })}
                  </button>
                  <button type="button" aria-pressed={!allPages} onClick={() => setAllPages(false)} className={chip(!allPages)}>
                    {t("Some")}
                  </button>
                  {!allPages && (
                    <span className="flex items-center gap-1.5 text-helper text-ink-secondary">
                      <input type="number" min={1} max={pageCount} value={from} onChange={(e) => setFrom(Number(e.target.value))} aria-label={t("From page")} className={input} />
                      {t("to")}
                      <input type="number" min={1} max={pageCount} value={to} onChange={(e) => setTo(Number(e.target.value))} aria-label={t("To page")} className={input} />
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <MetaLabel>{t("Quality")}</MetaLabel>
              <div className="flex gap-1.5">
                <button type="button" aria-pressed={dpi === 300} onClick={() => setDpi(300)} className={chip(dpi === 300)}>
                  {t("300 DPI — for printing")}
                </button>
                <button type="button" aria-pressed={dpi === 150} onClick={() => setDpi(150)} className={chip(dpi === 150)}>
                  {t("150 DPI — smaller file")}
                </button>
              </div>
              {purpose === "kdp" && dpi === 150 && <p className="text-helper text-warning">{t("KDP asks for 300 DPI; at 150 lines may print soft.")}</p>}
            </div>

            {purpose === "home" && (
              <div className="flex flex-col gap-1.5">
                <MetaLabel>{t("Paper")}</MetaLabel>
                <div className="flex gap-1.5">
                  {(Object.keys(SHEETS) as SheetId[]).map((id) => (
                    <button key={id} type="button" aria-pressed={sheets.includes(id)} onClick={() => setSheets((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))} className={chip(sheets.includes(id))}>
                      {SHEETS[id].label}
                    </button>
                  ))}
                </div>
                <Toggle checked={withInstructions} onChange={setWithInstructions} label={t("Start with a “how to print” page")} />
              </div>
            )}

            {(purpose === "kdp" || purpose === "home") && (
              <div className="flex flex-col gap-1">
                <Toggle checked={singleSided} onChange={onToggleSingleSided} label={t("Single-sided: a blank back after every picture")} />
                <p className="pl-[46px] text-helper text-ink-muted">{t("Markers can't bleed through onto the next picture. This adds the blank pages to the book itself.")}</p>
              </div>
            )}

            {purpose === "kdp" && (
              <>
                <Toggle checked={cover} onChange={setCover} label={t("The cover too, as its own PDF (KDP takes it separately)")} />
                {issues.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <MetaLabel tone={blocking ? "error" : undefined}>{t("Pre-export check")}</MetaLabel>
                    {issues.map((issue) => (
                      <Card key={issue.cause} className="flex items-start gap-2.5 p-3">
                        <StatusDot tone={issue.severity === "blocking" ? "error" : "warning"} className="mt-1.5" />
                        <div className="flex-1">
                          <p className="text-body font-medium text-ink">{issue.cause}</p>
                          <p className="mt-0.5 text-helper text-ink-secondary">{issue.explanation}</p>
                          {issue.onAutoFix && (
                            <button type="button" onClick={issue.onAutoFix} className="mt-1 text-helper font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                              {issue.autoFixLabel}
                            </button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            <Card tone="accent" className="flex flex-col gap-1 p-3">
              <p className="text-helper text-ink-secondary">
                {count === 1 ? t("1 page") : t("{n} pages", { n: count })} · {purpose === "home" ? sheets.map((s) => SHEETS[s].label).join(" + ") || "—" : printLabel} · {dpi} DPI
              </p>
              {purpose === "kdp" && (
                <p className="text-helper text-ink-secondary">
                  {kdpNote}{" "}
                  <button type="button" onClick={onOpenProfit} className="font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {t("Price and royalty…")}
                  </button>
                </p>
              )}
            </Card>
          </>
        )}

        {error && <p className="text-helper text-error">{error}</p>}
        {purpose === "kdp" && blocking > 0 && <p className="text-helper text-error">{blocking === 1 ? t("Fix the blocking issue to enable export.") : t("Fix the {n} blocking issues to enable export.", { n: blocking })}</p>}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={!canExport} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
