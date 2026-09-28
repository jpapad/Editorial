"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { ENGLISH_ALPHABET_PAIRS, GREEK_ALPHABET_PAIRS } from "@/components/TracingGrid";
import { DEFAULT_BOOK_SETTINGS } from "@/types/book";
import type { BookSettings, BookState, CanvasElement, PageSpread } from "@/types/book";

export type WizardAlphabet = "english" | "greek";

export interface BookWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (book: BookState) => void;
}

interface TrimSizeOption {
  label: string;
  widthIn: number;
  heightIn: number;
}

const TRIM_SIZE_OPTIONS: TrimSizeOption[] = [
  { label: "8.5\" x 11\" (Letter)", widthIn: 8.5, heightIn: 11 },
  { label: "8.5\" x 8.5\" (Square)", widthIn: 8.5, heightIn: 8.5 },
  { label: "6\" x 9\"", widthIn: 6, heightIn: 9 },
];

const THEME_SUGGESTIONS = ["Ocean", "Space", "Dinosaurs", "Farm Animals"];

// Only "Ocean" + English has curated vocabulary and matching art seeded in
// below. Every other alphabet/theme combination gets an honest per-letter
// placeholder rather than fabricated content — Greek vocabulary
// specifically is deliberately NOT invented here, since generating
// possibly-incorrect foreign-language words is a worse failure mode than
// an honest "pending" placeholder.
const OCEAN_VOCAB_ENGLISH: Record<string, string> = {
  A: "Anemone", B: "Blowfish", C: "Crab", D: "Dolphin", E: "Eel", F: "Fish",
  G: "Grouper", H: "Hermit Crab", I: "Isopod", J: "Jellyfish", K: "Krill",
  L: "Lobster", M: "Manatee", N: "Narwhal", O: "Octopus", P: "Puffer",
  Q: "Queen Angelfish", R: "Ray", S: "Starfish", T: "Turtle", U: "Urchin",
  V: "Viperfish", W: "Walrus", X: "X-ray Tetra", Y: "Yellowtail", Z: "Zebra Shark",
};

const JELLYFISH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <ellipse cx="100" cy="80" rx="55" ry="45" fill="teal" stroke="teal" stroke-width="4" />
  <circle cx="82" cy="72" r="6" fill="black" />
  <circle cx="118" cy="72" r="6" fill="black" />
  <path d="M60 105 Q40 140 55 170" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M85 112 Q75 150 85 175" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M115 112 Q125 150 115 175" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
  <path d="M140 105 Q160 140 145 170" fill="none" stroke="teal" stroke-width="8" stroke-linecap="butt" />
</svg>`.trim();

function resolveVocabWord(alphabet: WizardAlphabet, theme: string, letter: string): string {
  if (alphabet === "english" && theme.trim().toLowerCase() === "ocean") {
    return OCEAN_VOCAB_ENGLISH[letter] ?? `${letter}-word`;
  }
  return `${letter}-word`;
}

function resolveArt(alphabet: WizardAlphabet, theme: string, letter: string): string | null {
  if (alphabet === "english" && theme.trim().toLowerCase() === "ocean" && letter === "J") return JELLYFISH_SVG;
  return null;
}

/** Exported so utils/preflightChecker.ts's MISSING_ASSET check can detect placeholder art by the exact marker text, instead of a second, drift-prone copy of this string. */
export const PLACEHOLDER_ART_MARKER = "Illustration pending:";

/** Honest "no art yet" placeholder — still real SVG_MAIN_ART content (proves the pipeline), never fabricated/mismatched clip art. */
function buildPlaceholderArtSvg(label: string, widthIn: number, heightIn: number): string {
  const w = widthIn * 100;
  const h = heightIn * 100;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect x="${w * 0.05}" y="${h * 0.05}" width="${w * 0.9}" height="${h * 0.9}" rx="12" fill="none" stroke="black" stroke-width="3" stroke-dasharray="12 8" />
  <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.045}" fill="black">${PLACEHOLDER_ART_MARKER}</text>
  <text x="${w / 2}" y="${h / 2 + w * 0.07}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${w * 0.06}" font-weight="bold" fill="black">${label}</text>
</svg>`.trim();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildSpread(spreadNumber: number, letter: string, pairLabel: string, vocabWord: string, artSvg: string | null, settings: BookSettings): PageSpread {
  const leftSafeWidth = settings.trimWidthIn - settings.outerMarginIn - settings.gutterIn;
  const rightSafeWidth = settings.trimWidthIn - settings.gutterIn - settings.outerMarginIn;
  const artSize = Math.min(leftSafeWidth, settings.trimHeightIn * 0.5) * 0.85;

  const leftElements: CanvasElement[] = [
    {
      id: makeId("title"),
      type: "TITLE_TEXT",
      x: settings.outerMarginIn,
      y: 0.35,
      width: leftSafeWidth,
      height: 0.6,
      rotation: 0,
      text: `${letter} is for ${vocabWord}`,
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 26,
      align: "center",
      fill: "#000000",
    },
    {
      id: makeId("art"),
      type: "SVG_MAIN_ART",
      x: settings.outerMarginIn + (leftSafeWidth - artSize) / 2,
      y: 1.4,
      width: artSize,
      height: artSize,
      rotation: 0,
      svgMarkup: artSvg ?? buildPlaceholderArtSvg(vocabWord, artSize, artSize),
      strokeWidth: settings.globalStrokeWidthPt,
    },
  ];

  const rightElements: CanvasElement[] = [
    {
      id: makeId("letter-guide"),
      type: "LETTER_GUIDE",
      x: settings.gutterIn + (rightSafeWidth - 3) / 2,
      y: 0.4,
      width: 3,
      height: 2.8,
      rotation: 0,
      letter,
      fontFamily: "Arial, Helvetica, sans-serif",
      guideStyle: "hollow",
      strokeArrows: [{ order: 1, x: 1.5, y: 0.1, rotation: 0 }],
    },
    {
      id: makeId("tracing-grid"),
      type: "TRACING_GRID",
      x: settings.gutterIn,
      y: 3.5,
      width: rightSafeWidth,
      height: 2.7,
      rotation: 0,
      letter: pairLabel,
      fontFamily: "Arial, Helvetica, sans-serif",
      rows: 3,
      repeatsPerRow: 5,
      firstInstanceSolid: true,
    },
  ];

  return {
    id: makeId("spread"),
    spreadNumber,
    leftPage: { id: makeId("page"), elements: leftElements },
    rightPage: { id: makeId("page"), elements: rightElements },
  };
}

