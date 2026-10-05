"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles, Undo2, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { isPrimaryModifier } from "@/components/studio/editor/keyboard";

export interface CommandOutcome {
  ok: boolean;
  reply: string;
  /** The page changed (so offering Undo makes sense). */
  changed: boolean;
}

export interface CommandBarProps {
  onRun: (command: string) => Promise<CommandOutcome>;
  onUndo: () => void;
  /** Progress line while a command runs (e.g. "Drawing picture 1 of 2…"). */
  status: string | null;
}

/**
 * "Describe what to change…" — the editor's AI command bar. ⌘/Ctrl K
 * focuses it; Enter runs; the reply stays until dismissed, with Undo when
 * the page changed (a command is a single undo step).
 */
export default function CommandBar({ onRun, onUndo, status }: CommandBarProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CommandOutcome | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPrimaryModifier(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function run() {
    const text = command.trim();
    if (!text || busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      const result = await onRun(text);
      setOutcome(result);
      if (result.ok) setCommand("");
    } catch (err) {
      setOutcome({ ok: false, reply: err instanceof Error ? err.message : t("The command failed"), changed: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto flex w-[min(640px,100%)] flex-col items-stretch gap-2">
      {(outcome || (busy && status)) && (
        <div role="status" className={cn("pw-glass flex items-start gap-2.5 rounded-[16px] px-4 py-2.5 text-helper shadow-toolbar", outcome && !outcome.ok ? "text-error" : "text-ink")}>
          {busy ? <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-accent" /> : <Sparkles size={15} className="mt-0.5 shrink-0 text-spark" />}
          <span className="min-w-0 flex-1">{busy ? status : outcome?.reply}</span>
          {!busy && outcome?.changed && (
            <button
              type="button"
              onClick={() => {
                onUndo();
                setOutcome(null);
              }}
              className="flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 font-semibold text-accent outline-none hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Undo2 size={13} />
              {t("Undo")}
            </button>
          )}
          {!busy && (
            <button type="button" aria-label={t("Dismiss")} onClick={() => setOutcome(null)} className="shrink-0 rounded-pill p-0.5 text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <form
        className="pw-glass flex h-14 items-center gap-3 rounded-[20px] pl-4 pr-2 shadow-toolbar focus-within:ring-2 focus-within:ring-accent"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Sparkles size={18} className="shrink-0 text-spark" aria-hidden />
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          maxLength={300}
          disabled={busy}
          aria-label={t("AI command")}
          placeholder={t("Describe what to change… e.g. “add a little crab bottom left”")}
          className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted disabled:opacity-60"
        />
        <kbd className="hidden shrink-0 rounded-[7px] bg-inset px-1.5 py-0.5 font-pw-mono text-mono text-ink-muted sm:block">⌘K</kbd>
        <button
          type="submit"
          aria-label={t("Run command")}
          disabled={busy || !command.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-spark-fill text-[#1a0e08] outline-none hover:brightness-95 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.4} />}
        </button>
      </form>
    </div>
  );
}
