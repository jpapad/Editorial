"use client";

import { useState } from "react";
import { ExternalLink, Lightbulb, Loader2, Sparkles, TrendingUp, X } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { aiErrorText, useLanguage, useT } from "@/lib/i18n";
import { keywordLinks, type NicheIdea, type NicheRequest } from "@/services/nicheIdeas";

const MARKETS: { value: NicheRequest["market"]; label: string }[] = [
  { value: "us", label: "Amazon.com" },
  { value: "uk", label: "Amazon.co.uk" },
  { value: "de", label: "Amazon.de" },
  { value: "gr", label: "Greek buyers" },
];

const COMPETITION: Record<NicheIdea["competition"], { label: string; className: string }> = {
  low: { label: "Less crowded", className: "bg-success/15 text-success" },
  medium: { label: "Some competition", className: "bg-warning/20 text-ink" },
  high: { label: "Crowded", className: "bg-error/10 text-error" },
};

/**
 * Before making a book: niche ideas around a topic, with keywords to
 * check on Amazon and Google Trends. "Plan this book" hands the idea to
 * the book-from-description flow.
 */
export default function NicheIdeasDialog({ onClose, onPlan }: { onClose: () => void; onPlan: (description: string) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [market, setMarket] = useState<NicheRequest["market"]>("us");
  const [ideas, setIdeas] = useState<NicheIdea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/niche-ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, audience, market, lang }) });
      const body = (await response.json().catch(() => null)) as { ideas?: NicheIdea[]; error?: string } | null;
      if (!response.ok || !body?.ideas) throw new Error(aiErrorText(t, response.status, body?.error ?? t("Could not get ideas")));
      setIdeas(body.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not get ideas"));
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) => cn("rounded-pill border px-3 py-1 text-helper outline-none focus-visible:ring-2 focus-visible:ring-accent", on ? "border-accent bg-accent-tint font-semibold text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt");
  const input = "rounded-row-sm border border-hairline bg-panel px-3 py-2 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="niche-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()} className="flex max-h-[90vh] w-[760px] max-w-full flex-col gap-4 overflow-y-auto rounded-[24px] bg-panel p-6 shadow-toolbar">
        <div className="flex items-center justify-between gap-3">
          <p id="niche-title" className="flex items-center gap-2 text-modal-title font-bold tracking-[-0.02em] text-ink">
            <Lightbulb size={20} className="text-spark" aria-hidden />
            {t("Find a book idea")}
          </p>
          <button type="button" aria-label={t("Close")} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset focus-visible:ring-2 focus-visible:ring-accent">
            <X size={17} />
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (topic.trim() && !busy) void search();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <MetaLabel>{t("Topic")}</MetaLabel>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} autoFocus placeholder={t("e.g. dinosaurs, Greek myths, Christmas")} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <MetaLabel>{t("For whom (optional)")}</MetaLabel>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={100} placeholder={t("e.g. ages 4–6, teachers")} className={input} />
          </label>
          <Button type="submit" variant="primary" className="self-end" disabled={!topic.trim() || busy} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}>
            {t("Find ideas")}
          </Button>
          <div role="radiogroup" aria-label={t("Where it will sell")} className="flex flex-wrap items-center gap-1.5 sm:col-span-3">
            <MetaLabel>{t("Where it will sell")}</MetaLabel>
            {MARKETS.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={market === m.value} onClick={() => setMarket(m.value)} className={chip(market === m.value)}>
                {t(m.label)}
              </button>
            ))}
          </div>
        </form>
        {error && <p className="text-helper text-error">{error}</p>}

        {ideas && (
          <>
            <p className="rounded-row-sm bg-inset-alt px-3 py-2 text-helper text-ink-secondary">{t("These are AI suggestions, not sales figures. Open a keyword to see the real Amazon results and Google Trends before you decide.")}</p>
            <ul className="flex flex-col gap-3" aria-label={t("Book ideas")}>
              {ideas.map((idea) => (
                <li key={idea.title} className="flex flex-col gap-2 rounded-[18px] border border-hairline p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <p className="text-card-title font-semibold text-ink">{idea.title}</p>
                      <p className="text-helper text-ink-muted">{idea.audience}</p>
                    </div>
                    <span className={cn("rounded-pill px-2.5 py-0.5 text-helper font-semibold", COMPETITION[idea.competition].className)}>{t(COMPETITION[idea.competition].label)}</span>
                  </div>
                  {idea.angle && <p className="text-body text-ink-secondary">{idea.angle}</p>}
                  {idea.why && <p className="text-helper text-ink-muted">{idea.why}</p>}
                  <div className="flex flex-wrap gap-1.5" aria-label={t("Keywords")}>
                    {idea.keywords.map((k) => {
                      const links = keywordLinks(k, market);
                      return (
                        <span key={k} className="inline-flex items-center gap-1 rounded-pill bg-inset px-2.5 py-1 text-helper text-ink">
                          {k}
                          <a href={links.amazon} target="_blank" rel="noreferrer" aria-label={t("“{k}” on Amazon", { k })} title={t("See it on Amazon")} className="text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            <ExternalLink size={12} />
                          </a>
                          <a href={links.trends} target="_blank" rel="noreferrer" aria-label={t("“{k}” on Google Trends", { k })} title={t("See it on Google Trends")} className="text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            <TrendingUp size={12} />
                          </a>
                        </span>
                      );
                    })}
                  </div>
                  {idea.pageIdeas.length > 0 && <p className="text-helper text-ink-muted">🖍 {idea.pageIdeas.join(" · ")}</p>}
                  <div className="flex justify-end">
                    <Button variant="secondary" size="sm" icon={<Sparkles size={13} />} onClick={() => onPlan(`${idea.title} — ${idea.angle} ${t("For")}: ${idea.audience}. ${t("Pages like")}: ${idea.pageIdeas.join(", ")}.`.slice(0, 500))}>
                      {t("Plan this book")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
