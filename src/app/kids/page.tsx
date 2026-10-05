"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle, useT } from "@/lib/i18n";
import { normalizeCode } from "@/utils/kidGroups";

/** /kids: a child types the code their teacher or parent gave them. */
export default function KidsJoinPage() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const ready = code.length === 6;

  return (
    <div data-theme="light" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#fff4d6] via-[#ffe6ef] to-[#dff1ff] p-6 text-ink">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>
      <span className="text-[64px]" aria-hidden>
        🖍️
      </span>
      <h1 className="text-center text-[34px] font-extrabold tracking-[-0.02em]">{t("Type your class code")}</h1>
      <form
        className="flex flex-col items-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) router.push(`/kids/${code}`);
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          aria-label={t("Class code")}
          placeholder="ABC123"
          className="w-[300px] rounded-[20px] border-4 border-white bg-white/90 px-4 py-3 text-center font-pw-mono text-[40px] font-bold tracking-[0.25em] text-ink shadow-resting outline-none placeholder:text-ink/20 focus-visible:border-accent"
        />
        <button type="submit" disabled={!ready} className="rounded-pill bg-accent px-10 py-3 text-[22px] font-bold text-white shadow-resting outline-none focus-visible:ring-4 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40">
          {t("Let's go!")}
        </button>
      </form>
      <p className="max-w-sm text-center text-body text-ink-secondary">{t("Your teacher or parent has the code. It has 6 letters and numbers.")}</p>
    </div>
  );
}
