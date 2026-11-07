"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ScrollText, Sparkles, Trash2, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { aiErrorText, useLanguage, useT, type TFunction } from "@/lib/i18n";
import { useAiUsage } from "@/lib/aiUsage";
import { generateLineArtPicture } from "@/lib/lineArt";
import { layoutPageSpec, picturesToMake, type PictureMap } from "@/utils/pageLayout";
import { PAGE_MODES, type PageBlock, type PageMode, type PageSpec } from "@/services/pageSpec";
import { getBackgroundPattern } from "@/components/editor/backgroundPatterns";

const MODE_LABEL: Record<PageMode, { label: string; hint: string }> = {
  lineart: { label: "For coloring", hint: "Black outlines on white, for the child to color." },
  mixed: { label: "Mixed", hint: "Colored titles, boxes and lines; the pictures stay outlines to color." },
  color: { label: "In color", hint: "A finished color page, pictures included — not for coloring. Prints with color ink." },
};

/** A small color sample, for the checklist. */
function Swatch({ color, label }: { color: string; label: string }) {
  return <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-[4px] border border-hairline align-[-2px]" style={{ background: color }} title={label} aria-label={label} role="img" />;
}
import type { BookPage, PageSpace } from "@/types/editor";

/** One line of "what I understood", in the UI language. */
export function describeBlock(block: PageBlock, t: TFunction): string {
  const list = (items: string[]) => items.map((s) => `«${s}»`).join(", ");
  switch (block.type) {
    case "title":
      return t("Title: «{text}»", { text: block.text });
    case "text":
      return block.style === "dashed" ? t("Dotted text to trace: «{text}»", { text: block.text }) : block.style === "outline" ? t("Hollow letters to color: «{text}»", { text: block.text }) : t("Text: «{text}»", { text: block.text });
    case "pictures": {
      const extras = [block.boxed && t("each in a frame"), block.writeLine && t("a line to write under each"), block.marker === "circle" && t("a circle to mark each"), block.marker === "checkbox" && t("a box to tick each")].filter(Boolean).join(", ");
      const what = list(block.items.map((i) => i.label || i.caption || i.subject));
      return `${t("{n} pictures in {cols} columns: {list}", { n: block.items.length, cols: block.columns, list: what })}${extras ? ` — ${extras}` : ""}`;
    }
    case "lines":
      return block.handwriting ? t("{n} handwriting lines", { n: block.count }) : t("{n} lines to write on", { n: block.count });
    case "table":
      return `${t("Table: {rows} rows × {cols} columns", { rows: block.rows, cols: block.columns })}${block.header.some(Boolean) ? ` — ${list(block.header.filter(Boolean))}` : ""}`;
    case "choices":
      return `${block.question ? `«${block.question}» — ` : ""}${block.marker === "checkbox" ? t("answers to tick: {list}", { list: list(block.options) }) : t("answers to circle: {list}", { list: list(block.options) })}`;
    case "numbered":
      return `${t("Numbered list: {list}", { list: list(block.items) })}${block.writeLine ? ` — ${t("a line to write after each")}` : ""}`;
    case "bubble":
      return t("Speech bubble: «{text}»", { text: block.text });
    case "space":
      return block.label ? t("Empty space to draw in, labelled «{text}»", { text: block.label }) : t("Empty space to draw in");
    case "activity":
      return block.kind === "wordsearch" ? t("Word search on its own page: {list}", { list: list(block.words) }) : t("Maze on its own page");
  }
}

/** The block's own words, if it has a single text the user may want to correct. */
function editableText(block: PageBlock): string | null {
  return block.type === "title" || block.type === "text" || block.type === "bubble" ? block.text : null;
}

/**
 * "Page from instructions": the user writes what the page should hold;
 * AI reads it into a list (texts word for word, counts exact); the user
 * checks and corrects the list; then the page is laid out by fixed rules
 * and its pictures are drawn. Nothing on the page that wasn't asked for.
 */
export interface InstructionsResult {
  pages: BookPage[];
  /** Copy the new page's background to every page of the book. */
  backgroundToAll: boolean;
}

