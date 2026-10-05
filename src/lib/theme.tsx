"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the switch still works for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The active theme. <html data-theme> is the source of truth (set before paint by the inline script). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}

/** Sun / moon switch. The active option is the pressed one. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const t = useT();
  const option = (value: Theme, label: string, Icon: typeof Sun) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={theme === value}
      onClick={() => setTheme(value)}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-[9px] outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent",
        theme === value ? "bg-panel text-ink shadow-resting" : "text-ink-muted hover:text-ink"
      )}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
  return (
    <div role="group" aria-label={t("Theme")} className={cn("flex rounded-[12px] bg-inset p-[3px]", className)}>
      {option("light", t("Light theme"), Sun)}
      {option("dark", t("Dark theme"), Moon)}
    </div>
  );
}
