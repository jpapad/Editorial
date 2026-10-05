"use client";

import dynamic from "next/dynamic";
import { LanguageProvider } from "@/lib/i18n";

// ssr:false, not a plain import: EditorShell reads the real ?book=/?mode=
// URL and localStorage synchronously in its very first render (see its
// own comment on why that has to be a pure lazy-init, not an effect).
// Server-rendering it would render the *no-book-yet* defaults (window is
// undefined on the server) while the client's first render immediately
// reads the real book — a guaranteed hydration mismatch for every
// existing-book URL. The whole tree is browser-only anyway (Konva +
// localStorage), so there's nothing worth prerendering here.
const EditorShell = dynamic(() => import("@/components/studio/editor/EditorShell"), { ssr: false });

// The merged Pagewright editor — 2b's chrome hosting the old editor's
// real drawing/export logic (see components/studio/editor/EditorShell.tsx
// for the full picture). Replaces the old components/editor/EditorShell,
// which is left in place, unused from this route, rather than deleted.
export default function Home() {
  return (
    <LanguageProvider>
      <EditorShell />
    </LanguageProvider>
  );
}
