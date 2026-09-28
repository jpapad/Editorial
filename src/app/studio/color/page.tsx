"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — ColoringView reads the real ?book=/?page= synchronously on
// first render, then fetches the book from Supabase — same hydration-
// mismatch reasoning as the editor/library routes (see src/app/page.tsx's
// comment).
const ColoringView = dynamic(() => import("@/components/studio/coloring/ColoringView"), { ssr: false });

export default function StudioColorPage() {
  return (
    <RequireAuth>
      <ColoringView />
    </RequireAuth>
  );
}
