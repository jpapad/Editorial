import { cn } from "@/utils/cn";

export type StatusDotTone = "success" | "warning" | "error" | "accent" | "muted";

export interface StatusDotProps {
  tone: StatusDotTone;
  className?: string;
}

const TONE_CLASS: Record<StatusDotTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  accent: "bg-accent",
  muted: "bg-hairline",
};

/** A small solid circle — blocking/warning/pass markers on Pre-Flight issue cards (3e) and AI failure reasons (3d). */
export default function StatusDot({ tone, className }: StatusDotProps) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-pill", TONE_CLASS[tone], className)} aria-hidden />;
}
