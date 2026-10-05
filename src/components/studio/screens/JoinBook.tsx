"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { acceptInvite, isMissingCollaborators } from "@/utils/collaborators";

/** /studio/join/<token>: joins the book behind an invite link, then opens it. */
export default function JoinBook() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const t = useT();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    acceptInvite(token)
      .then((bookId) => {
        if (bookId) router.replace(`/studio/editor?book=${bookId}`);
        else setProblem(t("This invite link doesn't work any more. Ask the book's owner for a new one."));
      })
      .catch((err: Error) => setProblem(isMissingCollaborators(err.message) ? t("Working together isn't set up yet — run sql/11_book_members.sql in Supabase.") : t("Something went wrong. Try again in a moment.")));
  }, [token, router, t]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface p-8 text-center">
      <p className="text-body text-ink-secondary">{problem ?? t("Opening the book…")}</p>
      {problem && (
        <Link href="/studio" className="font-medium text-accent">
          {t("Back to the studio")}
        </Link>
      )}
    </div>
  );
}
