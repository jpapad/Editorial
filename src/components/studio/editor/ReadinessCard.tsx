"use client";

import Card from "@/components/studio/ui/Card";
import StatusDot from "@/components/studio/ui/StatusDot";
import { cn } from "@/utils/cn";
import { useT, type TFunction } from "@/lib/i18n";
import { KDP_MIN_PAGES, type Readiness, type ReadinessCheck, type ReadinessItem, type ReadinessLevel } from "@/utils/readiness";

const LEVEL_COLOR: Record<ReadinessLevel, string> = { ready: "var(--color-success)", almost: "var(--color-warning)", work: "var(--color-error)" };

/** The score as a ring. `size` in px. */
export function ReadinessRing({ score, level, size = 56 }: { score: number; level: ReadinessLevel; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-pill"
      style={{ width: size, height: size, background: `conic-gradient(${LEVEL_COLOR[level]} 0 ${score}%, var(--color-inset) ${score}% 100%)` }}
      aria-hidden
    >
      <span className="flex items-center justify-center rounded-pill bg-panel font-extrabold text-ink" style={{ width: size - 12, height: size - 12, fontSize: size * 0.28 }}>
        {score}
      </span>
    </span>
  );
}

export function readinessLabel(level: ReadinessLevel, t: TFunction) {
  return level === "ready" ? t("Ready to print") : level === "almost" ? t("Almost ready to print") : t("Needs work before print");
}

function itemText(item: ReadinessItem, t: TFunction): string {
  switch (item.id) {
    case "min-pages":
      return item.ok ? t("At least {n} pages", { n: KDP_MIN_PAGES }) : t("{n} of {min} pages KDP needs", { n: item.count, min: KDP_MIN_PAGES });
    case "page-count":
      return item.ok ? t("Page count is a multiple of 4") : t("Page count isn't a multiple of 4");
    case "thin-strokes":
      return item.ok ? t("No faint lines") : t("{n} lines below 3pt", { n: item.count });
    case "margin":
      return item.ok ? t("Everything inside the safe margin") : item.count === 1 ? t("1 page past the safe margin") : t("{n} pages past the safe margin", { n: item.count });
    case "empty-pages":
      return item.ok ? t("No empty pages") : item.count === 1 ? t("1 empty page") : t("{n} empty pages", { n: item.count });
    case "look-alikes":
      return item.ok ? t("No look-alike pages") : item.count === 1 ? t("1 page looks almost like an earlier one") : t("{n} pages look almost like earlier ones", { n: item.count });
    case "style":
      return item.ok ? t("Pages match in style") : item.count === 1 ? t("1 page looks unlike the rest (line thickness or detail)") : t("{n} pages look unlike the rest (line thickness or detail)", { n: item.count });
    case "duplicates":
      return item.ok ? t("No repeated pages") : item.count === 1 ? t("1 page repeats an earlier one") : t("{n} pages repeat earlier ones", { n: item.count });
  }
}

export interface ReadinessCardProps {
  readiness: Readiness;
  /** One-click repairs, by check. Checks without one get "Go to page" when they point at pages. */
  fixes: Partial<Record<ReadinessCheck, () => void>>;
  onGoToPage: (pageId: string) => void;
}

/** The editor's "is this book ready to print?" card: a 0–100 score and what's holding it back. */
export default function ReadinessCard({ readiness, fixes, onGoToPage }: ReadinessCardProps) {
  const t = useT();
  const open = readiness.items.filter((i) => !i.ok);
  const action = "shrink-0 rounded-pill px-2.5 py-1 text-helper font-semibold text-accent outline-none hover:bg-accent-tint focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <Card className="flex shrink-0 flex-col gap-3 p-4" style={{ contain: "layout" }}>
      <div className="flex items-center gap-3.5">
        <ReadinessRing score={readiness.score} level={readiness.level} />
        <div className="min-w-0">
          <p className="text-card-title font-bold text-ink">{readinessLabel(readiness.level, t)}</p>
          <p className="text-helper text-ink-muted">{open.length === 0 ? t("Every print check passes.") : open.length === 1 ? t("1 thing to fix") : t("{n} things to fix", { n: open.length })}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2" aria-label={t("Print checks")}>
        {readiness.items.map((item) => {
          const fix = !item.ok ? fixes[item.id] : undefined;
          return (
            <li key={item.id} className={cn("flex items-center gap-2 text-helper", item.ok ? "text-ink-muted" : "text-ink")}>
              <StatusDot tone={item.ok ? "success" : item.penalty >= 10 ? "error" : "warning"} />
              <span className="min-w-0 flex-1">{itemText(item, t)}</span>
              {fix ? (
                <button type="button" onClick={fix} className={action}>
                  {t("Fix")}
                </button>
              ) : (
                !item.ok &&
                item.pageIds[0] && (
                  <button type="button" onClick={() => onGoToPage(item.pageIds[0])} className={action}>
                    {t("Go to page")}
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
