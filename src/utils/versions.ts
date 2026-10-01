// Version history: snapshots of a book's pages kept on this device
// (IndexedDB, see deviceStore.ts), so yesterday's state can be brought
// back — undo only reaches as far as the current session.

import type { BookPage } from "@/types/editor";
import { deviceGet, deviceSet } from "@/utils/deviceStore";
import { pageSignature } from "@/utils/readiness";

export const MAX_VERSIONS = 12;
/** Automatic snapshots are at least this far apart. */
export const VERSION_INTERVAL_MS = 10 * 60 * 1000;

export interface BookVersion {
  id: string;
  /** ISO time. */
  at: string;
  title: string;
  pageCount: number;
  /** Changes whenever what the book prints changes. */
  signature: string;
  /** True for one the user saved by hand — never pushed out by automatic ones. */
  manual?: boolean;
  pages: BookPage[];
}

const key = (bookId: string) => `versions:${bookId}`;

export const bookSignature = (pages: BookPage[]): string => pages.map(pageSignature).join(".");

/** Thumbnails are only previews of the same data — dropping them roughly halves a snapshot. */
const lean = (pages: BookPage[]): BookPage[] => pages.map((p) => (p.thumbnailDataUrl ? { ...p, thumbnailDataUrl: undefined } : p));

/** Whether an automatic snapshot is due: the book changed since the newest one, and that one is old enough. */
export function snapshotDue(versions: Pick<BookVersion, "at" | "signature">[], signature: string, now: number): boolean {
  const latest = versions[0];
  if (!latest) return true;
  return latest.signature !== signature && now - Date.parse(latest.at) >= VERSION_INTERVAL_MS;
}

/** Newest first, at most MAX_VERSIONS; when full, the oldest automatic one goes first. */
export function withVersion(versions: BookVersion[], version: BookVersion): BookVersion[] {
  const next = [version, ...versions];
  while (next.length > MAX_VERSIONS) {
    let drop = -1;
    for (let i = next.length - 1; i > 0; i--) {
      if (!next[i].manual) {
        drop = i;
        break;
      }
    }
    next.splice(drop === -1 ? next.length - 1 : drop, 1);
  }
  return next;
}

export async function listVersions(bookId: string): Promise<BookVersion[]> {
  return (await deviceGet<BookVersion[]>(key(bookId))) ?? [];
}

export async function saveVersion(bookId: string, title: string, pages: BookPage[], manual = false): Promise<BookVersion[]> {
  const at = new Date().toISOString();
  const version: BookVersion = { id: `${at}-${Math.random().toString(36).slice(2, 7)}`, at, title, pageCount: pages.length, signature: bookSignature(pages), manual: manual || undefined, pages: lean(pages) };
  const next = withVersion(await listVersions(bookId), version);
  await deviceSet(key(bookId), next);
  return next;
}

export async function deleteVersion(bookId: string, id: string): Promise<BookVersion[]> {
  const next = (await listVersions(bookId)).filter((v) => v.id !== id);
  await deviceSet(key(bookId), next);
  return next;
}
