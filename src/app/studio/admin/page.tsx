"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — same reasoning as /studio: the screen's content comes from
// client-side Supabase reads that depend on the signed-in session.
const AdminScreen = dynamic(() => import("@/components/studio/screens/AdminScreen"), { ssr: false });

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminScreen />
    </RequireAuth>
  );
}
