"use client";

// The Supabase side of the media library (utils/mediaLibrary.ts).

import { supabase } from "@/lib/supabase/client";
import { IMAGE_BUCKET, uploadBookImage } from "@/lib/imageUploader";
import { isLibraryWorthy, mediaName, pathFromUrl, type MediaItem, type MediaSource } from "@/utils/mediaLibrary";
import type { UserMediaRow } from "@/types/database";

/** The table isn't there (migration not run): stop asking for the session. */
let unavailable = false;
const isMissing = (message: string) => /(does not exist|schema cache|Could not find)/i.test(message);

const fromRow = (r: UserMediaRow): MediaItem => ({ id: r.id, path: r.path, url: r.url, name: r.name, mime: r.mime, width: r.width, height: r.height, source: r.source, createdAt: r.created_at });

async function signedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user);
}

/** The user's pictures, newest first — or null when there is no library to show (signed out, not set up). */
export async function listMedia(): Promise<MediaItem[] | null> {
  if (unavailable) return null;
  try {
    if (!(await signedIn())) return null;
    const { data, error } = await supabase.from("user_media").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) {
      if (isMissing(error.message)) unavailable = true;
      return null;
    }
    return (data ?? []).map(fromRow);
  } catch {
    return null;
  }
}

/**
 * Puts a picture in the library: uploads the file (once — files are named
 * by content) and records it. Returns the entry, or null when it wasn't
 * added (too small to bother, signed out, storage not set up).
 */
export async function addMedia(dataUrl: string, info: { name?: string; source: MediaSource; width?: number; height?: number }): Promise<MediaItem | null> {
  if (unavailable || !isLibraryWorthy(dataUrl)) return null;
  try {
    const url = await uploadBookImage(dataUrl);
    const path = url ? pathFromUrl(url) : null;
    if (!url || !path) return null;
    const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "";
    const row = { path, url, name: mediaName(info.name, info.source), mime, width: Math.round(info.width ?? 0), height: Math.round(info.height ?? 0), source: info.source };
    // The same picture again keeps its first entry (and its name).
    const { data, error } = await supabase.from("user_media").upsert(row as never, { onConflict: "user_id,path", ignoreDuplicates: true }).select().maybeSingle();
    if (error) {
      if (isMissing(error.message)) unavailable = true;
      return null;
    }
    return data ? fromRow(data) : null;
  } catch {
    return null;
  }
}

/** Removes the entry and its file. Books that used the picture as a link lose it — the caller warns first. */
export async function deleteMedia(item: MediaItem): Promise<boolean> {
  try {
    const { error } = await supabase.from("user_media").delete().eq("id", item.id);
    if (error) return false;
    await supabase.storage.from(IMAGE_BUCKET).remove([item.path]);
    return true;
  } catch {
    return false;
  }
}
