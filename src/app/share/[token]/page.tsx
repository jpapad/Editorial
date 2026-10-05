"use client";

import dynamic from "next/dynamic";

// Public — no RequireAuth: anyone with the link can color. ssr:false for
// the same reason as /studio/color (Konva needs the browser).
const SharedColoring = dynamic(() => import("@/components/studio/coloring/SharedColoring"), { ssr: false });

export default function SharePage() {
  return <SharedColoring />;
}
