import { supabase } from "@/lib/supabase/client";
import type { BookShareRow, SharedBook } from "@/types/database";

/** Postgres "relation does not exist" — the book_shares migration hasn't run yet. */
export function isMissingSharesTable(message: string): boolean {
  return /(book_shares|get_shared_book)/.test(message) && /(does not exist|schema cache|Could not find)/i.test(message);
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

/** The book's live (unrevoked) links, newest first. */
export async function listShares(bookId: string): Promise<BookShareRow[]> {
  const { data, error } = await supabase.from("book_shares").select("*").eq("book_id", bookId).is("revoked_at", null).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createShare(bookId: string): Promise<BookShareRow> {
  const { data, error } = await supabase.from("book_shares").insert({ book_id: bookId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function revokeShare(token: string): Promise<void> {
  const { error } = await supabase.from("book_shares").update({ revoked_at: new Date().toISOString() }).eq("token", token);
  if (error) throw new Error(error.message);
}

/** Anonymous read of a shared book — null when the link is unknown or revoked. */
export async function getSharedBook(token: string): Promise<SharedBook | null> {
  const { data, error } = await supabase.rpc("get_shared_book", { share_token: token });
  if (error) throw new Error(error.message);
  return data ?? null;
}
