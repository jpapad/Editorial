import Button from "@/components/studio/ui/Button";
import { PLACEHOLDER_ART_PATTERN } from "@/components/studio/ui/Thumbnail";
import { useT } from "@/lib/i18n";

export interface EmptyLibraryScreenProps {
  onNewBook?: () => void;
  onFromTemplate?: () => void;
  onImportSketch?: () => void;
  onViewSample?: () => void;
}

const FAN_ROTATIONS = [-6, 0, 6];

/** 3f: empty library (620x440) — three fanned page cards, then the three entry points onboarding funnels into. */
export default function EmptyLibraryScreen({ onNewBook, onFromTemplate, onImportSketch, onViewSample }: EmptyLibraryScreenProps) {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-5 rounded-panel bg-panel p-8 shadow-panel" style={{ width: 620, height: 440 }}>
      <div className="relative flex h-[110px] w-full items-center justify-center">
        {FAN_ROTATIONS.map((deg, i) => (
          <div
            key={deg}
            className="absolute rounded-paper-sm bg-panel shadow-toolbar"
            style={{
              width: 70,
              height: 92,
              transform: `rotate(${deg}deg) translateX(${(i - 1) * 74}px)`,
              backgroundImage: i === 1 ? PLACEHOLDER_ART_PATTERN : undefined,
            }}
          />
        ))}
      </div>

      <div>
        <h1 className="text-page-title font-semibold tracking-[-0.02em] text-ink">{t("Let's make your first book")}</h1>
        <p className="mt-2 max-w-md text-body text-ink-secondary">{t("Start from something ready-made or bring your own drawing. We take care of sizes and export.")}</p>
      </div>

      <div className="flex items-center gap-2.5">
        <Button variant="primary" onClick={onNewBook}>
          {t("New book")}
        </Button>
        <Button variant="secondary" onClick={onFromTemplate}>
          {t("From a template")}
        </Button>
        <Button variant="secondary" onClick={onImportSketch}>
          {t("Import a sketch")}
        </Button>
      </div>

      <button type="button" onClick={onViewSample} className="flex items-center gap-1.5 text-helper text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
        <span className="h-1.5 w-1.5 rounded-pill bg-accent" aria-hidden />
        {t("See a 6-page sample book")}
      </button>
    </div>
  );
}
