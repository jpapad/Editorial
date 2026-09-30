"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { cn } from "@/utils/cn";
import { Camera, CheckCircle2, Circle, Loader2, ScanLine, Sparkles, X, XCircle } from "lucide-react";
import Card from "@/components/studio/ui/Card";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import Slider from "@/components/studio/ui/Slider";
import Toggle from "@/components/studio/ui/Toggle";
import AiGeneratePanel from "@/components/studio/editor/AiGeneratePanel";
import { cleanSketchImage } from "@/components/studio/editor/sketchCleanup";
import type { StampFilter } from "@/types/editor";
import { aiErrorText, useT } from "@/lib/i18n";
import { useAiUsage } from "@/lib/aiUsage";
import { generateLineArtPicture, imageSize } from "@/lib/lineArt";
import type { ImageSize } from "@/utils/imagePages";

const MAX_SERIES = 12;

export type { ImageSize } from "@/utils/imagePages";

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


/** Photo of a drawing → clean black line art (sketchCleanup.ts). Runs entirely in the browser. */
function SketchCleanupSection({ onPickStamp, onPlaceFullPage }: Pick<AiStudioPanelProps, "onPickStamp" | "onPlaceFullPage">) {
  const t = useT();
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
      if (!cleaned) setError(t("No lines found — try a lower sensitivity, or a photo with more contrast."));
    } catch {
      setError(t("That image couldn't be read. Try a JPG or PNG photo."));
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
        <p className="text-card-title font-semibold text-ink">{t("Clean up a sketch photo")}</p>
      </div>
      <p className="text-helper text-ink-muted">{t("Snap a photo of a drawing on paper. Shadows and paper texture are removed, leaving black lines ready to color.")}</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
        {source ? t("Choose another photo") : t("Choose photo")}
      </Button>

      {source && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1">
              <MetaLabel>{t("Photo")}</MetaLabel>
              <div className="aspect-square rounded-row-sm border border-hairline bg-inset bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${source})` }} />
            </div>
            <div className="flex flex-col gap-1">
              <MetaLabel>{t("Line art")}</MetaLabel>
              <div className="relative aspect-square rounded-row-sm border border-hairline bg-white bg-contain bg-center bg-no-repeat" style={result ? { backgroundImage: `url(${result.dataUrl})` } : undefined}>
                {busy && <Loader2 size={18} className="absolute inset-0 m-auto animate-spin text-ink-muted" />}
              </div>
            </div>
          </div>
          <Slider
            layout="stacked"
            label={t("Sensitivity")}
            valueLabel={t(sensitivity < 0.08 ? "More lines" : sensitivity > 0.18 ? "Dark only" : "Balanced")}
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
            label={t("Bolder lines")}
          />
          {error && <p className="text-helper text-error">{error}</p>}
          <div className="flex gap-1.5">
            <Button variant="primary" size="sm" className="flex-1" disabled={!result || busy} onClick={() => result && onPlaceFullPage(result.dataUrl, result)}>
              {t("Fill page")}
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" disabled={!result || busy} onClick={() => result && onPickStamp(result.dataUrl, { naturalSize: result })}>
              {t("As stamp")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Downscale a photo in the browser before upload: phone photos are many MB; the AI needs ~1500px at most. */
async function downscaleForUpload(src: string, max = 1536): Promise<string> {
  const img = new window.Image();
  img.src = src;
  await img.decode();
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

/**
 * Any photo (a pet, a child, a toy) redrawn as a coloring page by AI
 * (/api/photo-to-line-art). The result goes through the same cleanup as a
 * sketch photo so it lands as pure black lines on transparent.
 */
function PhotoToPageSection({ onPickStamp, onPlaceFullPage, onUsed }: Pick<AiStudioPanelProps, "onPickStamp" | "onPlaceFullPage"> & { onUsed: () => void }) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSource(await readFileAsDataUrl(file));
    setResult(null);
    setError(null);
  }

  async function run() {
    if (!source || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await downscaleForUpload(source);
      const response = await fetch("/api/photo-to-line-art", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo, note: note.trim() || undefined }) });
      const body = (await response.json().catch(() => null)) as { dataUri?: string; error?: string } | null;
      if (!response.ok || !body?.dataUri) throw new Error(aiErrorText(t, response.status, body?.error ?? `HTTP ${response.status}`));
      const cleaned = await cleanSketchImage(body.dataUri, { sensitivity: 0.1, bolder: false });
      setResult(cleaned ?? { dataUrl: body.dataUri, ...(await imageSize(body.dataUri)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Generation failed"));
    } finally {
      onUsed();
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <Camera size={15} className="text-accent" />
        <p className="text-card-title font-semibold text-ink">{t("Photo to coloring page (AI)")}</p>
      </div>
      <p className="text-helper text-ink-muted">{t("Turn any photo — a pet, a toy, a family picture — into a page to color. The photo is sent to OpenAI to redraw it.")}</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
        {source ? t("Choose another photo") : t("Choose photo")}
      </Button>
      {source && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="aspect-square rounded-row-sm border border-hairline bg-inset bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${source})` }} />
            <div className="relative aspect-square rounded-row-sm border border-hairline bg-white bg-contain bg-center bg-no-repeat" style={result ? { backgroundImage: `url(${result.dataUrl})` } : undefined}>
              {busy && <Loader2 size={18} className="absolute inset-0 m-auto animate-spin text-ink-muted" />}
            </div>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={t("Optional note, e.g. “leave out the background”")}
            className="rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          />
          {error && <p className="text-helper text-error">{error}</p>}
          {result ? (
            <div className="flex gap-1.5">
              <Button variant="primary" size="sm" className="flex-1" onClick={() => onPlaceFullPage(result.dataUrl, result)}>
                {t("Fill page")}
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => onPickStamp(result.dataUrl, { naturalSize: result })}>
                {t("As stamp")}
              </Button>
            </div>
          ) : (
            <Button variant="dark" size="sm" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} disabled={busy} onClick={() => void run()}>
              {busy ? t("Drawing… (up to a minute)") : t("Make coloring page")}
            </Button>
          )}
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
function SeriesSection({ onSeriesStart, onAppendImagePage, onUsed }: Pick<AiStudioPanelProps, "onSeriesStart" | "onAppendImagePage"> & { onUsed: () => void }) {
  const t = useT();
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
        const { src, size } = await generateLineArtPicture(queue[i].subject, theme, t);
        onAppendImagePage(src, size, captions ? queue[i].subject : undefined);
        update(i, { status: "done" });
      } catch (err) {
        update(i, { status: "failed", error: err instanceof Error ? err.message : t("Generation failed") });
      }
      onUsed();
    }
    setRunning(false);
  }

  const done = items?.filter((i) => i.status === "done").length ?? 0;

  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-accent" />
        <p className="text-card-title font-semibold text-ink">{t("Generate a page series")}</p>
      </div>
      <p className="text-helper text-ink-muted">{t("One new page per subject, all in the same theme and style.")}</p>
      <input
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder={t("Theme, e.g. Ancient Greece")}
        className="rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <textarea
        value={subjects}
        onChange={(e) => setSubjects(e.target.value)}
        rows={5}
        placeholder={t("One subject per line, e.g.\nthe Parthenon\nAthena's owl\na trireme at sea")}
        className="resize-y rounded-row-sm border border-hairline px-2.5 py-1.5 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <div className="flex items-center justify-between">
        <Toggle checked={captions} onChange={setCaptions} label={t("Caption each page")} />
        <MetaLabel>
          {list.length}/{MAX_SERIES}
        </MetaLabel>
      </div>
      {running ? (
        <Button variant="secondary" size="sm" onClick={() => (stopRef.current = true)}>
          {t("Stop after this page")}
        </Button>
      ) : (
        <Button variant="dark" size="sm" icon={<Sparkles size={13} />} disabled={list.length === 0} onClick={() => void run()}>
          {list.length === 1 ? t("Generate 1 page") : list.length ? t("Generate {n} pages", { n: list.length }) : t("Generate pages")}
        </Button>
      )}

      {items && (
        <div className="flex flex-col gap-1">
          <MetaLabel>
            {t("{done} of {total} added", { done, total: items.length })}
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
/** "12 of 20 AI credits left this month" — hidden until the usage migration exists. */
export default function AiStudioPanel(props: AiStudioPanelProps) {
  const t = useT();
  const { usage, refresh } = useAiUsage();
  return (
    <aside className="absolute bottom-[18px] right-[18px] top-[106px] flex w-[264px] flex-col gap-3.5 overflow-y-auto pb-1">
      <div className="flex shrink-0 items-center justify-between px-1">
        <MetaLabel>{t("AI & import")}</MetaLabel>
        <button
          type="button"
          aria-label={t("Close AI panel")}
          onClick={props.onClose}
          className="flex h-7 w-7 items-center justify-center rounded-pill text-ink-secondary outline-none hover:bg-inset-alt focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={14} />
        </button>
      </div>
      {usage && (
        <p className={cn("shrink-0 px-1 text-helper", usage.limit !== null && usage.used >= usage.limit ? "text-error" : "text-ink-muted")}>
          {usage.limit === null ? t("AI: unlimited (supervisor)") : t("{left} of {limit} AI credits left this month", { left: Math.max(0, usage.limit - usage.used), limit: usage.limit })}
        </p>
      )}
      <div className="shrink-0">
        <SketchCleanupSection onPickStamp={props.onPickStamp} onPlaceFullPage={props.onPlaceFullPage} />
      </div>
      <div className="shrink-0">
        <PhotoToPageSection onPickStamp={props.onPickStamp} onPlaceFullPage={props.onPlaceFullPage} onUsed={refresh} />
      </div>
      <div className="shrink-0">
        <SeriesSection onSeriesStart={props.onSeriesStart} onAppendImagePage={props.onAppendImagePage} onUsed={refresh} />
      </div>
      <Card className="shrink-0 p-4">
        <AiGeneratePanel onPickStamp={props.onPickStamp} onUsed={refresh} />
      </Card>
    </aside>
  );
}
