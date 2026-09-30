"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Sparkles, X, XCircle } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import { aiErrorText, useLanguage, useT } from "@/lib/i18n";
import { useAiUsage } from "@/lib/aiUsage";
import { generateLineArtPicture } from "@/lib/lineArt";
import { pageFromImage } from "@/utils/imagePages";
import { interiorSpace } from "@/utils/pageGeometry";
import { DEFAULT_TRIM_SIZE_ID } from "@/utils/trimSizes";
import { createBook } from "@/utils/storage";
import type { BookPlan, PlanAge } from "@/services/bookPlanner";
import type { BookPage } from "@/types/editor";

type Step = "describe" | "planning" | "plan" | "generating";
type ItemStatus = "queued" | "running" | "done" | "failed";
interface Item {
  label: string;
  status: ItemStatus;
  error?: string;
}

const AGE_LABEL: Record<PlanAge, string> = { "3-5": "Ages 3–5", "6-8": "Ages 6–8", "9+": "Ages 9+ / adults" };

/**
 * "A 20-page book of farm animals for 4-year-olds" → a new book.
 * 1. describe → the server plans it (title, age, one subject per page);
 * 2. the user edits the plan (and sees what it costs in AI credits);
 * 3. pictures are generated one at a time — each page lands as it's ready,
 *    failures are skipped, and Stop keeps what's done — then the book is
 *    created and opened.
 */
