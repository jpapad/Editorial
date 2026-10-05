"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { pageFromImage } from "@/utils/imagePages";
import type { BookPage, PageSpace } from "@/types/editor";

const MAX_IMAGES = 60;
const MAX_PX = 2200;

/** Reads one picture, shrunk to a print-worthy size (a book of full camera photos would not save). */
async function readImage(file: File): Promise<{ src: string; width: number; height: number }> {
  if (file.type === "image/svg+xml") {
    const src = `data:image/svg+xml;utf8,${encodeURIComponent(await file.text())}`;
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("unreadable"));
      img.src = src;
    });
    return { src, width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 };
  }
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { src: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

/** Many pictures in, one page each out — in file-name order. */
export default function ImportImagesDialog({ space, onAdd, onClose }: { space: PageSpace; onAdd: (pages: BookPage[]) => void; onClose: () => void }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [lineArt, setLineArt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function take(list: FileList | null) {
    if (!list) return;
    const images = [...list].filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...images].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).slice(0, MAX_IMAGES));
  }

  async function build() {
    setBusy(true);
    setError(null);
    const pages: BookPage[] = [];
    let failed = 0;
    for (const file of files) {
      try {
        const { src, width, height } = await readImage(file);
        const page = pageFromImage(src, { width, height }, space);
        if (lineArt) page.objects = page.objects.map((o) => (o.kind === "stamp" ? { ...o, filter: "lineArt", threshold: 0.5 } : o));
        pages.push(page);
      } catch {
        failed++;
      }
    }
    setBusy(false);
    if (pages.length === 0) {
      setError(t("None of these files could be read as pictures."));
      return;
    }
    onAdd(pages);
    if (failed === 0) onClose();
    else {
      setFiles([]);
      setError(failed === 1 ? t("1 file could not be read and was skipped.") : t("{n} files could not be read and were skipped.", { n: failed }));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="imp-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
        className="flex w-[520px] max-w-full flex-col gap-4 rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="imp-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Pictures as pages")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} disabled={busy} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" aria-label={t("Pictures to import")} onChange={(e) => { take(e.target.files); e.target.value = ""; }} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
          className={cn("flex flex-col items-center gap-2 rounded-row border border-dashed px-4 py-8 text-body outline-none focus-visible:ring-2 focus-visible:ring-accent", over ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}
        >
          <ImagePlus size={24} />
          {files.length === 0 ? t("Drop pictures here, or click to choose") : files.length === 1 ? t("1 picture chosen — add more or continue") : t("{n} pictures chosen — add more or continue", { n: files.length })}
        </button>
        <Toggle checked={lineArt} onChange={setLineArt} label={t("Turn them into black-and-white line art")} />
        <p className="text-helper text-ink-muted">{t("Each picture becomes one page, filling the safe area, in file-name order (up to {max}).", { max: MAX_IMAGES })}</p>
        {error && <p className="text-helper text-error">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={() => void build()} disabled={files.length === 0 || busy} icon={busy ? <Loader2 size={14} className="animate-spin" /> : undefined}>
            {files.length === 1 ? t("Add 1 page") : t("Add {n} pages", { n: files.length })}
          </Button>
        </div>
      </div>
    </div>
  );
}
