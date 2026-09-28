"use client";

import { useState } from "react";
import Button from "@/components/studio/ui/Button";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";

interface Intent {
  id: string;
  title: string;
  description: string;
}

const INTENTS: Intent[] = [
  { id: "sell", title: "A book to print or sell", description: "Trim, bleed and spreads handled for you" },
  { id: "classroom", title: "Pages for my classroom", description: "Letter size, bold lines, one-click 30 copies" },
  { id: "convert", title: "Turn my artwork into line art", description: "Import a scan or PSD and trace it" },
  { id: "color", title: "Just color something", description: "Skip the editor, open a ready page" },
];

export interface OnboardingScreenProps {
  onContinue?: (intentId: string) => void;
  onSkip?: () => void;
}

/** 1j: onboarding, restyled to the light shell. Each intent row presets trim/line-weight/export defaults elsewhere (per the README) — this screen's job is just the selection UI, real defaults application happens where a book actually gets created. */
export default function OnboardingScreen({ onContinue, onSkip }: OnboardingScreenProps) {
  const [selected, setSelected] = useState(INTENTS[0].id);
  const t = useT();

  return (
    <div className="flex flex-col gap-5 rounded-panel bg-panel p-6 shadow-panel" style={{ width: 460 }}>
      <div>
        <MetaLabel>{t("Step 1 of 3")}</MetaLabel>
        <p className="mt-2 text-page-title font-semibold tracking-[-0.02em] text-ink">{t("What are you making today?")}</p>
        <p className="mt-1.5 text-body text-ink-secondary">{t("We'll preset your page size, line weights and export defaults. You can change all of it later.")}</p>
      </div>

      <div className="flex flex-col gap-2">
        {INTENTS.map((intent) => {
          const active = intent.id === selected;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => setSelected(intent.id)}
              className={cn(
                "flex items-center gap-3 rounded-row-sm border px-3.5 py-3 text-left outline-none transition-colors duration-150 motion-reduce:transition-none",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                active ? "border-accent bg-accent-tint" : "border-hairline hover:bg-inset-alt"
              )}
            >
              <span className={cn("h-8 w-8 shrink-0 rounded-row-sm", active ? "bg-accent" : "bg-inset")} aria-hidden />
              <span>
                <span className="block text-body font-medium text-ink">{t(intent.title)}</span>
                <span className="block text-helper text-ink-muted">{t(intent.description)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="dark" onClick={() => onContinue?.(selected)}>
          {t("Continue")}
        </Button>
        <button type="button" onClick={onSkip} className="text-body text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          {t("Skip setup")}
        </button>
      </div>
    </div>
  );
}
