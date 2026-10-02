// Version history: snapshots of a book's pages, so yesterday's state can be
// brought back — undo only reaches as far as the current session. Kept on
// this device (IndexedDB, see deviceStore.ts) and, when signed in, with the
// account too (accountLibrary.ts): fewer of them there, since each holds a
// whole book.

import type { BookPage } from "@/types/editor";
import { deviceGet, deviceSet } from "@/utils/deviceStore";
import { pageSignature } from "@/utils/readiness";
import { versionRemote, type VersionMeta } from "@/utils/accountLibrary";

export const MAX_VERSIONS = 12;
/** How many the account keeps per book. */
export const MAX_ACCOUNT_VERSIONS = 6;
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
  /** Absent for a version that lives only in the account — fetched when it is restored (loadVersionPages). */
  pages?: BookPage[];
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

const local = async (bookId: string) => (await deviceGet<BookVersion[]>(key(bookId))) ?? [];

/** Device versions plus the ones only the account has (those come without their pages), newest first. */
export function mergeVersions(mine: BookVersion[], theirs: VersionMeta[]): BookVersion[] {
  const have = new Set(mine.map((v) => v.id));
  return [...mine, ...theirs.filter((v) => !have.has(v.id))].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Which account versions to delete so at most `max` remain — the oldest automatic ones first. */
export function overflow(versions: VersionMeta[], max: number): string[] {
  const newestFirst = [...versions].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const drop: string[] = [];
  const removable = newestFirst.filter((v) => !v.manual).reverse();
  let excess = newestFirst.length - max;
  for (const v of removable) {
    if (excess <= 0) break;
    drop.push(v.id);
    excess--;
  }
  // Only hand-saved ones left and still too many: the oldest of those go.
  for (const v of [...newestFirst].reverse()) {
    if (excess <= 0) break;
    if (!drop.includes(v.id)) {
      drop.push(v.id);
      excess--;
    }
  }
  return drop;
}

export async function listVersions(bookId: string): Promise<BookVersion[]> {
  const mine = await local(bookId);
  try {
    const remote = await versionRemote();
    return remote ? mergeVersions(mine, await remote.list(bookId)) : mine;
  } catch {
    return mine;
  }
}

export async function saveVersion(bookId: string, title: string, pages: BookPage[], manual = false): Promise<BookVersion[]> {
  const at = new Date().toISOString();
  const version: BookVersion = { id: `${at}-${Math.random().toString(36).slice(2, 7)}`, at, title, pageCount: pages.length, signature: bookSignature(pages), manual: manual || undefined, pages: lean(pages) };
  const next = withVersion(await local(bookId), version);
  await deviceSet(key(bookId), next);
  try {
    const remote = await versionRemote();
    if (remote) {
      await remote.put(bookId, { ...version, pages: version.pages! });
      for (const id of overflow(await remote.list(bookId), MAX_ACCOUNT_VERSIONS)) await remote.remove(id);
      return mergeVersions(next, await remote.list(bookId));
    }
  } catch {
    // The device copy is saved; the account copy is a bonus.
  }
  return next;
}

export async function deleteVersion(bookId: string, id: string): Promise<BookVersion[]> {
  const next = (await local(bookId)).filter((v) => v.id !== id);
  await deviceSet(key(bookId), next);
  try {
    const remote = await versionRemote();
    if (remote) {
      await remote.remove(id);
      return mergeVersions(next, await remote.list(bookId));
    }
  } catch {
    // Still in the account; it will show again and can be deleted then.
  }
  return next;
}

/** A version's pages — at hand for device versions, fetched for account-only ones. Null when they can't be had. */
export async function loadVersionPages(version: BookVersion): Promise<BookPage[] | null> {
  if (version.pages) return version.pages;
  try {
    const remote = await versionRemote();
    return remote ? await remote.pages(version.id) : null;
  } catch {
    return null;
  }
}
