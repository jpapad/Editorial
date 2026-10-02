// The account side of "My stamps" and version history (sql/06_user_library.sql).
// Everything here fails soft: signed out, or the migration not run yet,
// simply means "no account copy" and the device copy carries on alone.

import type { BookPage, PageObject } from "@/types/editor";

export interface StampRecord {
  id: string;
  name: string;
  preview: string;
  objects: PageObject[];
  width: number;
  height: number;
}

export interface StampRemote {
  list(): Promise<StampRecord[]>;
  put(stamp: StampRecord): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface VersionMeta {
  id: string;
  at: string;
  title: string;
  pageCount: number;
  signature: string;
  manual?: boolean;
}

export interface VersionRemote {
  list(bookId: string): Promise<VersionMeta[]>;
  put(bookId: string, version: VersionMeta & { pages: BookPage[] }): Promise<void>;
  remove(id: string): Promise<void>;
  pages(id: string): Promise<BookPage[] | null>;
}

// Loaded on first use: the browser client needs its environment, and the pure helpers that
// share a module with these calls (myStamps.ts, versions.ts) must load without it.
const client = async () => (await import("@/lib/supabase/client")).supabase;

/** Once a table turns out to be missing, stop asking for the rest of the session. */
const unavailable = { stamps: false, versions: false };
const isMissing = (message: string) => /(does not exist|schema cache|Could not find)/i.test(message);

async function signedIn(): Promise<boolean> {
  try {
    const { data } = await (await client()).auth.getSession();
    return Boolean(data.session?.user);
  } catch {
    return false;
  }
}

function fail(kind: keyof typeof unavailable, message: string): never {
  if (isMissing(message)) unavailable[kind] = true;
  throw new Error(message);
}

/** The account's stamp store, or null when there is none to use right now. */
export async function stampRemote(): Promise<StampRemote | null> {
  if (unavailable.stamps || !(await signedIn())) return null;
  const supabase = await client();
  return {
    async list() {
      const { data, error } = await supabase.from("user_stamps").select("id, name, preview, objects, width, height").order("created_at", { ascending: false });
      if (error) fail("stamps", error.message);
      return (data ?? []) as StampRecord[];
    },
    async put(stamp) {
      const { error } = await supabase.from("user_stamps").upsert({ id: stamp.id, name: stamp.name, preview: stamp.preview, objects: stamp.objects, width: stamp.width, height: stamp.height } as never);
      if (error) fail("stamps", error.message);
    },
    async remove(id) {
      const { error } = await supabase.from("user_stamps").delete().eq("id", id);
      if (error) fail("stamps", error.message);
    },
  };
}

export async function versionRemote(): Promise<VersionRemote | null> {
  if (unavailable.versions || !(await signedIn())) return null;
  const supabase = await client();
  return {
    async list(bookId) {
      const { data, error } = await supabase.from("book_versions").select("id, at, title, page_count, signature, manual").eq("book_id", bookId).order("at", { ascending: false });
      if (error) fail("versions", error.message);
      return (data ?? []).map((r) => ({ id: r.id, at: r.at, title: r.title, pageCount: r.page_count, signature: r.signature, manual: r.manual || undefined }));
    },
    async put(bookId, v) {
      const { error } = await supabase.from("book_versions").upsert({ id: v.id, book_id: bookId, at: v.at, title: v.title, page_count: v.pageCount, signature: v.signature, manual: Boolean(v.manual), pages: v.pages } as never);
      if (error) fail("versions", error.message);
    },
    async remove(id) {
      const { error } = await supabase.from("book_versions").delete().eq("id", id);
      if (error) fail("versions", error.message);
    },
    async pages(id) {
      const { data, error } = await supabase.from("book_versions").select("pages").eq("id", id).maybeSingle();
      if (error) fail("versions", error.message);
      return (data?.pages as BookPage[] | undefined) ?? null;
    },
  };
}
