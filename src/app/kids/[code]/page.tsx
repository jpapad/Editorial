"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// ssr:false — the board is Konva (browser only), and who's signed in lives in this device's storage.
const KidsGroupApp = dynamic(() => import("@/components/kids/KidsGroupApp"), { ssr: false });

export default function KidsGroupPage() {
  return (
    <Suspense>
      <KidsGroupApp />
    </Suspense>
  );
}
