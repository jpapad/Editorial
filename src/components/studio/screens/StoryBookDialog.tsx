"use client";

import { useRef, useState } from "react";
import { BookHeart, CheckCircle2, Circle, Library, Loader2, PenLine, Sparkles, X, XCircle } from "lucide-react";
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
import { MAX_STORY_INPUT, STORY_LANGUAGES, isStoryLanguage, type StoryLanguage, type StoryPlan } from "@/services/storyBook";
import { AGE_OPTIONS, FAIRY_TALES, TALE_THEMES, taleRequest, type FairyTale, type StoryAge, type TaleTheme } from "@/data/fairyTales";
import { buildStoryPack, PACK_PARTS, type PackPart } from "@/utils/storyPack";
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
  // Where the story comes from: the user's own idea or text, or a tale from the library.
  const [source, setSource] = useState<"own" | "library">("own");
  const [tale, setTale] = useState<FairyTale | null>(null);
  const [themeFilter, setThemeFilter] = useState<TaleTheme | null>(null);
  const [storyLang, setStoryLang] = useState<StoryLanguage>(isStoryLanguage(lang) ? lang : "el");
  const [age, setAge] = useState<StoryAge | "auto">("auto");
  const [pageCount, setPageCount] = useState(8);
  const [packParts, setPackParts] = useState<PackPart[]>(PACK_PARTS.map((p) => p.value));
  const [story, setStory] = useState<StoryPlan | null>(null);
  const [followFirst, setFollowFirst] = useState(true);
  // A picture book in full color instead of pages to color in.
  const [inColor, setInColor] = useState(false);
  const [statuses, setStatuses] = useState<{ status: Status; error?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  async function write() {
    setError(null);
    setStep("writing");
    try {
      const ageLine = age === "auto" ? "" : `Write it ${AGE_OPTIONS.find((a) => a.value === age)!.request}.\n\n`;
      const request = source === "library" && tale ? taleRequest(tale, age === "auto" ? (tale.minAge === 6 ? "6-8" : "3-5") : age, pageCount) : `${ageLine}${idea.trim()}`;
      const response = await fetch("/api/plan-story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea: request, lang: storyLang }) });
      const body = (await response.json().catch(() => null)) as { story?: StoryPlan; error?: string } | null;
      if (!response.ok || !body?.story) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Writing the story failed")));
      // A reply without the pack fields (an older server) still gives a usable, empty pack.
      setStory({ ...body.story, questions: body.story.questions ?? [], words: body.story.words ?? [], moral: body.story.moral ?? "", discussion: body.story.discussion ?? [] });
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
    const pictures: { src: string; width: number; height: number }[] = [];
    let reference: string | undefined;
    for (let i = 0; i < story.pages.length; i++) {
      if (stopRef.current) break;
      update(i, { status: "running" });
      try {
        const { src, size } = await generateLineArtPicture(story.pages[i].scene, story.theme, t, { character: story.character, characterRef: reference, color: inColor });
        if (followFirst && !reference) reference = (await toPngDataUrl(src)) ?? undefined;
        void addMedia(src, { name: `${story.title} ${i + 1}`, source: "ai", width: size.width, height: size.height });
        pages.push({ ...storyPageFromImage(src, size, space, story.pages[i].text, storyLang), pageNumber: pages.length + 1, ...(inColor ? { inColor: true } : {}) });
        pictures.push({ src, ...size });
        update(i, { status: "done" });
      } catch (err) {
        update(i, { status: "failed", error: err instanceof Error ? err.message : t("Generation failed") });
      }
      refresh();
    }
    if (pages.length === 0) return;
    // The activity pages go after the story, numbered on from it.
    const pack = buildStoryPack(space, story, pictures, packParts, storyLang).map((p, i) => ({ ...p, pageNumber: pages.length + i + 1 }));
    try {
      const book = await createBook(story.title, [...pages, ...pack], DEFAULT_TRIM_SIZE_ID);
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
              if ((source === "library" ? tale : idea.trim()) && step === "idea") void write();
            }}
          >
            <div role="radiogroup" aria-label={t("Where the story comes from")} className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "own", label: t("My idea or story"), Icon: PenLine },
                  { value: "library", label: t("From the tale library"), Icon: Library },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button key={value} type="button" role="radio" aria-checked={source === value} onClick={() => setSource(value)} className={cn("flex items-center justify-center gap-2 rounded-row-sm border px-3 py-2.5 text-body font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent", source === value ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}>
                  <Icon size={16} aria-hidden /> {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <MetaLabel>{t("Language of the story")}</MetaLabel>
                <select value={storyLang} onChange={(e) => setStoryLang(e.target.value as StoryLanguage)} aria-label={t("Language of the story")} className={cn(input, "h-10 py-0")}>
                  {STORY_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <MetaLabel>{t("Age")}</MetaLabel>
                <select value={age} onChange={(e) => setAge(e.target.value as StoryAge | "auto")} aria-label={t("Age")} className={cn(input, "h-10 py-0")}>
                  <option value="auto">{t("As the story says")}</option>
                  {AGE_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {t(a.label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {source === "library" ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Themes")}>
                  {TALE_THEMES.map((th) => (
                    <button key={th.value} type="button" aria-pressed={themeFilter === th.value} onClick={() => setThemeFilter((f) => (f === th.value ? null : th.value))} className={cn("rounded-pill border px-2.5 py-0.5 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", themeFilter === th.value ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt")}>
                      {t(th.label)}
                    </button>
                  ))}
                </div>
                <ul role="radiogroup" aria-label={t("Tales")} className="grid max-h-[40vh] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {FAIRY_TALES.filter((ft) => !themeFilter || ft.themes.includes(themeFilter)).map((ft) => (
                    <li key={ft.id}>
                      <button type="button" role="radio" aria-checked={tale?.id === ft.id} onClick={() => setTale(ft)} className={cn("flex h-full w-full flex-col items-start gap-0.5 rounded-row-sm border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent", tale?.id === ft.id ? "border-accent bg-accent-tint" : "border-hairline hover:bg-inset-alt")}>
                        <span className="text-body font-semibold text-ink">{lang === "el" ? ft.title.el : ft.title.en}</span>
                        <span className="text-helper text-ink-muted">
                          {ft.source} · {ft.minAge}+ · {lang === "el" ? ft.moral.el : ft.moral.en}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-helper text-ink-secondary">
                  {t("Pages")}
                  <input type="number" min={4} max={16} value={pageCount} onChange={(e) => setPageCount(Math.max(4, Math.min(16, Number(e.target.value) || 8)))} className={cn(input, "h-8 w-20 py-0")} aria-label={t("Pages")} />
                </label>
                <p className="text-helper text-ink-muted">{t("Classic tales, free to use. AI retells the one you pick in fresh words for the age and language you chose; you read and correct it before any picture is made.")}</p>
              </div>
            ) : (
            <>
            <label className="flex flex-col gap-1.5">
              <MetaLabel>{t("What's the story about?")}</MetaLabel>
              <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={6} maxLength={MAX_STORY_INPUT} autoFocus placeholder={t("A little turtle who wants to see the sea, 8 pages, for 4-year-olds")} className={cn(input, "resize-y")} />
              <span className={cn("self-end font-pw-mono text-mono", idea.length >= MAX_STORY_INPUT ? "text-error" : "text-ink-muted")}>
                {idea.length} / {MAX_STORY_INPUT}
              </span>
            </label>
            <p className="text-helper text-ink-muted">{t("Write an idea, or paste your own story: AI splits it into pages, keeping your characters and events, with one picture to color per page and the same main character throughout. You can change every sentence before any picture is made.")}</p>
            </>
            )}
            {error && <p className="text-helper text-error">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={(source === "library" ? !tale : !idea.trim()) || step === "writing"} icon={step === "writing" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
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
            <Toggle checked={inColor} onChange={setInColor} label={t("A color picture book (not for coloring)")} />
            {inColor && <p className="text-helper text-ink-muted">{t("The story's pictures are drawn in full color; the activity pages stay black and white to write and color on. Color pages cost more to print on Amazon KDP.")}</p>}
            <fieldset className="flex flex-col gap-2 rounded-row-sm border border-hairline p-3">
              <legend className="px-1 text-card-title font-semibold text-ink">{t("Story pack: activity pages after the story")}</legend>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {PACK_PARTS.map((part) => (
                  <label key={part.value} className="flex items-center gap-2 text-body text-ink">
                    <input type="checkbox" checked={packParts.includes(part.value)} onChange={(e) => setPackParts((prev) => (e.target.checked ? [...prev, part.value] : prev.filter((x) => x !== part.value)))} className="h-4 w-4 accent-[var(--color-accent)]" />
                    {t(part.label)}
                  </label>
                ))}
              </div>
              {packParts.includes("words") && (
                <label className="flex flex-col gap-1">
                  <MetaLabel>{t("Words for the word search")}</MetaLabel>
                  <input value={story.words.join(", ")} onChange={(e) => setStory({ ...story, words: e.target.value.split(",").map((w) => w.trim()).filter(Boolean).slice(0, 10) })} className={cn(input, "h-9 py-0")} aria-label={t("Words for the word search")} />
                </label>
              )}
              {packParts.includes("questions") && story.questions.length > 0 && (
                <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-helper text-ink-secondary" aria-label={t("Questions about the story")}>
                  {story.questions.map((q, i) => (
                    <li key={i}>
                      {q.question} <span className="text-ink-muted">({q.choices.map((c, j) => (j === q.answer ? `✓ ${c}` : c)).join(" / ")})</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-helper text-ink-muted">{t("Written in the story's language. No AI credits: only the story pictures use them.")}</p>
            </fieldset>
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
