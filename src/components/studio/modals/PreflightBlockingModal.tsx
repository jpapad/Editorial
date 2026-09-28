import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import StatusDot from "@/components/studio/ui/StatusDot";
import Thumbnail from "@/components/studio/ui/Thumbnail";
import { useT } from "@/lib/i18n";

export interface PreflightIssue {
  severity: "blocking" | "warning";
  cause: string;
  explanation: string;
  autoFixLabel: string;
  onAutoFix?: () => void;
}

export interface FlaggedPage {
  ringColor: "error" | "warning";
  label: string;
}

export interface PreflightBlockingModalProps {
  issues?: PreflightIssue[];
  flaggedPages?: FlaggedPage[];
  onExport?: () => void;
}

const DEFAULT_ISSUES: PreflightIssue[] = [
  { severity: "blocking", cause: "Σελίδα 12 — η εικόνα μπαίνει στο bleed", explanation: "Θα κοπεί στο κόψιμο. Σμίκρυνε 4% ή μετακίνησε 3 mm.", autoFixLabel: "Διόρθωσε αυτόματα" },
  { severity: "blocking", cause: "Σύνολο σελίδων: 22", explanation: "Το saddle stitch θέλει πολλαπλάσιο του 4.", autoFixLabel: "Πρόσθεσε 2 λευκές" },
  { severity: "warning", cause: "4 γραμμές κάτω από 0.5 pt", explanation: "Προειδοποίηση — θα τυπωθούν αχνές.", autoFixLabel: "Πάχυνε όλες" },
];

const DEFAULT_FLAGGED: FlaggedPage[] = [
  { ringColor: "error", label: "12 BLEED" },
  { ringColor: "warning", label: "05 ΛΕΠΤΕΣ" },
];

/**
 * 3e: preflight blocking export (620x480). "Rules encoded" per the
 * README (bleed intrusion + non-multiple-of-4 page count = blocking,
 * strokes < 0.5pt = warning) match the same checks this repo already has
 * real logic for elsewhere (utils/preflightChecker.ts, Sprint 3/6) — this
 * screen is presentation only, not a second implementation of those
 * rules; wiring it to real book data is a natural follow-up, not part of
 * this build's screen/layout steps.
 */
export default function PreflightBlockingModal({ issues = DEFAULT_ISSUES, flaggedPages = DEFAULT_FLAGGED, onExport }: PreflightBlockingModalProps) {
  const blockingCount = issues.filter((i) => i.severity === "blocking").length;
  const exportEnabled = blockingCount === 0;
  const t = useT();

  return (
    <div className="flex flex-col gap-4 rounded-panel bg-panel p-5 shadow-panel" style={{ width: 620, height: 480 }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-modal-title font-semibold tracking-[-0.02em] text-ink">{t("Pre-export check")}</p>
          <MetaLabel tone="error">
            {t("{issues} issues · {blocking} blocking export", { issues: issues.length, blocking: blockingCount })}
          </MetaLabel>
        </div>
        <Button variant="primary" disabled={!exportEnabled} onClick={onExport}>
          {t("Export")}
        </Button>
      </div>

      <div className="flex flex-1 gap-4">
        <div className="flex flex-1 flex-col gap-2.5">
          {issues.map((issue) => (
            <Card key={issue.cause} className="flex items-start gap-2.5 p-3.5">
              <StatusDot tone={issue.severity === "blocking" ? "error" : "warning"} className="mt-1.5" />
              <div className="flex-1">
                <p className="text-body font-medium text-ink">{issue.cause}</p>
                <p className="mt-0.5 text-helper text-ink-secondary">{issue.explanation}</p>
                <button type="button" onClick={issue.onAutoFix} className="mt-1.5 text-helper font-medium text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  {issue.autoFixLabel}
                </button>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex w-[150px] shrink-0 flex-col gap-2.5">
          <MetaLabel>{t("Pages with issues")}</MetaLabel>
          <div className="flex gap-2">
            {flaggedPages.map((page) => (
              <div key={page.label} className="flex flex-col items-center gap-1">
                <Thumbnail style={{ width: 60, height: 78, boxShadow: `0 0 0 2px var(--color-${page.ringColor})` }} />
                <MetaLabel tone={page.ringColor}>{page.label}</MetaLabel>
              </div>
            ))}
          </div>
          <Card tone="accent" className="p-3">
            <p className="text-helper text-ink-secondary">
              {blockingCount === 0 ? t("Nothing blocking — you can export, or fix the warnings first.") : blockingCount === 1 ? t("Fix the blocking issue to enable export.") : t("Fix the {n} blocking issues to enable export.", { n: blockingCount })}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
