"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { TFunction } from "@/lib/i18n";
import { addComment, deleteComment, isMissingCommentsTable, listComments, setCommentResolved, type PageComment } from "@/utils/comments";

/**
 * A book's page comments and whether the user is a supervisor. Both
 * degrade quietly: no migration yet means no comments table (a friendly
 * note in the panel), not an error. Changes are shown at once and rolled
 * back if the database refuses them.
 */
export function useBookComments(bookId: string, signedIn: boolean, sessionLoading: boolean, t: TFunction) {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);

  useEffect(() => {
    if (sessionLoading || !signedIn) return;
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data }) => {
      if (!cancelled) setIsSupervisor(data === true);
    });
    listComments(bookId)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(isMissingCommentsTable(err.message) ? "Comments aren't set up yet — run the page_comments migration in Supabase." : err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, signedIn, sessionLoading]);

  async function add(pageId: string, body: string) {
    try {
      const created = await addComment(bookId, pageId, body);
      setComments((prev) => [...prev, created]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("Could not post the comment."));
      throw err;
    }
  }

  function setResolved(id: string, resolved: boolean) {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved } : c)));
    setCommentResolved(id, resolved).catch((err: Error) => {
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, resolved: !resolved } : c)));
      window.alert(err.message);
    });
  }

  function remove(id: string) {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    deleteComment(id).catch((err: Error) => {
      setComments(previous);
      window.alert(err.message);
    });
  }

  /** Unresolved comments per page id. */
  const openCounts = comments.reduce<Record<string, number>>((acc, c) => {
    if (!c.resolved) acc[c.page_id] = (acc[c.page_id] ?? 0) + 1;
    return acc;
  }, {});

  return { comments, loading, error, isSupervisor, add, setResolved, remove, openCounts };
}
