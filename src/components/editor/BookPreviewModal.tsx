"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";

interface BookPreviewModalProps {
  images: string[];
  onClose: () => void;
}

type View = "single" | "spread";

/**
 * Printed-book reading order: page 1 is a right-hand page on its own
 * (the inside of the cover faces it), then pages pair up left/right —
 * [·,1] [2,3] [4,5] … A trailing even page sits alone on the left.
 */
function toSpreads(count: number): [number | null, number | null][] {
  const spreads: [number | null, number | null][] = [];
  if (count === 0) return spreads;
  spreads.push([null, 0]);
  for (let left = 1; left < count; left += 2) spreads.push([left, left + 1 < count ? left + 1 : null]);
  return spreads;
}

export default function BookPreviewModal({ images, onClose }: BookPreviewModalProps) {
  const t = useT();
  const [view, setView] = useState<View>("spread");
  const [page, setPage] = useState(0); // the page in view (single) or on either side of the current spread

  const spreads = toSpreads(images.length);
  const spreadIndex = spreads.findIndex(([l, r]) => l === page || r === page);
  const steps = view === "single" ? images.length : spreads.length;
  const position = view === "single" ? page : Math.max(0, spreadIndex);

  function goTo(step: number) {
    const clamped = Math.max(0, Math.min(steps - 1, step));
    if (view === "single") setPage(clamped);
    else setPage(spreads[clamped][0] ?? spreads[clamped][1] ?? 0);
  }

  // Latest navigation for the window key listener, registered once.
  const navigate = useRef<(delta: number) => void>(() => {});
  useEffect(() => {
    navigate.current = (delta: number) => goTo(position + delta);
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") navigate.current(-1);
      if (e.key === "ArrowRight") navigate.current(1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (images.length === 0) return null;

  const visible = view === "single" ? [page] : spreads[position].filter((i): i is number => i !== null);
  const label = visible.length > 1 ? t("Pages {a}–{b} of {n}", { a: visible[0] + 1, b: visible[1] + 1, n: images.length }) : t("Page {a} of {n}", { a: visible[0] + 1, n: images.length });

  const pageImage = (i: number | null, side: "left" | "right" | "single") =>
    i === null ? (
      <div className="aspect-[595/842] h-full max-h-[72vh] bg-transparent" aria-hidden />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- pre-rendered Konva stage snapshots, not a static asset
      <img
        src={images[i]}
        alt={t("Book page {n}", { n: i + 1 })}
        className={`max-h-[72vh] bg-white ${side === "single" ? "rounded-lg shadow-2xl" : side === "left" ? "rounded-l-md shadow-[-12px_12px_40px_rgba(0,0,0,0.35)]" : "rounded-r-md shadow-[12px_12px_40px_rgba(0,0,0,0.35)]"}`}
        style={{ maxWidth: side === "single" ? undefined : "36vw" }}
      />
    );

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900/80 p-6" onClick={onClose}>
      <div className="flex w-full max-w-5xl items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-medium">{label}</h2>
        <div className="flex items-center gap-3">
          <div role="tablist" aria-label={t("Preview layout")} className="flex rounded-full bg-white/10 p-0.5 text-xs">
            {(["single", "spread"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 ${view === v ? "bg-white text-slate-900" : "text-white/80 hover:text-white"}`}
              >
                {v === "single" ? t("Single page") : t("Open book")}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label={t("Close preview")} className="rounded-full p-2 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-6xl flex-1 items-center justify-center gap-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goTo(position - 1);
          }}
          disabled={position === 0}
          aria-label={t("Previous")}
          className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {view === "single" ? (
            pageImage(page, "single")
          ) : (
            <div className="relative flex items-stretch">
              {pageImage(spreads[position][0], "left")}
              {/* the gutter: a soft fold shadow where the pages meet */}
              {spreads[position][0] !== null && spreads[position][1] !== null && (
                <span className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/15 to-transparent" aria-hidden />
              )}
              {pageImage(spreads[position][1], "right")}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goTo(position + 1);
          }}
          disabled={position >= steps - 1}
          aria-label={t("Next")}
          className="rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {Array.from({ length: steps }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={view === "single" ? t("Go to page {n}", { n: i + 1 }) : t("Go to spread {n}", { n: i + 1 })}
            className={`h-2 w-2 rounded-full ${i === position ? "bg-white" : "bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}
