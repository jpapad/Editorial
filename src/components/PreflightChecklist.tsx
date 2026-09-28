"use client";

import { CheckCircle2, CircleAlert, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";
import type { PreflightIssue, PreflightCode } from "@/utils/preflightChecker";

export interface PreflightChecklistProps {
  issues: PreflightIssue[];
  onSelectIssue?: (issue: PreflightIssue) => void;
}

interface CategoryDef {
  code: PreflightCode;
  label: string;
  passLabel: string;
}

/**
 * The four Sprint 6 production checks, plus the Sprint 3 checks already
 * covered by PreflightPanel/runPreflightCheck — a "ready to export?" gate
 * should show the whole book's production readiness, not just the new
 * categories, since dropping the older ones here would make this view
 * less complete than the floating drawer it sits alongside.
 */
const CATEGORIES: CategoryDef[] = [
  { code: "TEXT_NOT_OUTLINED", label: "Font outline conversion", passLabel: "Font embedding confirmed for print" },
  { code: "TRANSPARENCY", label: "Zero-transparency compliance", passLabel: "All colors fully opaque" },
  { code: "MISSING_ASSET", label: "Missing assets", passLabel: "No missing or placeholder art" },
  { code: "THIN_STROKE", label: "Minimum line weight", passLabel: "All strokes meet the 0.75pt minimum" },
  { code: "SAFE_ZONE", label: "Bleed / gutter / margin safe zones", passLabel: "All content clear of safe zones" },
  { code: "NON_GRAYSCALE_COLOR", label: "Grayscale compliance", passLabel: "All interior colors grayscale" },
];

/**
 * A production-readiness gate, meant to sit right before an "Export to
 * PDF" action — grouped by check category with an overall pass/fail
 * verdict, unlike PreflightPanel's flat, always-available floating list of
 * every individual issue. Both read the same PreflightIssue[] from
 * runPreflightCheck(); this is a different VIEW of the same data; not a
 * second checker.
 */
export default function PreflightChecklist({ issues, onSelectIssue }: PreflightChecklistProps) {
  const byCode = new Map<PreflightCode, PreflightIssue[]>();
  for (const issue of issues) {
    byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);
  }

  const hasBlockingError = issues.some((i) => i.severity === "error");
  const hasAnyIssue = issues.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold",
          !hasAnyIssue ? "bg-emerald-50 text-emerald-700" : hasBlockingError ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
        )}
      >
        {hasBlockingError ? <CircleAlert size={16} /> : hasAnyIssue ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
        {hasBlockingError ? "Not ready — blocking errors found" : hasAnyIssue ? "Ready, with warnings to review" : "Ready to export"}
      </div>

      <ul className="flex flex-col divide-y divide-slate-100">
        {CATEGORIES.map(({ code, label, passLabel }) => {
          const categoryIssues = byCode.get(code) ?? [];
          const passed = categoryIssues.length === 0;
          const worstSeverity = categoryIssues.some((i) => i.severity === "error") ? "error" : categoryIssues.length > 0 ? "warning" : null;

          return (
            <li key={code} className="py-2">
              <div className="flex items-center gap-2 text-sm">
                {passed ? (
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                ) : worstSeverity === "error" ? (
                  <CircleAlert size={15} className="shrink-0 text-red-500" />
                ) : (
                  <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                )}
                <span className="font-medium text-slate-700">{label}</span>
                {!passed && (
                  <span className="text-xs text-slate-400">
                    ({categoryIssues.length} issue{categoryIssues.length === 1 ? "" : "s"})
                  </span>
                )}
              </div>

              {passed ? (
                <p className="mt-0.5 pl-6 text-xs text-slate-400">{passLabel}</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1 pl-6">
                  {categoryIssues.map((issue) => (
                    <li key={issue.id}>
                      <button
                        type="button"
                        onClick={() => onSelectIssue?.(issue)}
                        className="text-left text-xs text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        {issue.spreadNumber === 0 ? "Book-wide" : `Spread ${issue.spreadNumber} (${issue.side})`}: {issue.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
