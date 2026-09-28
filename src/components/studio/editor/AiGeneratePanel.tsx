"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import AiGeneratingModal, { type AiTile } from "@/components/studio/modals/AiGeneratingModal";
import AiFailureModal from "@/components/studio/modals/AiFailureModal";

interface GenerateResultItem {
  ok: boolean;
  svgMarkup?: string;
  promptUsed?: string;
  error?: string;
}

export interface AiGeneratePanelProps {
  onPickStamp: (src: string) => void;
}

function svgMarkupToDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// This app has no per-item progress channel back from the API route (one
// request settles all 4 at once — see the route's own comment on why
// streaming wasn't added), so every tile just shows "queued" for the
// duration rather than fabricating a moving percentage this UI doesn't
// actually know.
const QUEUED_TILES: AiTile[] = [{ status: "queued" }, { status: "queued" }, { status: "queued" }, { status: "queued" }];

/**
 * Real UI for services/aiGenerator.ts (via /api/generate-line-art) — not a
 * static mock of 3c/3d. Genuinely un-exercisable end to end in this
 * environment though: there's no FAL_KEY/OPENAI_API_KEY configured here,
 * so every real request will fail with "FAL_KEY is not set..." (aiGenerator's
 * own loud-failure-over-silent-fallback design) until a real key is added
 * — that failure path IS AiFailureModal's real job, so it's at least a
 * true exercise of that screen, just not of a successful generation.
 */
export default function AiGeneratePanel({ onPickStamp }: AiGeneratePanelProps) {
  const [subject, setSubject] = useState("");
  const [theme, setTheme] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerateResultItem[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function runGenerate() {
    if (!subject.trim() || isGenerating) return;
    setIsGenerating(true);
    setFailure(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch("/api/generate-line-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), theme: theme.trim() || undefined, count: 4 }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as { results?: GenerateResultItem[]; error?: string } | null;
      if (!response.ok || !body?.results) {
        setFailure(body?.error ?? `Generation failed (HTTP ${response.status})`);
        return;
      }
      const anySucceeded = body.results.some((r) => r.ok);
      if (!anySucceeded) {
        setFailure(body.results.find((r) => !r.ok)?.error ?? "All 4 options failed to generate.");
        return;
      }
      setResults(body.results);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // user hit Stop — not a failure
      setFailure(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
      controllerRef.current = null;
    }
  }

  function handleStop() {
    controllerRef.current?.abort();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-hairline pt-3">
      <p className="text-card-title font-semibold text-ink">Generate with AI</p>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject, e.g. a friendly jellyfish"
        className="rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <input
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="Theme (optional), e.g. ocean"
        className="rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <Button variant="dark" size="sm" icon={<Sparkles size={13} />} disabled={!subject.trim() || isGenerating} onClick={() => void runGenerate()}>
        Generate 4 options
      </Button>

      {results && (
        <div className="flex flex-col gap-1.5">
          <MetaLabel>Pick one to place</MetaLabel>
          <div className="grid grid-cols-2 gap-2">
            {results
              .filter((r) => r.ok && r.svgMarkup)
              .map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickStamp(svgMarkupToDataUri(r.svgMarkup as string))}
                  className="aspect-square rounded-row-sm border border-hairline bg-inset bg-cover bg-center outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  style={{ backgroundImage: `url(${svgMarkupToDataUri(r.svgMarkup as string)})` }}
                  aria-label={`Use generated option ${i + 1}`}
                />
              ))}
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6">
          <AiGeneratingModal tiles={QUEUED_TILES} etaLabel="Generating…" onStop={handleStop} />
        </div>
      )}

      {failure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-6" onClick={() => setFailure(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <AiFailureModal cause="Generation failed" explanation={failure} prompt={theme ? `${subject} (${theme})` : subject} remedies={[]} onRetry={() => void runGenerate()} />
          </div>
        </div>
      )}
    </div>
  );
}
