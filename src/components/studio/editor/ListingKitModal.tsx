"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Sparkles, X } from "lucide-react";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { AUDIENCE_OPTIONS, buildListingKit, DESCRIPTION_MAX, KEYWORD_MAX, TITLE_SUBTITLE_MAX, type Audience, type ListingInput } from "@/utils/listingKit";
import { aiErrorText, useLanguage, useT } from "@/lib/i18n";
import type { ListingIdeas } from "@/services/bookTexts";

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={t("Copy {what}", { what: label })}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="flex h-7 shrink-0 items-center gap-1 rounded-pill px-2 text-helper font-medium text-accent outline-none hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? t("Copied") : t("Copy")}
    </button>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("font-pw-mono text-mono", n > max ? "text-error" : "text-ink-muted")}>{n}/{max}</span>;
}

/** Everything the KDP "Paperback details" form asks for, derived from the book — review, tweak the inputs, copy each field across. */
export default function ListingKitModal({ input, onClose }: { input: Omit<ListingInput, "theme" | "audience">; onClose: () => void }) {
  const t = useT();
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState<Audience>("kids");
  const kit = buildListingKit({ ...input, theme, audience });
  const { lang } = useLanguage();
  const [ideas, setIdeas] = useState<ListingIdeas | null>(null);
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const keywords = ideas?.keywords ?? kit.keywords;

  /** Asks the text model for keywords, categories and a subtitle that fit this book. */
  async function suggest() {
    setAsking(true);
    setAiError(null);
    try {
      const who = AUDIENCE_OPTIONS.find((a) => a.value === audience);
      const response = await fetch("/api/listing-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: input.title, theme, audience: who ? `${who.value}, ${who.ages}` : audience, subjects: kit.stats.captions, pageCount: kit.stats.pages, lang }),
      });
      const body = (await response.json().catch(() => null)) as { ideas?: ListingIdeas; error?: string } | null;
      if (!response.ok || !body?.ideas) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Could not get suggestions")));
      setIdeas(body.ideas);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t("Could not get suggestions"));
    } finally {
      setAsking(false);
    }
  }
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-full w-[760px] max-w-full flex-col gap-4 overflow-auto rounded-panel bg-panel p-6 shadow-panel"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="listing-title" className="text-modal-title font-semibold tracking-[-0.02em] text-ink">
              {t("Amazon listing kit")}
            </p>
            <p className="text-helper text-ink-muted">{t("Built from your book: {pages} pages, {illustrated} illustrated. Paste each field into KDP's Paperback details.", { pages: kit.stats.pages, illustrated: kit.stats.illustrations })}</p>
          </div>
          <button ref={closeRef} type="button" aria-label={t("Close")} onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <MetaLabel>{t("Theme")}</MetaLabel>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={t("e.g. dinosaurs, Ancient Greece")}
              className="h-9 rounded-row-sm border border-hairline px-2.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <MetaLabel>{t("For")}</MetaLabel>
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="h-9 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {t(a.label)} {a.ages && `(${a.ages})`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <MetaLabel>{t("Title · Subtitle")}</MetaLabel>
            <Counter n={input.title.length + kit.subtitle.length} max={TITLE_SUBTITLE_MAX} />
          </div>
          <div className="flex items-start gap-2 rounded-row-sm bg-inset-alt p-3">
            <p className="flex-1 text-body text-ink">
              <b>{input.title}</b>
              <br />
              {kit.subtitle}
            </p>
            <CopyButton text={kit.subtitle} label={t("subtitle")} />
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <MetaLabel>{t("Description (KDP accepts this HTML)")}</MetaLabel>
            <div className="flex items-center gap-2">
              <Counter n={kit.description.length} max={DESCRIPTION_MAX} />
              <CopyButton text={kit.description} label={t("description")} />
            </div>
          </div>
          {/* Preview of the generated HTML: only the <b>/<br>/<ul>/<li> tags listingKit writes; theme and captions are escaped there. */}
          <div className="max-h-48 overflow-auto rounded-row-sm bg-inset-alt p-3 text-body text-ink [&_li]:ml-4 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: kit.description }} />
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <MetaLabel>{t("Keywords ({n} of 7 slots)", { n: keywords.length })}</MetaLabel>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => void suggest()} disabled={asking} className="flex h-7 items-center gap-1 rounded-pill px-2 text-helper font-medium text-spark outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60">
                {asking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {ideas ? t("Suggest again") : t("Suggest with AI")}
              </button>
              <CopyButton text={keywords.join("\n")} label={t("all keywords")} />
            </span>
          </div>
          {aiError && <p className="text-helper text-error">{aiError}</p>}
          <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {keywords.map((k, i) => (
              <li key={k} className="flex items-center justify-between gap-2 rounded-row-sm bg-inset-alt py-1 pl-3 pr-1 text-body text-ink">
                <span className="truncate">
                  <span className="mr-1.5 font-pw-mono text-mono text-ink-muted">{i + 1}</span>
                  {k}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Counter n={k.length} max={KEYWORD_MAX} />
                  <CopyButton text={k} label={t("keyword {n}", { n: i + 1 })} />
                </span>
              </li>
            ))}
          </ol>
          {!ideas && kit.keywords.length < 7 && (
            <p className="text-helper text-ink-muted">
              {theme.trim() ? t("Captions on your pages (e.g. from an AI page series) add more specific keywords.") : t("Add a theme for more specific keywords.")} {t("Empty slots are better than filler.")}
            </p>
          )}
        </section>

        {ideas && (ideas.categories.length > 0 || ideas.subtitle) && (
          <section className="flex flex-col gap-1.5">
            <MetaLabel>{t("AI suggestions")}</MetaLabel>
            {ideas.subtitle && (
              <div className="flex items-center justify-between gap-2 rounded-row-sm bg-inset-alt py-1 pl-3 pr-1 text-body text-ink">
                <span className="min-w-0">
                  <span className="mr-1.5 text-helper text-ink-muted">{t("Subtitle")}</span>
                  {ideas.subtitle}
                </span>
                <CopyButton text={ideas.subtitle} label={t("suggested subtitle")} />
              </div>
            )}
            {ideas.categories.map((c, i) => (
              <div key={c} className="flex items-center justify-between gap-2 rounded-row-sm bg-inset-alt py-1 pl-3 pr-1 text-body text-ink">
                <span className="min-w-0">
                  <span className="mr-1.5 text-helper text-ink-muted">{t("Category {n}", { n: i + 1 })}</span>
                  {c}
                </span>
                <CopyButton text={c} label={t("category {n}", { n: i + 1 })} />
              </div>
            ))}
            <p className="text-helper text-ink-muted">{t("Suggestions, not data: check each category exists in KDP's list, and search Amazon for the keywords before relying on them.")}</p>
          </section>
        )}
      </div>
    </div>
  );
}
