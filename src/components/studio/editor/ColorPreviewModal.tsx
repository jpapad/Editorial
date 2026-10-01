"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Shuffle, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { useT } from "@/lib/i18n";
import { colorableRegions, colorPreview, findRegions } from "@/components/studio/editor/regions";
import type { PixelBuffer } from "@/components/studio/editor/rasterFloodFill";

/**
 * The page as it might look once a child has coloured it: every closed
 * area filled with a crayon colour. A look only — nothing on the page
 * changes. Handy for checking a design reads well, and for listing images.
 */
export default function ColorPreviewModal({ ink, fileName, onClose }: { ink: PixelBuffer; fileName: string; onClose: () => void }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [seed, setSeed] = useState(1);
  const map = useMemo(() => findRegions(ink), [ink]);
  const areas = useMemo(() => colorableRegions(map).length, [map]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const out = colorPreview(ink, seed, undefined, map);
    canvas.width = out.width;
    canvas.height = out.height;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
  }, [ink, map, seed]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${fileName}-colored.png`;
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-full max-w-full flex-col gap-3 rounded-panel bg-panel p-5 shadow-panel"
      >
        <div className="flex items-center justify-between gap-6">
          <p id="cp-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Colored preview")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>
        <canvas ref={canvasRef} aria-label={t("The page colored in")} className="min-h-0 max-w-full self-center rounded-paper-sm bg-white shadow-paper" style={{ maxHeight: "68vh" }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MetaLabel>{areas === 0 ? t("No closed areas to color") : t("{n} areas to color", { n: areas })}</MetaLabel>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Shuffle size={13} />} onClick={() => setSeed((s) => s + 1)} disabled={areas === 0}>
              {t("Other colors")}
            </Button>
            <Button variant="primary" size="sm" icon={<Download size={13} />} onClick={download}>
              {t("Download PNG")}
            </Button>
          </div>
        </div>
        <p className="text-helper text-ink-muted">{t("Only a look — your page is not changed. Areas that stay white are not closed (run the gap check).")}</p>
      </div>
    </div>
  );
}
