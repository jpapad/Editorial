"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — joining needs the signed-in session (client-side, like the rest of /studio).
const JoinBook = dynamic(() => import("@/components/studio/screens/JoinBook"), { ssr: false });

export default function JoinPage() {
  return (
    <RequireAuth>
      <JoinBook />
    </RequireAuth>
  );
}
