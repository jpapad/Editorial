import { supabase } from "@/lib/supabase/client";
import type { PageCommentRow } from "@/types/database";

export type PageComment = PageCommentRow;

/** Postgres "relation does not exist" — the page_comments migration hasn't been run on this project yet. */
export function isMissingCommentsTable(message: string): boolean {
  return /page_comments/.test(message) && /(does not exist|schema cache)/i.test(message);
}

/** Every comment on a book, oldest first. RLS limits this to the book's owner and supervisors. */
export async function listComments(bookId: string): Promise<PageComment[]> {
  const { data, error } = await supabase.from("page_comments").select("*").eq("book_id", bookId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addComment(bookId: string, pageId: string, body: string): Promise<PageComment> {
  // author_id/author_email are filled in by a database trigger from the session.
  const { data, error } = await supabase.from("page_comments").insert({ book_id: bookId, page_id: pageId, body }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setCommentResolved(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase.from("page_comments").update({ resolved }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("page_comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
