"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — see src/app/page.tsx for why.
const EditorShell = dynamic(() => import("@/components/studio/editor/EditorShell"), { ssr: false });

// Verification route for the 2a dark-canvas-surround variant — not a
// real product route, just lets the two states be checked side by side.
// Still wrapped in RequireAuth: EditorShell's autosave hits Supabase like
// any other editor route, and that throws without a session.
export default function StudioEditorDarkPage() {
  return (
    <RequireAuth>
      <EditorShell darkSurround />
    </RequireAuth>
  );
}
