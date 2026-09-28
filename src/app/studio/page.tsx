"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — LibraryScreen reads the real book list (Supabase) inside an
// effect that flows into several `useState` reads keyed off it; same
// hydration-mismatch reasoning as the editor routes (src/app/page.tsx).
const LibraryScreen = dynamic(() => import("@/components/studio/screens/LibraryScreen"), { ssr: false });

// 2c — the real /studio root, as promised since Step 1's token-preview
// harness and Step 2's primitives-preview harness ("will be replaced by
// the library screen (2c) in Step 6").
export default function StudioPage() {
  return (
    <RequireAuth>
      <LibraryScreen />
    </RequireAuth>
  );
}
