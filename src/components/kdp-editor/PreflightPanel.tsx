import { AlertTriangle, CircleAlert, CheckCircle2 } from "lucide-react";
import type { PreflightIssue } from "@/lib/preflightChecker";

export interface PreflightPanelProps {
  issues: PreflightIssue[];
  onSelectIssue?: (issue: PreflightIssue) => void;
}

const CODE_LABEL: Record<PreflightIssue["code"], string> = {
  SAFE_ZONE_INTRUSION: "Safe zone",
  THIN_STROKE: "Thin stroke",
  NON_GRAYSCALE_COLOR: "Non-grayscale color",
};

export default function PreflightPanel({ issues, onSelectIssue }: PreflightPanelProps) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <CheckCircle2 size={16} />
        Pre-flight passed — no issues found.
      </div>
    );
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">
        Pre-flight: {errors.length} error{errors.length === 1 ? "" : "s"}, {warnings.length} warning
        {warnings.length === 1 ? "" : "s"}
      </p>
      <ul className="flex max-h-64 flex-col gap-1 overflow-auto">
        {issues.map((issue) => (
          <li key={issue.id}>
            <button
              type="button"
              onClick={() => onSelectIssue?.(issue)}
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-50"
            >
              {issue.severity === "error" ? (
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-red-500" />
              ) : (
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              )}
              <span>
                <span className="font-medium text-slate-700">
                  Spread {issue.spreadNumber} ({issue.side}) — {CODE_LABEL[issue.code]}:
                </span>{" "}
                <span className="text-slate-500">{issue.message}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
