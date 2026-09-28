"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth";
import { useT } from "@/lib/i18n";

/**
 * Client-side route gate for the whole /studio tree — this app has no
 * server-rendered pages to protect at the middleware/server-component
 * level (every studio route is a ssr:false dynamic import, by design; see
 * src/app/page.tsx's own comment), so gating happens here instead: render
 * nothing meaningful until a session is confirmed, redirect to /login if
 * there isn't one. The real security boundary is Postgres RLS on `books`
 * (src/utils/storage.ts) — this is UX routing, not the thing that actually
 * stops one user from reading another's data.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-body text-ink-secondary">{t("Loading…")}</div>;
  }

  return <>{children}</>;
}
