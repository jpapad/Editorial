// Classes and families (sql/10_kid_groups.sql) from the browser: the
// grown-up's side goes through RLS on the tables, the child's side only
// through the kid_* functions with the device's token.

import { supabase } from "@/lib/supabase/client";
import type { BookPage } from "@/types/editor";

export type GroupKind = "class" | "family";

export interface KidGroup {
  id: string;
  kind: GroupKind;
  name: string;
  code: string;
  created_at: string;
}

export interface KidMember {
  id: string;
  group_id: string;
  name: string;
  avatar: number;
  pin: [number, number];
  created_at: string;
}

export interface KidWork {
  member_id: string;
  book_id: string;
  page_id: string;
  thumb: string | null;
  completed_at: string | null;
  updated_at: string;
  sticker: number | null;
  comment: string | null;
}

/** "relation … does not exist": sql/10_kid_groups.sql hasn't been run. */
export function isMissingGroupsTable(message: string): boolean {
  return /kid_groups|kid_members|kid_group|kid_work/.test(message) && /(does not exist|Could not find|schema cache)/i.test(message);
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- grown-up ----------

const db = supabase;

export async function listGroups(): Promise<KidGroup[]> {
  return check(await db.from("kid_groups").select("id, kind, name, code, created_at").order("created_at"));
}

export async function createGroup(name: string, kind: GroupKind): Promise<KidGroup> {
  return check(await db.from("kid_groups").insert({ name: name.trim().slice(0, 80), kind }).select("id, kind, name, code, created_at").single());
}

export async function renameGroup(id: string, name: string): Promise<void> {
  check(await db.from("kid_groups").update({ name: name.trim().slice(0, 80) }).eq("id", id));
}

export async function deleteGroup(id: string): Promise<void> {
  check(await db.from("kid_groups").delete().eq("id", id));
}

export async function listMembers(groupId: string): Promise<KidMember[]> {
  return check(await db.from("kid_members").select("id, group_id, name, avatar, pin, created_at").eq("group_id", groupId).order("name")) as KidMember[];
}

export async function addMembers(groupId: string, names: string[]): Promise<KidMember[]> {
  const rows = names.map((name, i) => ({ group_id: groupId, name: name.trim().slice(0, 40), avatar: i % 10 })).filter((r) => r.name);
  if (rows.length === 0) return [];
  return check(await db.from("kid_members").insert(rows).select("id, group_id, name, avatar, pin, created_at")) as KidMember[];
}

export async function updateMember(id: string, changes: Partial<Pick<KidMember, "name" | "avatar">>): Promise<void> {
  check(await db.from("kid_members").update(changes).eq("id", id));
}

/** New pictures and a new token: every device this child was signed in on is signed out. */
export async function resetMember(id: string): Promise<KidMember> {
  const pin = [Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)];
  return check(await db.from("kid_members").update({ pin, token: crypto.randomUUID() }).eq("id", id).select("id, group_id, name, avatar, pin, created_at").single()) as KidMember;
}

export async function deleteMember(id: string): Promise<void> {
  check(await db.from("kid_members").delete().eq("id", id));
}

export async function listGroupBooks(groupId: string): Promise<string[]> {
  const rows: { book_id: string }[] = check(await db.from("kid_group_books").select("book_id").eq("group_id", groupId));
  return rows.map((r) => r.book_id);
}

export async function setGroupBook(groupId: string, bookId: string, on: boolean): Promise<void> {
  if (on) check(await db.from("kid_group_books").upsert({ group_id: groupId, book_id: bookId }, { onConflict: "group_id,book_id", ignoreDuplicates: true }));
  else check(await db.from("kid_group_books").delete().eq("group_id", groupId).eq("book_id", bookId));
}

/** Every page the group's children have colored (no full-size fills — thumbnails are enough for the gallery). */
export async function listGroupWork(memberIds: string[]): Promise<KidWork[]> {
  if (memberIds.length === 0) return [];
  return check(await db.from("kid_work").select("member_id, book_id, page_id, thumb, completed_at, updated_at, sticker, comment").in("member_id", memberIds).order("updated_at", { ascending: false }));
}

export async function rewardWork(work: Pick<KidWork, "member_id" | "book_id" | "page_id">, changes: { sticker?: number | null; comment?: string | null }): Promise<void> {
  check(await db.from("kid_work").update(changes).eq("member_id", work.member_id).eq("book_id", work.book_id).eq("page_id", work.page_id));
}

// ---------- child ----------

export interface KidLookup {
  name: string;
  kind: GroupKind;
  members: { id: string; name: string; avatar: number }[];
}

export interface KidHome {
  name: string;
  avatar: number;
  group: string;
  books: { id: string; title: string; pages: number; done: number; cover: string | null }[];
  stickers: number[];
  notes: { book_id: string; page_id: string; comment: string }[];
}

export interface KidBook {
  title: string;
  trim_size: string | null;
  bleed: boolean;
  pages: BookPage[];
  work: Record<string, { fill: string | null; thumb: string | null; completed_at: string | null; sticker: number | null; comment: string | null }>;
}

export async function lookupGroup(code: string): Promise<KidLookup | null> {
  return check(await db.rpc("kid_group_lookup", { group_code: code })) as unknown as KidLookup | null;
}

export async function kidLogin(code: string, memberId: string, pin: [number, number]): Promise<string | null> {
  return check(await db.rpc("kid_login", { group_code: code, member: memberId, picture_pin: pin }));
}

export async function kidHome(token: string): Promise<KidHome | null> {
  return check(await db.rpc("kid_home", { kid_token: token })) as unknown as KidHome | null;
}

export async function kidBook(token: string, bookId: string): Promise<KidBook | null> {
  return check(await db.rpc("kid_book", { kid_token: token, book: bookId })) as unknown as KidBook | null;
}

export async function kidSave(token: string, bookId: string, page: Pick<BookPage, "id" | "fillDataUrl" | "thumbnailDataUrl" | "completedAt">): Promise<boolean> {
  return check(await db.rpc("kid_save", { kid_token: token, book: bookId, page: page.id, page_fill: page.fillDataUrl ?? null, page_thumb: page.thumbnailDataUrl ?? null, done: Boolean(page.completedAt) }));
}

/** The pages whose child-made parts changed since `before` — only those are sent. */
export function changedPages(before: BookPage[], after: BookPage[]): BookPage[] {
  const old = new Map(before.map((p) => [p.id, p]));
  return after.filter((p) => {
    const o = old.get(p.id);
    return !o || o.fillDataUrl !== p.fillDataUrl || o.thumbnailDataUrl !== p.thumbnailDataUrl || Boolean(o.completedAt) !== Boolean(p.completedAt);
  });
}

// The device remembers who's signed in, per group code.
const sessionKey = (code: string) => `pagewright-kid:${code.toUpperCase()}`;

export function savedKid(code: string): { memberId: string; token: string } | null {
  try {
    const raw = localStorage.getItem(sessionKey(code));
    return raw ? (JSON.parse(raw) as { memberId: string; token: string }) : null;
  } catch {
    return null;
  }
}

export function rememberKid(code: string, memberId: string, token: string) {
  try {
    localStorage.setItem(sessionKey(code), JSON.stringify({ memberId, token }));
  } catch {
    // Private mode: the child signs in again next time.
  }
}

export function forgetKid(code: string) {
  try {
    localStorage.removeItem(sessionKey(code));
  } catch {
    // nothing stored
  }
}

export { normalizeCode } from "@/utils/groupCode";
