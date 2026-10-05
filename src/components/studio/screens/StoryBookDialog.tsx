"use client";

import { useRef, useState } from "react";
import { BookHeart, CheckCircle2, Circle, Loader2, Sparkles, X, XCircle } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Toggle from "@/components/studio/ui/Toggle";
import { cn } from "@/utils/cn";
import { aiErrorText, useLanguage, useT } from "@/lib/i18n";
import { useAiUsage } from "@/lib/aiUsage";
import { generateLineArtPicture, toPngDataUrl } from "@/lib/lineArt";
import { addMedia } from "@/lib/mediaStore";
import { storyPageFromImage } from "@/utils/imagePages";
import { interiorSpace } from "@/utils/pageGeometry";
import { DEFAULT_TRIM_SIZE_ID } from "@/utils/trimSizes";
import { createBook } from "@/utils/storage";
import type { StoryPlan } from "@/services/storyBook";
import type { BookPage } from "@/types/editor";

type Step = "idea" | "writing" | "story" | "drawing";
type Status = "queued" | "running" | "done" | "failed";

const AGE_LABEL: Record<StoryPlan["ageGroup"], string> = { "3-5": "Ages 3–5", "6-8": "Ages 6–8", "9+": "Ages 9+ / adults" };

/**
 * An illustrated story to color: AI writes it page by page (text + a
 * scene), the user edits it, then each scene is drawn with the same main
 * character — described in every prompt and, after page 1, drawn from
 * page 1's picture so they really look alike.
 */
