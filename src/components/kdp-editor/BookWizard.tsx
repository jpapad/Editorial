"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { FONT_PRESETS } from "@/lib/fontEngine";
import type { BookWizardConfig } from "@/types/kdpBook";

export interface BookWizardProps {
  onGenerate: (config: BookWizardConfig) => void;
  isGenerating?: boolean;
}

const TOPIC_SUGGESTIONS = ["Ocean", "Space", "Farm Animals", "Dinosaurs"];

export default function BookWizard({ onGenerate, isGenerating = false }: BookWizardProps) {
  const [topic, setTopic] = useState("Ocean");
  const [presetId, setPresetId] = useState(FONT_PRESETS[0].id);
  const [rows, setRows] = useState(3);
  const [repeatsPerRow, setRepeatsPerRow] = useState(6);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const preset = FONT_PRESETS.find((p) => p.id === presetId) ?? FONT_PRESETS[0];
    onGenerate({
      topic,
      characterSet: preset.characterSet,
      traceStyle: preset.traceStyle,
      fontFamily: preset.fontFamily,
      rows,
      repeatsPerRow,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Book Wizard</h2>
        <p className="text-xs text-slate-500">
          Generates a full alphabet spread — 26 letters, 52 pages — from a topic. Only &quot;Ocean&quot; has
          curated vocabulary + matching art seeded in; other topics get real structure with honest placeholder art.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Topic
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          list="topic-suggestions"
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
          placeholder="e.g. Ocean"
        />
        <datalist id="topic-suggestions">
          {TOPIC_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Trace font style
        <select
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
        >
          {FONT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Tracing rows
          <input
            type="number"
            min={1}
            max={6}
            value={rows}
            onChange={(e) => setRows(Number(e.target.value))}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Repeats per row
          <input
            type="number"
            min={2}
            max={10}
            value={repeatsPerRow}
            onChange={(e) => setRepeatsPerRow(Number(e.target.value))}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isGenerating}
        className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70"
      >
        <Sparkles size={16} />
        {isGenerating ? "Generating…" : "Generate 52-Page Book"}
      </button>
    </form>
  );
}
