"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — same reasoning as /studio/admin: everything on it is read
// client-side for the signed-in user.
const BillingScreen = dynamic(() => import("@/components/studio/screens/BillingScreen"), { ssr: false });

export default function BillingPage() {
  return (
    <RequireAuth>
      <BillingScreen />
    </RequireAuth>
  );
}
