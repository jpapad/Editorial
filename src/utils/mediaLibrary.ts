// The media library: every picture the user uploaded or generated, kept
// with the account (file in Storage, entry in user_media — sql/07, sql/08)
// so it can be used again in any book.
//
// Fails soft throughout: signed out, or the migrations not run, means
// there is simply no library — nothing else in the editor depends on it.

import { MIN_UPLOAD_CHARS } from "@/utils/imageStore";

export type MediaSource = "upload" | "ai";

export interface MediaItem {
  id: string;
  path: string;
  url: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  source: MediaSource;
  createdAt: string;
}

export const MEDIA_BUCKET_MARKER = "/storage/v1/object/public/book-images/";

/** "<…>/storage/v1/object/public/book-images/<user>/<hash>.png" → "<user>/<hash>.png". Null for any other link. */
export function pathFromUrl(url: string): string | null {
  const at = url.indexOf(MEDIA_BUCKET_MARKER);
  if (at < 0) return null;
  const path = url.slice(at + MEDIA_BUCKET_MARKER.length).split("?")[0];
  return /^[^/]+\/[^/]+\.[a-z0-9]+$/i.test(path) ? path : null;
}

/** Pictures worth keeping: real images of some size — not the built-in icons, not links, not paint layers. */
export const isLibraryWorthy = (src: string) => src.startsWith("data:image/") && src.length >= MIN_UPLOAD_CHARS;

/** A tidy display name from a file name or an AI subject. */
export function mediaName(raw: string | undefined, source: MediaSource): string {
  const name = (raw ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (name || (source === "ai" ? "AI picture" : "Picture")).slice(0, 80);
}

export type MediaFilter = "all" | MediaSource;

/** What the panel shows: by source, then by a search in the names — newest first as stored. */
export function filterMedia(items: MediaItem[], filter: MediaFilter, query: string): MediaItem[] {
  const q = query.trim().toLocaleLowerCase();
  return items.filter((m) => (filter === "all" || m.source === filter) && (!q || m.name.toLocaleLowerCase().includes(q)));
}
