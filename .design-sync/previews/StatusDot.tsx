import { StatusDot } from "@pagewright/ui";

/** Markers beside pre-flight issues and AI results; always paired with text. */
export const IssueList = () => (
  <div className="flex flex-col gap-2.5 rounded-panel bg-panel p-4 shadow-panel" style={{ width: 280 }}>
    {[
      ["error", "Page 3: art crosses the trim line"],
      ["warning", "Page 7: lines thinner than 1 pt"],
      ["success", "All pages at 300 dpi"],
    ].map(([tone, text]) => (
      <div key={text} className="flex items-center gap-2">
        <StatusDot tone={tone as "error" | "warning" | "success"} />
        <span className="text-body text-ink">{text}</span>
      </div>
    ))}
  </div>
);

export const AllTones = () => (
  <div className="flex items-center gap-4">
    {(["success", "warning", "error", "accent", "muted"] as const).map((tone) => (
      <span key={tone} className="inline-flex items-center gap-1.5 text-helper text-ink-secondary">
        <StatusDot tone={tone} />
        {tone}
      </span>
    ))}
  </div>
);
