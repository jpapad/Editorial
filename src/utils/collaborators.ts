// Working on a book together (sql/11_book_members.sql): invite links,
// the people on a book, and the books others shared with me.

import { supabase } from "@/lib/supabase/client";
import { fromRow, type StoredBook } from "@/utils/storage";
import type { BookInviteRow, BookMemberRow } from "@/types/database";

export type BookRole = "owner" | "editor" | "viewer";

/** "relation … does not exist" / missing function: the collaborators migration hasn't been run. */
export function isMissingCollaborators(message: string): boolean {
  return /book_members|book_invites|book_role|books_shared_with_me|accept_book_invite/.test(message) && /(does not exist|Could not find|schema cache)/i.test(message);
}

/** My role on a book; null when I have none — or when the migration isn't there (then only owners can open books anyway). */
export async function myBookRole(bookId: string): Promise<BookRole | null> {
  const { data, error } = await supabase.rpc("book_role", { target: bookId });
  if (error) return null;
  return data ?? null;
}

export async function listMembers(bookId: string): Promise<BookMemberRow[]> {
  const { data, error } = await supabase.from("book_members").select("*").eq("book_id", bookId).order("added_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setMemberRole(bookId: string, userId: string, role: BookMemberRow["role"]): Promise<void> {
  const { error } = await supabase.from("book_members").update({ role }).eq("book_id", bookId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function removeMember(bookId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("book_members").delete().eq("book_id", bookId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function listInvites(bookId: string): Promise<BookInviteRow[]> {
  const { data, error } = await supabase.from("book_invites").select("*").eq("book_id", bookId).is("revoked_at", null).order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createInvite(bookId: string, role: BookInviteRow["role"]): Promise<BookInviteRow> {
  const { data, error } = await supabase.from("book_invites").insert({ book_id: bookId, role }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function revokeInvite(token: string): Promise<void> {
  const { error } = await supabase.from("book_invites").update({ revoked_at: new Date().toISOString() }).eq("token", token);
  if (error) throw new Error(error.message);
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/studio/join/${token}`;
}

/** Joins the book behind an invite link; its id, or null for a link that no longer works. */
export async function acceptInvite(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("accept_book_invite", { invite: token });
  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Books other people shared with me, newest-edited first (empty before the migration). */
export async function listSharedBooks(): Promise<(StoredBook & { role: "editor" | "viewer" })[]> {
  const { data, error } = await supabase.rpc("books_shared_with_me");
  if (error) return [];
  return (data ?? []).map((r) => ({ ...fromRow(r.book), role: r.role }));
}
