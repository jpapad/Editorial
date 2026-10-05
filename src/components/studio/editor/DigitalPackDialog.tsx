"use client";

import { useState } from "react";
import { Loader2, PackageOpen, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { SHEETS, type SheetId } from "@/utils/printables";
import { LICENSES, type LicenseKind, type PackOptions } from "@/utils/digitalPack";

/**
 * One ZIP with everything a printable listing needs (Etsy and similar):
 * a PNG per page, a PDF per paper size, LICENSE.txt and READ-ME.txt.
 * `onExport` does the rendering (it needs the canvas); this only asks.
 */
export default function DigitalPackDialog({ pageCount, onExport, onClose }: { pageCount: number; onExport: (options: PackOptions, progress: (text: string) => void) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [pngs, setPngs] = useState(true);
  const [sheets, setSheets] = useState<SheetId[]>(["a4", "letter"]);
  const [license, setLicense] = useState<LicenseKind>("personal");
  const [seller, setSeller] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  const toggleSheet = (id: SheetId) => setSheets((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const chip = (on: boolean) => cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", on ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt");

  async function run() {
    setError(null);
    setProgress(t("Drawing the pages…"));
    try {
      await onExport({ pngs, sheets, license, seller }, setProgress);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not make the download pack."));
      setProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
        className="flex w-[500px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="pack-title" className="flex items-center gap-2 text-modal-title font-semibold tracking-[-0.02em] text-ink">
            <PackageOpen size={19} aria-hidden />
            {t("Digital download pack")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <p className="text-helper text-ink-muted">{t("One ZIP to upload to Etsy, Gumroad or your own shop: all {n} pages, ready to print at home.", { n: pageCount })}</p>

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("Printable PDFs")}</MetaLabel>
          <div className="flex gap-1.5">
            {(Object.keys(SHEETS) as SheetId[]).map((id) => (
              <button key={id} type="button" aria-pressed={sheets.includes(id)} onClick={() => toggleSheet(id)} className={chip(sheets.includes(id))}>
                {SHEETS[id].label}
              </button>
            ))}
          </div>
        </div>

        <Toggle checked={pngs} onChange={setPngs} label={t("Every page as a PNG picture (300 DPI)")} />

        <div className="flex flex-col gap-1.5">
          <MetaLabel>{t("License for buyers")}</MetaLabel>
          <div role="radiogroup" aria-label={t("License for buyers")} className="flex flex-wrap gap-1.5">
            {LICENSES.map((l) => (
              <button key={l.value} type="button" role="radio" aria-checked={license === l.value} onClick={() => setLicense(l.value)} className={chip(license === l.value)}>
                {t(l.label)}
              </button>
            ))}
          </div>
          <p className="text-helper text-ink-muted">{t(LICENSES.find((l) => l.value === license)!.hint)}</p>
          <input
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            maxLength={60}
            placeholder={t("Shop or author name (for the license)")}
            aria-label={t("Shop or author name (for the license)")}
            className="h-8 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {progress && (
          <p role="status" className="flex items-center gap-1.5 text-helper text-ink-secondary">
            <Loader2 size={12} className="animate-spin" /> {progress}
          </p>
        )}
        {error && <p className="text-helper text-error">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy || (!pngs && sheets.length === 0)} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}>
            {t("Download ZIP")}
          </Button>
        </div>
      </div>
    </div>
  );
}
