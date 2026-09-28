"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronUp, CircleAlert, X } from "lucide-react";
import { cn } from "@/utils/cn";
import type { PreflightIssue } from "@/utils/preflightChecker";

export interface PreflightPanelProps {
  issues: PreflightIssue[];
  onSelectIssue?: (issue: PreflightIssue) => void;
  /** Starts open — mainly for demos/screenshots; real usage should default to closed (the default) so it doesn't cover the editor. */
  defaultOpen?: boolean;
}

const CODE_LABEL: Record<PreflightIssue["code"], string> = {
  SAFE_ZONE: "Safe zone",
  THIN_STROKE: "Thin stroke",
  NON_GRAYSCALE_COLOR: "Non-grayscale color",
  MISSING_ASSET: "Missing asset",
  TRANSPARENCY: "Transparency",
  TEXT_NOT_OUTLINED: "Font embedding",
};

/** Book-level checks (see checkFontOutlining in preflightChecker.ts) use spreadNumber 0 as a sentinel rather than adding a separate optional field just for this one case. */
function locationLabel(issue: PreflightIssue): string {
  return issue.spreadNumber === 0 ? "Book-wide" : `Spread ${issue.spreadNumber} (${issue.side})`;
}

/**
 * A floating, collapsible drawer showing real-time Pre-Flight results.
 * Fixed to the viewport corner so it stays reachable while the author
 * scrolls/edits, rather than a static panel competing for layout space —
 * re-run runPreflightCheck() on every BookState change and pass the result
 * in as `issues` for live inspection.
 */
export default function PreflightPanel({ issues, onSelectIssue, defaultOpen = false }: PreflightPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const hasIssues = issues.length > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex max-h-96 w-96 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700">
              Pre-Flight Inspection
              {hasIssues && (
                <span className="ml-1.5 font-normal text-slate-400">
                  ({errors.length} error{errors.length === 1 ? "" : "s"}, {warnings.length} warning{warnings.length === 1 ? "" : "s"})
                </span>
              )}
            </p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close pre-flight panel" className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-auto p-2">
            {!hasIssues ? (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 size={16} />
                No issues found.
              </div>
            ) : (
              <ul className="flex flex-col gap-1">
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
                          {locationLabel(issue)} — {CODE_LABEL[issue.code]}:
                        </span>{" "}
                        <span className="text-slate-500">{issue.message}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors",
          !hasIssues ? "bg-emerald-600 hover:bg-emerald-500" : errors.length > 0 ? "bg-red-600 hover:bg-red-500" : "bg-amber-500 hover:bg-amber-400"
        )}
      >
        {hasIssues ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
        {hasIssues ? `${issues.length} issue${issues.length === 1 ? "" : "s"}` : "Pre-flight OK"}
        <ChevronUp size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>
    </div>
  );
}
