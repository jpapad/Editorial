"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingScreen from "@/components/studio/screens/OnboardingScreen";
import RequireAuth from "@/components/studio/RequireAuth";
import { createPageFromTemplate } from "@/components/editor/pageTemplates";
import { interiorSpace } from "@/utils/pageGeometry";
import { createBook } from "@/utils/storage";
import { DEFAULT_TRIM_SIZE_ID, TRIM_SIZES } from "@/utils/trimSizes";
import { cn } from "@/utils/cn";
import type { PageTemplate } from "@/types/editor";
import { useT } from "@/lib/i18n";

// Each intent maps to a starting template — the only per-intent default
// this codebase actually implements. Line-weight / other export presets
// named in OnboardingScreen's own copy still have no real backing (no
// per-book stroke-width field exists), so those stay unsimulated — trim
// size is the one that's now real (see utils/trimSizes.ts).
const INTENT_TEMPLATES: Record<string, PageTemplate> = {
  sell: "blank",
  classroom: "blank",
  convert: "blank",
  color: "border-frame",
};

/**
 * Real entry point for "New book" — creates a book from the chosen
 * intent's template and trim size, then routes into the editor (or,
 * for "just color", straight into Color mode on that book). The trim
 * size row is added here rather than inside OnboardingScreen itself:
 * that component is the design handoff's own screen (intent selection
 * only) — this wraps it with the one extra real decision this app can
 * actually act on, rather than editing the handoff screen's own layout.
 */
export default function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingPageContent />
    </RequireAuth>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const [trimSize, setTrimSize] = useState(DEFAULT_TRIM_SIZE_ID);
  const t = useT();

  async function handleContinue(intentId: string) {
    try {
      const template = INTENT_TEMPLATES[intentId] ?? "blank";
      const book = await createBook(t("Untitled Book"), [createPageFromTemplate(1, interiorSpace(trimSize, false), template, t)], trimSize);
      const modeParam = intentId === "color" ? "&mode=color" : "";
      router.push(`/studio/editor?book=${book.id}${modeParam}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not create this book."));
    }
  }

  async function handleSkip() {
    try {
      const book = await createBook(t("Untitled Book"), [createPageFromTemplate(1, interiorSpace(trimSize, false))], trimSize);
      router.push(`/studio/editor?book=${book.id}`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not create this book."));
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-8">
      <OnboardingScreen onContinue={handleContinue} onSkip={handleSkip} />

      <div className="flex flex-col items-center gap-2" style={{ width: 460 }}>
        <p className="text-helper text-ink-muted">{t("Print trim size")}</p>
        <div className="flex gap-2">
          {TRIM_SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              onClick={() => setTrimSize(size.id)}
              className={cn(
                "rounded-row-sm border px-3 py-1.5 text-helper font-medium outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                trimSize === size.id ? "border-accent bg-accent-tint text-accent" : "border-hairline text-ink-secondary hover:bg-inset-alt"
              )}
            >
              {t(size.label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
