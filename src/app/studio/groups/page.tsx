"use client";

import dynamic from "next/dynamic";
import RequireAuth from "@/components/studio/RequireAuth";

// ssr:false — same reasoning as /studio/admin: everything on it is the signed-in user's own data.
const GroupsScreen = dynamic(() => import("@/components/studio/screens/GroupsScreen"), { ssr: false });

export default function GroupsPage() {
  return (
    <RequireAuth>
      <GroupsScreen />
    </RequireAuth>
  );
}