/**
 * Builds the complete BookState for a wizard selection. English produces
 * 26 spreads (52 pages); Greek produces 24 spreads (48 pages) — the output
 * scales with however many letters the chosen alphabet actually has,
 * rather than forcing a fixed "52" regardless of alphabet.
 */
export function generateBookFromWizard(alphabet: WizardAlphabet, theme: string, trim: TrimSizeOption): BookState {
  const pairs = alphabet === "english" ? ENGLISH_ALPHABET_PAIRS : GREEK_ALPHABET_PAIRS;
  const settings: BookSettings = { ...DEFAULT_BOOK_SETTINGS, trimWidthIn: trim.widthIn, trimHeightIn: trim.heightIn };

  const spreads = pairs.map((pairLabel, index) => {
    const letter = pairLabel.split(" ")[0];
    const vocabWord = resolveVocabWord(alphabet, theme, letter);
    const art = resolveArt(alphabet, theme, letter);
    return buildSpread(index + 1, letter, pairLabel, vocabWord, art, settings);
  });

  const themeLabel = theme.trim() || "My";
  const alphabetLabel = alphabet === "greek" ? "Greek Alphabet" : "Alphabet";

  return {
    id: makeId("book"),
    title: `${themeLabel} ${alphabetLabel} Coloring & Tracing Book`,
    settings,
    spreads,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

type WizardStep = 1 | 2 | 3;

/** A-to-Z Book Wizard: a 3-step modal (alphabet, theme, trim size) that generates a complete BookState on confirm. */
export default function BookWizard({ isOpen, onClose, onGenerate }: BookWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [alphabet, setAlphabet] = useState<WizardAlphabet>("english");
  const [theme, setTheme] = useState("Ocean");
  const [trimIndex, setTrimIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const letterCount = alphabet === "english" ? ENGLISH_ALPHABET_PAIRS.length : GREEK_ALPHABET_PAIRS.length;

  function handleGenerate() {
    setIsGenerating(true);
    const book = generateBookFromWizard(alphabet, theme, TRIM_SIZE_OPTIONS[trimIndex]);
    setIsGenerating(false);
    onGenerate(book);
    setStep(1);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">A-to-Z Book Wizard</h2>
          <button type="button" onClick={onClose} aria-label="Close wizard" className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2">
          {([1, 2, 3] as WizardStep[]).map((s) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full", s <= step ? "bg-indigo-500" : "bg-slate-200")} />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">Choose an alphabet</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAlphabet("english")}
                className={cn("rounded-lg border-2 p-4 text-left", alphabet === "english" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300")}
              >
                <p className="font-semibold text-slate-900">English</p>
                <p className="text-xs text-slate-500">A–Z, 26 letters</p>
              </button>
              <button
                type="button"
                onClick={() => setAlphabet("greek")}
                className={cn("rounded-lg border-2 p-4 text-left", alphabet === "greek" ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300")}
              >
                <p className="font-semibold text-slate-900">Greek</p>
                <p className="text-xs text-slate-500">Α–Ω, 24 letters</p>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Theme
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                list="wizard-theme-suggestions"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
                placeholder="e.g. Ocean"
              />
              <datalist id="wizard-theme-suggestions">
                {THEME_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <p className="text-xs text-slate-500">
              Only &quot;Ocean&quot; (English) has curated vocabulary and matching art seeded in. Other themes get
              real structure with honest &quot;illustration pending&quot; placeholders instead of mismatched art.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-slate-700">Trim size</p>
            <div className="flex flex-col gap-2">
              {TRIM_SIZE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setTrimIndex(i)}
                  className={cn("rounded-md border-2 px-3 py-2 text-left text-sm", trimIndex === i ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300")}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              Will generate <strong>{letterCount} spreads ({letterCount * 2} pages)</strong> for the{" "}
              {alphabet === "english" ? "English" : "Greek"} alphabet, themed &quot;{theme || "Untitled"}&quot;.
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
            disabled={step === 1}
            className="rounded-md px-3 py-2 text-sm text-slate-500 disabled:opacity-0"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70"
            >
              <Sparkles size={16} />
              {isGenerating ? "Generating…" : `Generate ${letterCount * 2}-Page Book`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