export default function InstructionsPageDialog({ space, onAdd, onTurnOnBleed, onClose }: { space: PageSpace; onAdd: (result: InstructionsResult) => void; onTurnOnBleed?: () => void; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const { usage, refresh } = useAiUsage();
  const [instructions, setInstructions] = useState("");
  const [mode, setMode] = useState<PageMode>("lineart");
  const [backgroundToAll, setBackgroundToAll] = useState(false);
  const [step, setStep] = useState<"write" | "reading" | "review" | "making">("write");
  const [spec, setSpec] = useState<PageSpec | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    setError(null);
    setStep("reading");
    try {
      const response = await fetch("/api/page-from-instructions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructions: instructions.trim(), lang, mode }) });
      const body = (await response.json().catch(() => null)) as { spec?: PageSpec; error?: string } | null;
      if (!response.ok || !body?.spec) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Could not read the instructions")));
      // An answer without the newer fields (an older server) still works: the kind asked for, no background.
      setSpec({ ...body.spec, mode: body.spec.mode ?? mode, background: body.spec.background ?? null, gradient: body.spec.gradient ?? null, pattern: body.spec.pattern ?? null, scene: body.spec.scene ?? null });
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not read the instructions"));
      setStep("write");
    }
  }

  const updateBlock = (i: number, block: PageBlock | null) => setSpec((s) => s && { ...s, blocks: block ? s.blocks.map((b, j) => (j === i ? block : b)) : s.blocks.filter((_, j) => j !== i) });
  const toMake = spec ? picturesToMake(spec) : [];
  const hasBackground = Boolean(spec && (spec.background || spec.gradient || spec.pattern || spec.scene));
  const credits = toMake.length + (spec?.scene ? 1 : 0);
  const creditsLeft = usage && usage.limit !== null ? Math.max(0, usage.limit - usage.used) + (usage.extra ?? 0) : null;

  async function make() {
    if (!spec) return;
    setStep("making");
    setError(null);
    const pictures: PictureMap = new Map();
    let failed = 0;
    for (const [n, item] of toMake.entries()) {
      setProgress(t("Drawing picture {n} of {total}…", { n: n + 1, total: toMake.length }));
      try {
        const { src, size } = await generateLineArtPicture(item.subject, spec.mode === "color" ? "friendly children's illustration, the subject only" : "simple coloring page line art, the subject only", t, { aspectRatio: "square", color: spec.mode === "color" });
        pictures.set(item.key, { src, ...size });
      } catch (err) {
        failed++;
        if (failed === 1) setError(err instanceof Error ? err.message : t("Generation failed"));
      }
      refresh();
    }
    let scene: { src: string; width: number; height: number } | undefined;
    if (spec.scene) {
      setProgress(t("Drawing the background…"));
      try {
        // A whole-page scene, quiet in the middle where the page's content goes.
        const theme = spec.mode === "color" ? "soft pastel full-page background scenery, edge to edge, calm and light, nothing important in the middle, no characters, no text" : "full-page background scenery drawn as clean line art, edge to edge, simple, nothing important in the middle, no characters, no text";
        const made = await generateLineArtPicture(spec.scene.subject, theme, t, { aspectRatio: "portrait", color: spec.mode === "color" });
        scene = { src: made.src, ...made.size };
      } catch (err) {
        failed++;
        if (failed === 1) setError(err instanceof Error ? err.message : t("Generation failed"));
      }
      refresh();
    }
    const { page, extraPages, continued } = layoutPageSpec(spec, space, pictures, Date.now(), scene);
    onAdd({ pages: [page, ...extraPages], backgroundToAll: backgroundToAll && hasBackground });
    if (continued || failed) {
      // Stay open long enough to say what didn't go as asked.
      setProgress(null);
      setError([continued && t("It didn't all fit on one page, so it continues on the next — in the same order, nothing left out."), failed && t("{n} pictures couldn't be made; their boxes are on the page with what they should show.", { n: failed })].filter(Boolean).join(" "));
      setStep("review");
      setSpec(null);
      return;
    }
    onClose();
  }

  const busy = step === "reading" || step === "making";
  const input = "rounded-row-sm border border-hairline bg-panel px-3 py-2 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={busy ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="instr-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && !busy && onClose()} className="flex max-h-[90vh] w-[640px] max-w-full flex-col gap-4 overflow-y-auto rounded-[24px] bg-panel p-6 shadow-toolbar">
        <div className="flex items-center justify-between gap-3">
          <p id="instr-title" className="flex items-center gap-2 text-modal-title font-bold tracking-[-0.02em] text-ink">
            <ScrollText size={20} className="text-spark" aria-hidden />
            {t("Page from instructions")}
          </p>
          {!busy && (
            <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
              <X size={17} />
            </button>
          )}
        </div>

        {(step === "write" || step === "reading") && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (instructions.trim() && step === "write") void read();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <MetaLabel>{t("Kind of page")}</MetaLabel>
              <div role="radiogroup" aria-label={t("Kind of page")} className="grid grid-cols-3 gap-1.5">
                {PAGE_MODES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("rounded-row-sm border px-2 py-2 text-body font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent", mode === m ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}>
                    {t(MODE_LABEL[m].label)}
                  </button>
                ))}
              </div>
              <p className="text-helper text-ink-muted">{t(MODE_LABEL[mode].hint)}</p>
            </div>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Describe the page")}</MetaLabel>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={7} maxLength={3000} autoFocus placeholder={t("e.g. Title at the top: “Farm animals”. Below it 4 pictures in 2 rows: cow, sheep, hen, pig, with a line under each to write its name. At the bottom: “Circle the one that gives milk”.")} className={cn(input, "resize-y")} />
            </label>
            <p className="text-helper text-ink-muted">{t("Write it as you'd tell a person: what goes on the page, in what order, how many. Texts in quotes are printed exactly as written. You'll see what was understood before anything is made.")}</p>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!instructions.trim() || step === "reading"} icon={step === "reading" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
                {step === "reading" ? t("Reading…") : t("Read my instructions")}
              </Button>
            </div>
          </form>
        )}

        {step === "review" && !spec && error && (
          <>
            <p role="status" className="flex items-start gap-2 rounded-row-sm bg-warning/15 px-3 py-2 text-body text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("The page was added.")} {error}
            </p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={onClose}>
                {t("OK")}
              </Button>
            </div>
          </>
        )}

        {step === "review" && spec && (
          <>
            <MetaLabel>{t("What I understood — top of the page first")}</MetaLabel>
            <p className="text-helper text-ink-secondary">{t("Kind of page")}: <b>{t(MODE_LABEL[spec.mode].label)}</b></p>
            <ol className="flex flex-col gap-2" aria-label={t("What I understood")}>
              {spec.gradient && (
                <li className="flex items-center gap-2 rounded-row-sm bg-inset-alt px-3 py-2 text-body text-ink">
                  <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
                  <span className="flex flex-1 items-center gap-2">
                    {t("Background gradient")} <Swatch color={spec.gradient[0]} label={spec.gradient[0]} /> → <Swatch color={spec.gradient[1]} label={spec.gradient[1]} />
                  </span>
                  <button type="button" aria-label={t("Remove")} onClick={() => setSpec({ ...spec, gradient: null })} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                    <Trash2 size={13} />
                  </button>
                </li>
              )}
              {spec.pattern && (
                <li className="flex items-center gap-2 rounded-row-sm bg-inset-alt px-3 py-2 text-body text-ink">
                  <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
                  <span className="flex-1">{t("Background pattern: {name}", { name: t(getBackgroundPattern(spec.pattern)?.label ?? spec.pattern) })}</span>
                  <button type="button" aria-label={t("Remove")} onClick={() => setSpec({ ...spec, pattern: null })} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                    <Trash2 size={13} />
                  </button>
                </li>
              )}
              {spec.scene && (
                <li className="flex flex-col gap-1.5 rounded-row-sm bg-inset-alt px-3 py-2">
                  <div className="flex items-center gap-2 text-body text-ink">
                    <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
                    <span className="flex-1">
                      {spec.mode === "lineart" ? t("Background scene to color: «{text}»", { text: spec.scene.label }) : spec.mode === "mixed" ? t("Faded background scene: «{text}»", { text: spec.scene.label }) : t("Color background scene: «{text}»", { text: spec.scene.label })}
                    </span>
                    <button type="button" aria-label={t("Remove")} onClick={() => setSpec({ ...spec, scene: null })} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <input value={spec.scene.subject} onChange={(e) => setSpec({ ...spec, scene: { ...spec.scene!, subject: e.target.value } })} aria-label={t("What the background shows")} className={cn(input, "h-9 py-0 text-helper")} />
                </li>
              )}
              {spec.background && (
                <li className="flex items-center gap-2 rounded-row-sm bg-inset-alt px-3 py-2 text-body text-ink">
                  <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
                  <span className="flex flex-1 items-center gap-2">
                    {t("Page background")} <Swatch color={spec.background} label={spec.background} />
                  </span>
                  <button type="button" aria-label={t("Remove")} onClick={() => setSpec({ ...spec, background: null })} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                    <Trash2 size={13} />
                  </button>
                </li>
              )}
              {spec.frame && (
                <li className="flex items-center gap-2 rounded-row-sm bg-inset-alt px-3 py-2 text-body text-ink">
                  <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
                  <span className="flex-1">{t("A frame around the page")}</span>
                  <button type="button" aria-label={t("Remove")} onClick={() => setSpec({ ...spec, frame: null })} className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                    <Trash2 size={13} />
                  </button>
                </li>
              )}
              {spec.blocks.map((block, i) => {
                const own = editableText(block);
                return (
                  <li key={i} className="flex flex-col gap-1.5 rounded-row-sm bg-inset-alt px-3 py-2">
                    <div className="flex items-start gap-2 text-body text-ink">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
                      <span className="flex-1" data-testid="understood">
                        {describeBlock(block, t)}
                      </span>
                      {(block.color || block.fill) && (
                        <span className="flex shrink-0 items-center gap-1 pt-0.5" data-testid="colors">
                          {block.color && <Swatch color={block.color} label={t("Color {hex}", { hex: block.color })} />}
                          {block.fill && <Swatch color={block.fill} label={t("Fill {hex}", { hex: block.fill })} />}
                        </span>
                      )}
                      <button type="button" aria-label={t("Remove")} onClick={() => updateBlock(i, null)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {own !== null && <input value={own} onChange={(e) => updateBlock(i, { ...block, text: e.target.value } as PageBlock)} aria-label={t("Text of item {n}", { n: i + 1 })} className={cn(input, "h-9 py-0 text-helper")} />}
                  </li>
                );
              })}
            </ol>
            {spec.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-row-sm bg-warning/15 px-3 py-2" aria-label={t("What can't be done")}>
                {spec.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-helper text-ink">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {w}
                  </li>
                ))}
              </ul>
            )}
            {hasBackground && (
              <>
                <label className="flex items-center gap-2 text-body text-ink">
                  <input type="checkbox" checked={backgroundToAll} onChange={(e) => setBackgroundToAll(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent)]" />
                  {t("Use this background on every page of the book")}
                </label>
                {space.bleed === 0 && (
                  <p role="alert" className="flex flex-wrap items-center gap-2 rounded-row-sm bg-warning/15 px-3 py-2 text-helper text-ink">
                    <AlertTriangle size={14} className="shrink-0" aria-hidden />
                    {t("A background reaches the page's edge: for Amazon KDP turn on bleed, or the trim may leave a thin white line.")}
                    {onTurnOnBleed && (
                      <button type="button" onClick={onTurnOnBleed} className="font-semibold text-accent underline outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        {t("Turn on bleed")}
                      </button>
                    )}
                  </p>
                )}
              </>
            )}
            {spec.mode === "color" && <p className="text-helper text-ink-muted">{t("Color pages print with color ink — on Amazon KDP that costs more per copy. Price & royalty shows the difference.")}</p>}
            <p className={cn("text-helper", creditsLeft !== null && credits > creditsLeft ? "text-error" : "text-ink-muted")}>
              {credits === 0 ? t("No AI pictures needed — this page costs no credits.") : t("{n} pictures = {n} AI credits.", { n: credits })} {creditsLeft !== null && credits > 0 && t("{left} left this month.", { left: creditsLeft })}
            </p>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("write")}>
                {t("Back")}
              </Button>
              <Button variant="primary" onClick={() => void make()} disabled={spec.blocks.length === 0} icon={<Sparkles size={14} />}>
                {t("Make the page")}
              </Button>
            </div>
          </>
        )}

        {step === "making" && (
          <p role="status" className="flex items-center gap-2 text-body text-ink-secondary">
            <Loader2 size={16} className="animate-spin" aria-hidden /> {progress ?? t("Laying out the page…")}
          </p>
        )}
      </div>
    </div>
  );
}
