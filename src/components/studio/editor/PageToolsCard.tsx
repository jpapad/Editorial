"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Slider from "@/components/studio/ui/Slider";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import type { PageNumberMode } from "@/utils/pageNumbers";
import type { TraceImage } from "@/types/editor";

const MAX_TRACE_PX = 1600;

/** Reads a picture and shrinks it — the reference is only looked at, and it's saved inside the page. */
async function readTraceImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_TRACE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export interface PageToolsCardProps {
  pageNumbers: PageNumberMode;
  onPageNumbersChange: (mode: PageNumberMode) => void;
  trace: TraceImage | undefined;
  onTraceChange: (trace: TraceImage | undefined) => void;
}

/** Page numbers for the whole book, and this page's tracing reference. */
export default function PageToolsCard({ pageNumbers, onPageNumbersChange, trace, onTraceChange }: PageToolsCardProps) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modes: [PageNumberMode, string][] = [
    ["off", t("Off")],
    ["center", t("Centre")],
    ["outer", t("Outer corner")],
  ];

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      onTraceChange({ src: await readTraceImage(file), opacity: trace?.opacity ?? 0.35 });
    } catch {
      setError(t("Could not read this image."));
    }
  }

  return (
    <Card className="flex shrink-0 flex-col gap-3 p-4">
      <div className="flex flex-col gap-1.5">
        <MetaLabel>{t("Page numbers")}</MetaLabel>
        <div role="radiogroup" aria-label={t("Page numbers")} className="flex gap-1">
          {modes.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={pageNumbers === value}
              onClick={() => onPageNumbersChange(value)}
              className={cn(
                "flex-1 rounded-pill border px-2 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent",
                pageNumbers === value ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-helper text-ink-muted">{t("On every page of the book; they follow when pages move.")}</p>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-hairline pt-3">
        <MetaLabel>{t("Tracing reference")}</MetaLabel>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label={t("Tracing reference image")} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        {trace ? (
          <>
            <Slider label={t("Visibility")} valueLabel={`${Math.round(trace.opacity * 100)}%`} min={10} max={80} step={5} value={Math.round(trace.opacity * 100)} onChange={(v) => onTraceChange({ ...trace, opacity: v / 100 })} />
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" icon={<ImageUp size={13} />} onClick={() => fileRef.current?.click()}>
                {t("Replace")}
              </Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => onTraceChange(undefined)}>
                {t("Remove reference")}
              </Button>
            </div>
          </>
        ) : (
          <Button variant="secondary" size="sm" icon={<ImageUp size={13} />} onClick={() => fileRef.current?.click()}>
            {t("Add a photo to trace")}
          </Button>
        )}
        <p className="text-helper text-ink-muted">{t("A faded picture behind this page to draw over. It is never printed or exported.")}</p>
        {error && <p className="text-helper text-error">{error}</p>}
      </div>
    </Card>
  );
}
