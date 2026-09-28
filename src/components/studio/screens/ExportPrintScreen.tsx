"use client";

import { useState } from "react";
import Button from "@/components/studio/ui/Button";
import Toggle from "@/components/studio/ui/Toggle";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import StatusDot from "@/components/studio/ui/StatusDot";
import { PLACEHOLDER_ART_PATTERN } from "@/components/studio/ui/Thumbnail";
import { cn } from "@/utils/cn";

type ExportFormat = "print-pdf" | "digital-pdf" | "png-zip";

const FORMATS: { id: ExportFormat; title: string; meta: string }[] = [
  { id: "print-pdf", title: "Print PDF", meta: "CMYK · 300 DPI" },
  { id: "digital-pdf", title: "Digital PDF", meta: "RGB · SCREEN" },
  { id: "png-zip", title: "PNG per page", meta: "ZIP" },
];

interface PreflightRow {
  tone: "success" | "error";
  label: string;
}

/**
 * 1i: export & print, restyled to the light shell. Preflight list
 * relabels "Fonts outlined" to "Fonts embedded" — the confirmed answer to
 * that flagged question: this repo's real pdfExporter.ts deliberately
 * embeds fonts rather than converting text to outlines (correct for
 * KDP), so a check literally named "outlined" would be asserting
 * something that isn't true of the actual export pipeline.
 */
export default function ExportPrintScreen() {
  const [format, setFormat] = useState<ExportFormat>("print-pdf");
  const [cropMarks, setCropMarks] = useState(true);
  const [singleSided, setSingleSided] = useState(true);
  const [flatten, setFlatten] = useState(false);

  const preflightRows: PreflightRow[] = [
    { tone: "success", label: "All art vector" },
    { tone: "success", label: "Fonts embedded" },
    { tone: "error", label: "Page 12 art enters the bleed" },
  ];

  return (
    <div className="flex gap-0 rounded-panel bg-panel shadow-panel" style={{ width: 620 }}>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">Export</p>

        <div className="flex flex-col gap-2.5">
          <MetaLabel>Format</MetaLabel>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "flex items-center justify-between rounded-row-sm border px-3.5 py-2.5 text-left outline-none transition-colors duration-150 motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                format === f.id ? "border-accent bg-accent-tint" : "border-hairline hover:bg-inset-alt"
              )}
            >
              <span className="flex items-center gap-2.5">
                <span className={cn("h-3.5 w-3.5 shrink-0 rounded-pill border-2", format === f.id ? "border-accent" : "border-hairline")}>
                  {format === f.id && <span className="block h-full w-full scale-50 rounded-pill bg-accent" />}
                </span>
                <span className="text-body font-medium text-ink">{f.title}</span>
              </span>
              <MetaLabel>{f.meta}</MetaLabel>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <MetaLabel>Trim</MetaLabel>
            <div className="mt-1 rounded-row-sm bg-inset-alt px-3 py-2 text-body text-ink">8.5 x 11 in</div>
          </div>
          <div>
            <MetaLabel>Bleed</MetaLabel>
            <div className="mt-1 rounded-row-sm bg-inset-alt px-3 py-2 text-body text-ink">0.125 in</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Toggle checked={cropMarks} onChange={setCropMarks} label="Crop marks" />
          <Toggle checked={singleSided} onChange={setSingleSided} label="Single-sided (no bleed-through)" />
          <Toggle checked={flatten} onChange={setFlatten} label="Flatten colored layers" />
        </div>

        <Button variant="primary" className="w-full">
          Export 24 pages
        </Button>
      </div>

      <div className="flex w-[220px] shrink-0 flex-col gap-3 border-l border-hairline p-5">
        <MetaLabel>Preflight</MetaLabel>
        <div className="rounded-paper-sm border border-dashed border-accent/50 p-2">
          <div className="aspect-[3/4] rounded-[2px]" style={{ backgroundImage: PLACEHOLDER_ART_PATTERN }} />
        </div>
        <div className="flex flex-col gap-1.5">
          {preflightRows.map((row) => (
            <div key={row.label} className="flex items-center gap-1.5">
              <StatusDot tone={row.tone} />
              <span className="text-helper text-ink-secondary">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
