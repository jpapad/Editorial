"use client";

import { useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { SHEETS, type SheetId } from "@/utils/printables";

export interface PrintAtHomeRequest {
  sheets: SheetId[];
  /** "sample" = the current page and the next few; "book" = every page. */
  scope: "sample" | "book";
  /** PNG data URL per sheet size for the "how to print" first page, when wanted. */
  instructions: Partial<Record<SheetId, string>>;
}

/** The "how to print" page, drawn as a picture so it goes through the same image-based PDF export as the pages. */
function instructionImage(sheet: SheetId, title: string, heading: string, lines: string[], footer: string): string {
  const { width, height } = SHEETS[sheet];
  const k = 2.5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * k);
  canvas.height = Math.round(height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(k, k);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#14151a";
  ctx.textAlign = "center";
  ctx.font = "700 30px Arial, Helvetica, sans-serif";
  ctx.fillText(title, width / 2, 120, width - 110);
  ctx.font = "600 17px Arial, Helvetica, sans-serif";
  ctx.fillText(heading, width / 2, 176, width - 110);
  ctx.textAlign = "left";
  ctx.font = "14px Arial, Helvetica, sans-serif";
  let y = 232;
  lines.forEach((line, i) => {
    // Wrap by words to the text column.
    const words = `${i + 1}.  ${line}`.split(" ");
    let row = "";
    for (const word of words) {
      if (ctx.measureText(`${row} ${word}`).width > width - 150 && row) {
        ctx.fillText(row, 75, y);
        y += 21;
        row = `     ${word}`;
      } else row = row ? `${row} ${word}` : word;
    }
    ctx.fillText(row, 75, y);
    y += 34;
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px Arial, Helvetica, sans-serif";
  ctx.fillText(footer, width / 2, height - 70, width - 110);
  return canvas.toDataURL("image/png");
}

/**
 * PDFs for a home printer: a quick test print of a few pages before
 * ordering a proof, or the whole book on A4 and US Letter to sell as a
 * digital download.
 */
export default function PrintAtHomeDialog({ title, pageCount, onExport, onClose }: { title: string; pageCount: number; onExport: (request: PrintAtHomeRequest) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [scope, setScope] = useState<"sample" | "book">("sample");
  const [sheets, setSheets] = useState<SheetId[]>(["a4"]);
  const [withInstructions, setWithInstructions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: SheetId) => setSheets((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const includeInstructions = scope === "book" && withInstructions;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const instructions: PrintAtHomeRequest["instructions"] = {};
      if (includeInstructions) {
        for (const sheet of sheets) {
          instructions[sheet] = instructionImage(
            sheet,
            title,
            t("How to print your coloring pages"),
            [
              t("Print on {size} paper, single-sided, so colors don't show through.", { size: SHEETS[sheet].label }),
              t("In the print window choose “Actual size” or 100% — not “Fit to page”."),
              t("Thicker paper (120 g or more) works best with markers."),
              t("Print any page again as often as you like."),
            ],
            t("For personal use only. Please don't share or resell the file.")
          );
        }
      }
      await onExport({ sheets, scope, instructions });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not export this book to PDF."));
      setBusy(false);
    }
  }

  const chip = (on: boolean) => cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", on ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pah-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
        className="flex w-[480px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="pah-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <Printer size={19} aria-hidden />
            {t("Print at home")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("What to print")}</MetaLabel>
          <div role="radiogroup" aria-label={t("What to print")} className="flex gap-1.5">
            <button type="button" role="radio" aria-checked={scope === "sample"} onClick={() => setScope("sample")} className={chip(scope === "sample")}>
              {t("Test print (4 pages)")}
            </button>
            <button type="button" role="radio" aria-checked={scope === "book"} onClick={() => setScope("book")} className={chip(scope === "book")}>
              {t("Whole book ({n} pages)", { n: pageCount })}
            </button>
          </div>
          <p className="text-helper text-ink-muted">
            {scope === "sample" ? t("The page you're on and the next three — enough to check line thickness and margins on real paper.") : t("A printable file for each paper size, ready to sell as a digital download (Etsy and similar).")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("Paper")}</MetaLabel>
          <div className="flex gap-1.5">
            {(Object.keys(SHEETS) as SheetId[]).map((id) => (
              <button key={id} type="button" aria-pressed={sheets.includes(id)} onClick={() => toggle(id)} className={chip(sheets.includes(id))}>
                {SHEETS[id].label}
              </button>
            ))}
          </div>
        </div>

        {scope === "book" && <Toggle checked={withInstructions} onChange={setWithInstructions} label={t("Start with a “how to print” page")} />}
        {error && <p className="text-helper text-error">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy || sheets.length === 0} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}>
            {sheets.length > 1 ? t("Download {n} PDFs", { n: sheets.length }) : t("Download PDF")}
          </Button>
        </div>
      </div>
    </div>
  );
}
