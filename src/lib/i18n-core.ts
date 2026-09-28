// The React-free half of i18n.tsx, so pure modules (page templates,
// worksheet generators) and tests can translate too.

import { EL } from "@/lib/i18n-el";

export type Lang = "el" | "en";

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const template = lang === "el" ? (EL[key] ?? key) : key;
  return vars ? template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : template;
}

/** English as-is (with placeholders filled) — the default for generators called without a translator. */
export const identityT: TFunction = (key, vars) => translate("en", key, vars);
