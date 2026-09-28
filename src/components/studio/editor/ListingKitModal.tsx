"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { AUDIENCE_OPTIONS, buildListingKit, DESCRIPTION_MAX, KEYWORD_MAX, TITLE_SUBTITLE_MAX, type Audience, type ListingInput } from "@/utils/listingKit";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="flex h-7 shrink-0 items-center gap-1 rounded-pill px-2 text-helper font-medium text-accent outline-none hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("font-pw-mono text-mono", n > max ? "text-error" : "text-ink-muted")}>{n}/{max}</span>;
}

/** Everything the KDP "Paperback details" form asks for, derived from the book — review, tweak the inputs, copy each field across. */
export default function ListingKitModal({ input, onClose }: { input: Omit<ListingInput, "theme" | "audience">; onClose: () => void }) {
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState<Audience>("kids");
  const kit = buildListingKit({ ...input, theme, audience });
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6" onClick={onClose}>
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
              Amazon listing kit
            </p>
            <p className="text-helper text-ink-muted">Built from your book: {kit.stats.pages} page{kit.stats.pages === 1 ? "" : "s"}, {kit.stats.illustrations} illustrated. Paste each field into KDP&apos;s Paperback details.</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <MetaLabel>Theme</MetaLabel>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. dinosaurs, Ancient Greece"
              className="h-9 rounded-row-sm border border-hairline px-2.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <MetaLabel>For</MetaLabel>
            <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className="h-9 rounded-row-sm border border-hairline bg-panel px-2 text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} {a.ages && `(${a.ages})`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <MetaLabel>Title · Subtitle</MetaLabel>
            <Counter n={input.title.length + kit.subtitle.length} max={TITLE_SUBTITLE_MAX} />
          </div>
          <div className="flex items-start gap-2 rounded-row-sm bg-inset-alt p-3">
            <p className="flex-1 text-body text-ink">
              <b>{input.title}</b>
              <br />
              {kit.subtitle}
            </p>
            <CopyButton text={kit.subtitle} label="subtitle" />
          </div>
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <MetaLabel>Description (KDP accepts this HTML)</MetaLabel>
            <div className="flex items-center gap-2">
              <Counter n={kit.description.length} max={DESCRIPTION_MAX} />
              <CopyButton text={kit.description} label="description" />
            </div>
          </div>
          {/* Preview of the generated HTML: only the <b>/<br>/<ul>/<li> tags listingKit writes; theme and captions are escaped there. */}
          <div className="max-h-48 overflow-auto rounded-row-sm bg-inset-alt p-3 text-body text-ink [&_li]:ml-4 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: kit.description }} />
        </section>

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <MetaLabel>Keywords ({kit.keywords.length} of 7 slots)</MetaLabel>
            <CopyButton text={kit.keywords.join("\n")} label="all keywords" />
          </div>
          <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {kit.keywords.map((k, i) => (
              <li key={k} className="flex items-center justify-between gap-2 rounded-row-sm bg-inset-alt py-1 pl-3 pr-1 text-body text-ink">
                <span className="truncate">
                  <span className="mr-1.5 font-pw-mono text-mono text-ink-muted">{i + 1}</span>
                  {k}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Counter n={k.length} max={KEYWORD_MAX} />
                  <CopyButton text={k} label={`keyword ${i + 1}`} />
                </span>
              </li>
            ))}
          </ol>
          {kit.keywords.length < 7 && (
            <p className="text-helper text-ink-muted">
              {theme.trim() ? "Captions on your pages (e.g. from an AI page series) add more specific keywords." : "Add a theme for more specific keywords."} Empty slots are better than filler.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
