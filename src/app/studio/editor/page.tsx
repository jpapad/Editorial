"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — see src/app/page.tsx for why (reads ?book=/?mode= synchronously on first render, then fetches the book from Supabase).
const EditorShell = dynamic(() => import("@/components/studio/editor/EditorShell"), { ssr: false });

export default function StudioEditorPage() {
  return (
    <RequireAuth>
      <EditorShell />
    </RequireAuth>
  );
}
