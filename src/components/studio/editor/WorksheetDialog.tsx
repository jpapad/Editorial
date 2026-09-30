"use client";

import { useState } from "react";
import { Hash, Route, Search, Spline, Type, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Slider from "@/components/studio/ui/Slider";
import { cn } from "@/utils/cn";
import {
  connectDotsPage,
  DOTS_DESIGNS,
  letterTracingPage,
  MAZE_LEVELS,
  mazePage,
  numberTracingPage,
  spotTheDifference,
  type DotsDesign,
  type MazeLevel,
} from "@/components/editor/worksheets";
import type { BookPage, PageSpace } from "@/types/editor";
import { useT } from "@/lib/i18n";

type Kind = "letters" | "numbers" | "dots" | "maze" | "spot";

const KINDS: { value: Kind; label: string; hint: string; Icon: typeof Type }[] = [
  { value: "letters", label: "Letter tracing", hint: "One page per letter", Icon: Type },
  { value: "numbers", label: "Number tracing", hint: "With circles to count and color", Icon: Hash },
  { value: "dots", label: "Connect the dots", hint: "Numbered dots that reveal a picture", Icon: Spline },
  { value: "maze", label: "Maze", hint: "Always solvable, 3 levels", Icon: Route },
  { value: "spot", label: "Spot the difference", hint: "From the current page, with answers", Icon: Search },
];

const PRESETS = [
  { label: "A–Z", value: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  { label: "Α–Ω", value: "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ" },
];

export interface WorksheetDialogProps {
  space: PageSpace;
  currentPage: BookPage;
  onAdd: (pages: BookPage[]) => void;
  onClose: () => void;
}

const MAX_PAGES = 40;

/** Builds worksheet pages (see worksheets.ts) and hands them to the editor to append. */
export default function WorksheetDialog({ space, currentPage, onAdd, onClose }: WorksheetDialogProps) {
  const t = useT();
  const [kind, setKind] = useState<Kind>("letters");
  const [letters, setLetters] = useState("ABC");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(5);
  const [design, setDesign] = useState<DotsDesign>("star");
  const [dotCount, setDotCount] = useState(25);
  const [level, setLevel] = useState<MazeLevel>("easy");
  const [mazeCount, setMazeCount] = useState(3);
  const [differences, setDifferences] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const letterList = [...new Set([...letters.replace(/\s+/g, "")].map((c) => c.toLocaleUpperCase()))].slice(0, MAX_PAGES);
  const numberCount = Math.max(0, Math.min(MAX_PAGES, to - from + 1));
  const pageCount = kind === "letters" ? letterList.length : kind === "numbers" ? numberCount : kind === "dots" ? 1 : kind === "maze" ? mazeCount : 2;

  function build() {
    setError(null);
    const seed = Math.floor(Math.random() * 1e9);
    let pages: BookPage[] = [];
    if (kind === "letters") pages = letterList.map((l) => letterTracingPage(space, l));
    else if (kind === "numbers") pages = Array.from({ length: numberCount }, (_, i) => numberTracingPage(space, from + i));
    else if (kind === "dots") pages = [connectDotsPage(space, design, dotCount, t)];
    else if (kind === "maze") pages = Array.from({ length: mazeCount }, (_, i) => mazePage(space, level, seed + i, t));
    else {
      const result = spotTheDifference(currentPage, space, differences, seed, t);
      if (!result) {
        setError(t("The current page needs at least 2 objects or pen strokes to make differences from. Draw or place something first."));
        return;
      }
      pages = [result.puzzle, result.answers];
    }
    if (pages.length === 0) return;
    onAdd(pages);
    onClose();
  }

  const input = "h-9 rounded-row-sm border border-hairline bg-panel px-2.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-full w-[640px] max-w-full flex-col gap-4 overflow-auto rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-center justify-between">
          <p id="ws-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
            {t("Worksheets")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>

        <div role="radiogroup" aria-label={t("Worksheet type")} className="grid grid-cols-5 gap-2">
          {KINDS.map(({ value, label, hint, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              title={t(hint)}
              onClick={() => setKind(value)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-row border p-2.5 text-center text-helper font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent",
                kind === value ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
              )}
            >
              <Icon size={20} />
              {t(label)}
            </button>
          ))}
        </div>
        <p className="text-helper text-ink-muted">{t(KINDS.find((k) => k.value === kind)?.hint ?? "")}</p>

        {kind === "letters" && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <MetaLabel>{t("Letters")}</MetaLabel>
              <input value={letters} onChange={(e) => setLetters(e.target.value)} className={input} placeholder={t("e.g. ABC or Α Β Γ")} />
            </label>
            <div className="flex gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setLetters(p.value)} className="rounded-pill border border-hairline px-3 py-1 text-helper text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "numbers" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <MetaLabel>{t("From")}</MetaLabel>
              <input type="number" min={0} max={99} value={from} onChange={(e) => setFrom(Math.max(0, Number(e.target.value) || 0))} className={input} />
            </label>
            <label className="flex flex-col gap-1">
              <MetaLabel>{t("To")}</MetaLabel>
              <input type="number" min={0} max={99} value={to} onChange={(e) => setTo(Math.max(0, Number(e.target.value) || 0))} className={input} />
            </label>
          </div>
        )}

        {kind === "dots" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {DOTS_DESIGNS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={design === d.value}
                  onClick={() => setDesign(d.value)}
                  className={cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", design === d.value ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}
                >
                  {t(d.label)}
                </button>
              ))}
            </div>
            <Slider label={t("Number of dots")} valueLabel={String(dotCount)} min={10} max={60} step={1} value={dotCount} onChange={setDotCount} />
          </div>
        )}

        {kind === "maze" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              {MAZE_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={level === l.value}
                  onClick={() => setLevel(l.value)}
                  className={cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", level === l.value ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}
                >
                  {t(l.label)}
                </button>
              ))}
            </div>
            <Slider label={t("Mazes")} valueLabel={String(mazeCount)} min={1} max={10} step={1} value={mazeCount} onChange={setMazeCount} />
          </div>
        )}

        {kind === "spot" && (
          <div className="flex flex-col gap-2">
            <p className="text-body text-ink-secondary">
              {t("Uses the page you're on ({objects} objects, {strokes} strokes). Adds a puzzle page and an answer page.", { objects: currentPage.objects.length, strokes: currentPage.lines.filter((l) => l.tool === "pen").length })}
            </p>
            <Slider label={t("Differences")} valueLabel={String(differences)} min={3} max={10} step={1} value={differences} onChange={setDifferences} />
          </div>
        )}

        {error && <p className="text-helper text-error">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={build} disabled={pageCount === 0}>
            {pageCount === 1 ? t("Add 1 page") : t("Add {n} pages", { n: pageCount })}
          </Button>
        </div>
      </div>
    </div>
  );
}
