"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Circle, Loader2, ScanLine, Sparkles, X, XCircle } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Slider from "@/components/studio/ui/Slider";
import Toggle from "@/components/studio/ui/Toggle";
import AiGeneratePanel from "@/components/studio/editor/AiGeneratePanel";
import { cleanSketchImage } from "@/components/studio/editor/sketchCleanup";
import type { StampFilter } from "@/types/editor";

const MAX_SERIES = 12;

export interface ImageSize {
  width: number;
  height: number;
}

export interface AiStudioPanelProps {
  onClose: () => void;
  onPickStamp: (src: string, options?: { naturalSize?: ImageSize; filter?: StampFilter; threshold?: number }) => void;
  /** Adds the image to the current page, scaled to fill the safe area. */
  onPlaceFullPage: (src: string, size: ImageSize) => void;
  /** Called once before a series starts (one undo step for the whole series). */
  onSeriesStart: () => void;
  /** Appends one new page holding the image (and an optional caption). */
  onAppendImagePage: (src: string, size: ImageSize, caption?: string) => void;
}

type SeriesItem = { subject: string; status: "queued" | "running" | "done" | "failed"; error?: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 });
    img.onerror = () => reject(new Error("Could not read the generated image"));
    img.src = src;
  });
}

/** Photo of a drawing → clean black line art (sketchCleanup.ts). Runs entirely in the browser. */
function SketchCleanupSection({ onPickStamp, onPlaceFullPage }: Pick<AiStudioPanelProps, "onPickStamp" | "onPlaceFullPage">) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState(0.12);
  const [bolder, setBolder] = useState(true);
  const [result, setResult] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function process(src: string, opts: { sensitivity: number; bolder: boolean }) {
    setBusy(true);
    setError(null);
    try {
      const cleaned = await cleanSketchImage(src, opts);
      setResult(cleaned);
      if (!cleaned) setError("No lines found — try a lower sensitivity, or a photo with more contrast.");
    } catch {
      setError("That image couldn't be read. Try a JPG or PNG photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    setSource(src);
    void process(src, { sensitivity, bolder });
  }

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <ScanLine size={15} className="text-accent" />
        <p className="text-card-title font-semibold text-ink">Clean up a sketch photo</p>
      </div>
      <p className="text-helper text-ink-muted">Snap a photo of a drawing on paper. Shadows and paper texture are removed, leaving black lines ready to color.</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
        {source ? "Choose another photo" : "Choose photo"}
      </Button>

      {source && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1">
              <MetaLabel>Photo</MetaLabel>
              <div className="aspect-square rounded-row-sm border border-hairline bg-inset bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${source})` }} />
            </div>
            <div className="flex flex-col gap-1">
              <MetaLabel>Line art</MetaLabel>
              <div className="relative aspect-square rounded-row-sm border border-hairline bg-white bg-contain bg-center bg-no-repeat" style={result ? { backgroundImage: `url(${result.dataUrl})` } : undefined}>
                {busy && <Loader2 size={18} className="absolute inset-0 m-auto animate-spin text-ink-muted" />}
              </div>
            </div>
          </div>
          <Slider
            layout="stacked"
            label="Sensitivity"
            valueLabel={sensitivity < 0.08 ? "More lines" : sensitivity > 0.18 ? "Dark only" : "Balanced"}
            min={0.03}
            max={0.3}
            step={0.01}
            value={sensitivity}
            onChange={(v) => {
              setSensitivity(v);
              void process(source, { sensitivity: v, bolder });
            }}
          />
          <Toggle
            checked={bolder}
            onChange={(v) => {
              setBolder(v);
              void process(source, { sensitivity, bolder: v });
            }}
            label="Bolder lines"
          />
          {error && <p className="text-helper text-error">{error}</p>}
          <div className="flex gap-1.5">
            <Button variant="primary" size="sm" className="flex-1" disabled={!result || busy} onClick={() => result && onPlaceFullPage(result.dataUrl, result)}>
              Fill page
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" disabled={!result || busy} onClick={() => result && onPickStamp(result.dataUrl, { naturalSize: result })}>
              As stamp
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * One AI page per subject, in a shared theme — e.g. theme "Ancient Greece",
 * subjects "Parthenon / Athena's owl / a trireme". Requests run one at a
 * time so each page lands as soon as it's ready and one failure doesn't
 * sink the rest.
 */
function SeriesSection({ onSeriesStart, onAppendImagePage }: Pick<AiStudioPanelProps, "onSeriesStart" | "onAppendImagePage">) {
  const [theme, setTheme] = useState("");
  const [subjects, setSubjects] = useState("");
  const [captions, setCaptions] = useState(false);
  const [items, setItems] = useState<SeriesItem[] | null>(null);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  const list = subjects
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SERIES);

  async function run() {
    if (list.length === 0 || running) return;
    stopRef.current = false;
    setRunning(true);
    const queue: SeriesItem[] = list.map((subject) => ({ subject, status: "queued" }));
    setItems(queue);
    onSeriesStart();
    const update = (i: number, patch: Partial<SeriesItem>) => setItems((prev) => prev && prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) break;
      update(i, { status: "running" });
      try {
        const response = await fetch("/api/generate-line-art", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: queue[i].subject, theme: theme.trim() || undefined, count: 1, aspectRatio: "portrait" }),
        });
        const body = (await response.json().catch(() => null)) as { results?: { ok: boolean; svgMarkup?: string; error?: string }[]; error?: string } | null;
        const first = body?.results?.[0];
        if (!response.ok || !first?.ok || !first.svgMarkup) throw new Error(first?.error ?? body?.error ?? `HTTP ${response.status}`);
        const src = `data:image/svg+xml;utf8,${encodeURIComponent(first.svgMarkup)}`;
        onAppendImagePage(src, await imageSize(src), captions ? queue[i].subject : undefined);
        update(i, { status: "done" });
      } catch (err) {
        update(i, { status: "failed", error: err instanceof Error ? err.message : "Generation failed" });
      }
    }
    setRunning(false);
  }

  const done = items?.filter((i) => i.status === "done").length ?? 0;

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-accent" />
        <p className="text-card-title font-semibold text-ink">Generate a page series</p>
      </div>
      <p className="text-helper text-ink-muted">One new page per subject, all in the same theme and style.</p>
      <input
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="Theme, e.g. Ancient Greece"
        className="rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <textarea
        value={subjects}
        onChange={(e) => setSubjects(e.target.value)}
        rows={5}
        placeholder={"One subject per line, e.g.\nthe Parthenon\nAthena's owl\na trireme at sea"}
        className="resize-y rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <div className="flex items-center justify-between">
        <Toggle checked={captions} onChange={setCaptions} label="Caption each page" />
        <MetaLabel>
          {list.length}/{MAX_SERIES}
        </MetaLabel>
      </div>
      {running ? (
        <Button variant="secondary" size="sm" onClick={() => (stopRef.current = true)}>
          Stop after this page
        </Button>
      ) : (
        <Button variant="dark" size="sm" icon={<Sparkles size={13} />} disabled={list.length === 0} onClick={() => void run()}>
          Generate {list.length || ""} page{list.length === 1 ? "" : "s"}
        </Button>
      )}

      {items && (
        <div className="flex flex-col gap-1">
          <MetaLabel>
            {done} of {items.length} added
          </MetaLabel>
          <ul className="flex flex-col gap-1">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-1.5 text-helper text-ink-secondary">
                {it.status === "done" ? (
                  <CheckCircle2 size={13} className="mt-px shrink-0 text-success" />
                ) : it.status === "failed" ? (
                  <XCircle size={13} className="mt-px shrink-0 text-error" />
                ) : it.status === "running" ? (
                  <Loader2 size={13} className="mt-px shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle size={13} className="mt-px shrink-0 text-ink-muted" />
                )}
                <span className="min-w-0">
                  {it.subject}
                  {it.error && <span className="block text-error">{it.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** The tool rail's AI panel: sketch cleanup, AI page series and single AI stamps, in the right-hand column. */
export default function AiStudioPanel(props: AiStudioPanelProps) {
  return (
    <aside className="absolute bottom-[18px] right-[18px] top-[106px] flex w-[264px] flex-col gap-3.5 overflow-y-auto pb-1">
      <div className="flex shrink-0 items-center justify-between px-1">
        <MetaLabel>AI &amp; import</MetaLabel>
        <button
          type="button"
          aria-label="Close AI panel"
          onClick={props.onClose}
          className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={14} />
        </button>
      </div>
      <div className="shrink-0">
        <SketchCleanupSection onPickStamp={props.onPickStamp} onPlaceFullPage={props.onPlaceFullPage} />
      </div>
      <div className="shrink-0">
        <SeriesSection onSeriesStart={props.onSeriesStart} onAppendImagePage={props.onAppendImagePage} />
      </div>
      <Card className="shrink-0 p-4">
        <AiGeneratePanel onPickStamp={props.onPickStamp} />
      </Card>
    </aside>
  );
}
