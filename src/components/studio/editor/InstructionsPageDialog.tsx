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
import type { PageBlock, PageSpec } from "@/services/pageSpec";
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
export default function InstructionsPageDialog({ space, onAdd, onClose }: { space: PageSpace; onAdd: (pages: BookPage[]) => void; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const { usage, refresh } = useAiUsage();
  const [instructions, setInstructions] = useState("");
  const [step, setStep] = useState<"write" | "reading" | "review" | "making">("write");
  const [spec, setSpec] = useState<PageSpec | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    setError(null);
    setStep("reading");
    try {
      const response = await fetch("/api/page-from-instructions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructions: instructions.trim(), lang }) });
      const body = (await response.json().catch(() => null)) as { spec?: PageSpec; error?: string } | null;
      if (!response.ok || !body?.spec) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Could not read the instructions")));
      setSpec(body.spec);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not read the instructions"));
      setStep("write");
    }
  }

  const updateBlock = (i: number, block: PageBlock | null) => setSpec((s) => s && { ...s, blocks: block ? s.blocks.map((b, j) => (j === i ? block : b)) : s.blocks.filter((_, j) => j !== i) });
  const toMake = spec ? picturesToMake(spec) : [];
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
        const { src, size } = await generateLineArtPicture(item.subject, "simple coloring page line art, the subject only", t, { aspectRatio: "square" });
        pictures.set(item.key, { src, ...size });
      } catch (err) {
        failed++;
        if (failed === 1) setError(err instanceof Error ? err.message : t("Generation failed"));
      }
      refresh();
    }
    const { page, extraPages, continued } = layoutPageSpec(spec, space, pictures);
    onAdd([page, ...extraPages]);
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
            <ol className="flex flex-col gap-2" aria-label={t("What I understood")}>
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
            <p className={cn("text-helper", creditsLeft !== null && toMake.length > creditsLeft ? "text-error" : "text-ink-muted")}>
              {toMake.length === 0 ? t("No AI pictures needed — this page costs no credits.") : t("{n} pictures = {n} AI credits.", { n: toMake.length })} {creditsLeft !== null && toMake.length > 0 && t("{left} left this month.", { left: creditsLeft })}
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
