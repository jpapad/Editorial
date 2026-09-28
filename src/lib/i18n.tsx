"use client";

// UI language for the studio: Greek (default) or English.
//
// Keys are the English text itself — t("Undo") — so English needs no table
// and a missing Greek entry degrades to readable English instead of a raw
// key. Placeholders use {name}: t("{n} objects", { n: 3 }). The Greek table
// lives in i18n-el.ts; scripts/check-i18n (see the repo notes) lists any
// t("…") key that has no Greek entry.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type Lang, type TFunction } from "@/lib/i18n-core";

export { translate, type Lang, type TFunction };

const STORAGE_KEY = "pagewright-lang";
const DEFAULT_LANG: Lang = "el";

function readStoredLang(): Lang {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "el" ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // localStorage is browser-only: read it after mount so server and first client render agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage after hydration
    setLangState(readStoredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode etc. — the choice just won't be remembered.
    }
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

/** Current language + setter. Outside a provider (e.g. a bare harness route) it's the default, read-only. */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? { lang: DEFAULT_LANG, setLang: () => {} };
}

export function useT(): TFunction {
  const { lang } = useLanguage();
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}

/** EL | EN switch. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  return (
    <div role="radiogroup" aria-label="Language / Γλώσσα" className={`inline-flex rounded-pill bg-inset p-[3px] ${className ?? ""}`}>
      {(["el", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          onClick={() => setLang(l)}
          className={`rounded-pill px-2 py-0.5 font-pw-mono text-mono font-medium uppercase tracking-[0.09em] outline-none focus-visible:ring-2 focus-visible:ring-accent ${lang === l ? "bg-ink text-white" : "text-ink-secondary hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