export default function StoryBookDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (bookId: string) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const { usage, refresh } = useAiUsage();
  const [step, setStep] = useState<Step>("idea");
  const [idea, setIdea] = useState("");
  const [story, setStory] = useState<StoryPlan | null>(null);
  const [followFirst, setFollowFirst] = useState(true);
  const [statuses, setStatuses] = useState<{ status: Status; error?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function write() {
    setError(null);
    setStep("writing");
    try {
      const response = await fetch("/api/plan-story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea: idea.trim(), lang }) });
      const body = (await response.json().catch(() => null)) as { story?: StoryPlan; error?: string } | null;
      if (!response.ok || !body?.story) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Writing the story failed")));
      setStory(body.story);
      setStep("story");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Writing the story failed"));
      setStep("idea");
    }
  }

  const setPage = (i: number, text: string) => setStory((s) => s && { ...s, pages: s.pages.map((p, j) => (j === i ? { ...p, text } : p)) });
  const creditsLeft = usage && usage.limit !== null ? Math.max(0, usage.limit - usage.used) + (usage.extra ?? 0) : null;

  async function draw() {
    if (!story) return;
    stopRef.current = false;
    setStep("drawing");
    setStatuses(story.pages.map(() => ({ status: "queued" })));
    const update = (i: number, patch: { status: Status; error?: string }) => setStatuses((prev) => prev.map((s, j) => (j === i ? patch : s)));
    const space = interiorSpace(DEFAULT_TRIM_SIZE_ID, false);
    const pages: BookPage[] = [];
    let reference: string | undefined;
    for (let i = 0; i < story.pages.length; i++) {
      if (stopRef.current) break;
      update(i, { status: "running" });
      try {
        const { src, size } = await generateLineArtPicture(story.pages[i].scene, story.theme, t, { character: story.character, characterRef: reference });
        if (followFirst && !reference) reference = (await toPngDataUrl(src)) ?? undefined;
        void addMedia(src, { name: `${story.title} ${i + 1}`, source: "ai", width: size.width, height: size.height });
        pages.push({ ...storyPageFromImage(src, size, space, story.pages[i].text), pageNumber: pages.length + 1 });
        update(i, { status: "done" });
      } catch (err) {
        update(i, { status: "failed", error: err instanceof Error ? err.message : t("Generation failed") });
      }
      refresh();
    }
    if (pages.length === 0) return;
    try {
      const book = await createBook(story.title, pages, DEFAULT_TRIM_SIZE_ID);
      onCreated(book.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not save this book."));
    }
  }

  const running = step === "drawing" && statuses.some((s) => s.status === "queued" || s.status === "running");
  const finished = statuses.filter((s) => s.status === "done" || s.status === "failed").length;
  const input = "rounded-row-sm border border-hairline bg-panel px-3 py-2 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={running ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="story-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && !running && onClose()} className="flex max-h-[88vh] w-[600px] max-w-full flex-col gap-4 overflow-y-auto rounded-[24px] bg-panel p-6 shadow-toolbar">
        <div className="flex items-center justify-between gap-3">
          <p id="story-title" className="flex items-center gap-2 text-modal-title font-bold tracking-[-0.02em] text-ink">
            <BookHeart size={20} className="text-spark" aria-hidden />
            {t("Story book")}
          </p>
          {!running && (
            <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
              <X size={17} />
            </button>
          )}
        </div>

        {(step === "idea" || step === "writing") && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (idea.trim() && step === "idea") void write();
            }}
          >
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("What's the story about?")}</MetaLabel>
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={500} autoFocus placeholder={t("A little turtle who wants to see the sea, 8 pages, for 4-year-olds")} className={cn(input, "resize-y")} />
            </label>
            <p className="text-helper text-ink-muted">{t("AI writes a short story with one picture to color per page, all with the same main character. You can change every sentence before any picture is made.")}</p>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={!idea.trim() || step === "writing"} icon={step === "writing" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
                {step === "writing" ? t("Writing…") : t("Write the story")}
              </Button>
            </div>
          </form>
        )}

        {step === "story" && story && (
          <>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Title")}</MetaLabel>
              <input value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} maxLength={80} className={input} />
            </label>
            <span className="w-fit rounded-pill bg-accent-tint px-3 py-1 text-helper font-semibold text-accent">{t(AGE_LABEL[story.ageGroup])}</span>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("Main character (how they look on every page)")}</MetaLabel>
              <textarea value={story.character} onChange={(e) => setStory({ ...story, character: e.target.value })} rows={2} maxLength={400} className={cn(input, "resize-y")} />
            </label>
            <ol className="flex flex-col gap-2" aria-label={t("Story pages")}>
              {story.pages.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 w-6 shrink-0 text-right font-pw-mono text-mono text-ink-muted">{i + 1}</span>
                  <div className="flex flex-1 flex-col gap-1">
                    <textarea value={p.text} onChange={(e) => setPage(i, e.target.value)} rows={2} maxLength={260} aria-label={t("Page {n} text", { n: i + 1 })} className={cn(input, "resize-y")} />
                    <p className="text-helper text-ink-muted">🖍 {p.scene}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Toggle checked={followFirst} onChange={setFollowFirst} label={t("Draw every page from page 1's character")} />
            <p className="text-helper text-ink-muted">{t("{n} pages = {n} AI images.", { n: story.pages.length })} {creditsLeft !== null && t("{left} left this month.", { left: creditsLeft })}</p>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("idea")}>
                {t("Back")}
              </Button>
              <Button variant="primary" onClick={() => void draw()} disabled={creditsLeft === 0} icon={<Sparkles size={14} />}>
                {t("Draw {n} pages", { n: story.pages.length })}
              </Button>
            </div>
          </>
        )}

        {step === "drawing" && story && (
          <>
            <div className="flex items-center justify-between">
              <MetaLabel>{story.title}</MetaLabel>
              <MetaLabel tone="ink">
                {finished} / {statuses.length}
              </MetaLabel>
            </div>
            <ul className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto" aria-label={t("Story pages")}>
              {story.pages.map((p, i) => {
                const s = statuses[i];
                return (
                  <li key={i} className="flex items-start gap-2 text-body">
                    {s?.status === "done" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" /> : s?.status === "failed" ? <XCircle size={16} className="mt-0.5 shrink-0 text-error" /> : s?.status === "running" ? <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-accent" /> : <Circle size={16} className="mt-0.5 shrink-0 text-ink-muted" />}
                    <span className="min-w-0">
                      <span className={cn(s?.status === "queued" ? "text-ink-muted" : "text-ink")}>{p.text}</span>
                      {s?.error && <span className="block text-helper text-error">{s.error}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end">
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