export default function BookFromDescriptionDialog({ initialDescription = "", onClose, onCreated }: { initialDescription?: string; onClose: () => void; onCreated: (bookId: string) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const { usage, refresh } = useAiUsage();
  const [step, setStep] = useState<Step>(initialDescription.trim() ? "planning" : "describe");
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<BookPlan | null>(null);
  const [title, setTitle] = useState("");
  const [labels, setLabels] = useState("");
  const [captions, setCaptions] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const stopRef = useRef(false);
  const startedRef = useRef(false);

  async function requestPlan(text: string) {
    setError(null);
    setStep("planning");
    try {
      const response = await fetch("/api/plan-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text, lang }),
      });
      const body = (await response.json().catch(() => null)) as { plan?: BookPlan; error?: string } | null;
      if (!response.ok || !body?.plan) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Planning failed")));
      setPlan(body.plan);
      setTitle(body.plan.title);
      setLabels(body.plan.pages.map((p) => p.label).join("\n"));
      setCaptions(body.plan.captions);
      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Planning failed"));
      setStep("describe");
    }
  }

  // Opened with a description already typed (the library's quick field): plan straight away.
  useEffect(() => {
    if (startedRef.current || !initialDescription.trim()) return;
    startedRef.current = true;
    void requestPlan(initialDescription.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const pageLabels = labels
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 24);
  const creditsLeft = usage && usage.limit !== null ? Math.max(0, usage.limit - usage.used) : null;
  const overBudget = creditsLeft !== null && pageLabels.length > creditsLeft;

  async function generate() {
    if (!plan || pageLabels.length === 0) return;
    stopRef.current = false;
    setStep("generating");
    const queue: Item[] = pageLabels.map((label) => ({ label, status: "queued" }));
    setItems(queue);
    const update = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
    const space = interiorSpace(DEFAULT_TRIM_SIZE_ID, false);
    const pages: BookPage[] = [];
    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) break;
      update(i, { status: "running" });
      // The model planned an English subject per label; an edited or new label is drawn as written.
      const subject = plan.pages.find((p) => p.label === queue[i].label)?.subject ?? queue[i].label;
      try {
        const { src, size } = await generateLineArtPicture(subject, plan.theme, t);
        pages.push({ ...pageFromImage(src, size, space, captions ? queue[i].label : undefined), pageNumber: pages.length + 1 });
        update(i, { status: "done" });
      } catch (err) {
        update(i, { status: "failed", error: err instanceof Error ? err.message : t("Generation failed") });
      }
      refresh();
    }
    if (pages.length === 0) return; // stay on the list so the errors are readable
    try {
      const book = await createBook(title.trim() || plan.title, pages, DEFAULT_TRIM_SIZE_ID);
      onCreated(book.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not save this book."));
    }
  }

  const done = items.filter((i) => i.status === "done").length;
  const running = step === "generating" && items.some((i) => i.status === "queued" || i.status === "running");
  const input = "rounded-row-sm border border-hairline bg-panel px-3 py-2 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={running ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bfd-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !running && onClose()}
        className="flex max-h-[88vh] w-[560px] max-w-full flex-col gap-4 overflow-y-auto rounded-[24px] bg-panel p-6 shadow-toolbar"
      >
        <div className="flex items-center justify-between gap-3">
          <p id="bfd-title" className="flex items-center gap-2 text-modal-title font-bold tracking-[-0.02em] text-ink">
            <Sparkles size={20} className="text-spark" aria-hidden />
            {t("New book from a description")}
          </p>
          {!running && (
            <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
              <X size={17} />
            </button>
          )}
        </div>

        {(step === "describe" || step === "planning") && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (description.trim() && step !== "planning") void requestPlan(description.trim());
            }}
          >
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Describe the book")}</MetaLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus
                placeholder={t("A 20-page book of farm animals for 4-year-olds")}
                className={cn(input, "resize-y")}
              />
            </label>
            <p className="text-helper text-ink-muted">{t("AI suggests a title, an age group and one picture per page. You can change everything before any picture is made.")}</p>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!description.trim() || step === "planning"} icon={step === "planning" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
                {step === "planning" ? t("Planning…") : t("Plan the book")}
              </Button>
            </div>
          </form>
        )}

        {step === "plan" && plan && (
          <>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Title")}</MetaLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={input} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-pill bg-accent-tint px-3 py-1 text-helper font-semibold text-accent">{t(AGE_LABEL[plan.ageGroup])}</span>
              {plan.theme && <span className="text-helper text-ink-muted">{plan.theme}</span>}
            </div>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Pages — one per line")}</MetaLabel>
              <textarea value={labels} onChange={(e) => setLabels(e.target.value)} rows={Math.min(10, Math.max(4, pageLabels.length))} className={cn(input, "resize-y")} />
            </label>
            <Toggle checked={captions} onChange={setCaptions} label={t("Print each page's name under the picture")} />
            <p className={cn("text-helper", overBudget ? "text-error" : "text-ink-muted")}>
              {pageLabels.length === 1 ? t("1 page = 1 AI image.") : t("{n} pages = {n} AI images.", { n: pageLabels.length })}{" "}
              {creditsLeft !== null && (overBudget ? t("You have {left} left this month — only that many will be made.", { left: creditsLeft }) : t("{left} left this month.", { left: creditsLeft }))}
            </p>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("describe")}>
                {t("Back")}
              </Button>
              <Button variant="primary" onClick={() => void generate()} disabled={pageLabels.length === 0 || creditsLeft === 0} icon={<Sparkles size={14} />}>
                {pageLabels.length === 1 ? t("Create 1 page") : t("Create {n} pages", { n: pageLabels.length })}
              </Button>
            </div>
          </>
        )}

        {step === "generating" && (
          <>
            <div className="flex items-center justify-between">
              <MetaLabel>{title}</MetaLabel>
              <MetaLabel tone="ink">
                {done} / {items.length}
              </MetaLabel>
            </div>
            <div className="h-1.5 rounded-pill bg-inset">
              <div className="h-1.5 rounded-pill bg-accent transition-[width] duration-300" style={{ width: `${items.length ? (items.filter((i) => i.status === "done" || i.status === "failed").length / items.length) * 100 : 0}%` }} />
            </div>
            <ul className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto" aria-label={t("Pages")}>
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-body">
                  {it.status === "done" ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                  ) : it.status === "failed" ? (
                    <XCircle size={16} className="mt-0.5 shrink-0 text-error" />
                  ) : it.status === "running" ? (
                    <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-accent" />
                  ) : (
                    <Circle size={16} className="mt-0.5 shrink-0 text-ink-muted" />
                  )}
                  <span className="min-w-0">
                    <span className={cn(it.status === "queued" ? "text-ink-muted" : "text-ink")}>{it.label}</span>
                    {it.error && <span className="block text-helper text-error">{it.error}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end gap-2">
              {running ? (
                <Button variant="secondary" onClick={() => (stopRef.current = true)}>
                  {t("Stop and keep what's done")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={onClose}>
                  {t("Close")}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
