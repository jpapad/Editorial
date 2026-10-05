// "My stamps": pieces the user saved to reuse in any book — one object or a
// whole selection. Kept on this device (IndexedDB, see deviceStore.ts) and,
// when signed in, with the account too (accountLibrary.ts), so they follow
// the user to another computer. The device copy is what the editor reads
// first; the account copy is merged in.

import type { PageObject } from "@/types/editor";
import { makeId } from "@/components/editor/pageTemplates";
import { objectBounds, unionBounds } from "@/utils/objectGeometry";
import { deviceGet, deviceSet } from "@/utils/deviceStore";
import { stampRemote, type StampRemote } from "@/utils/accountLibrary";

const KEY = "my-stamps";
/** Ids known to be in the account — a stamp in here that the account no longer has was deleted on another device. */
const SYNCED_KEY = "my-stamps-synced";
export const MAX_MY_STAMPS = 60;

export interface MyStamp {
  id: string;
  name: string;
  /** Small PNG of the piece. */
  preview: string;
  /** The objects, positioned relative to the piece's top-left corner. */
  objects: PageObject[];
  width: number;
  height: number;
}

/** The selection as a reusable piece: moved to 0,0, stripped of what belongs to the page it came from. */
export function toMyStamp(objects: PageObject[], name: string, preview: string): MyStamp | null {
  const box = unionBounds(objects.map(objectBounds));
  if (!box) return null;
  return {
    id: makeId("mine"),
    name,
    preview,
    width: box.right - box.left,
    height: box.bottom - box.top,
    objects: objects.map((o) => ({ ...o, x: o.x - box.left, y: o.y - box.top, locked: false, hidden: false, role: undefined, repeatId: undefined, isFrame: false, frameId: undefined }) as PageObject),
  };
}

/** Fresh copies of a saved piece, centred on (cx, cy), grouped when it has several parts. */
export function placeMyStamp(stamp: MyStamp, cx: number, cy: number): PageObject[] {
  const groupId = stamp.objects.length > 1 ? makeId("group") : undefined;
  return stamp.objects.map((o) => ({ ...o, id: makeId(o.kind), x: o.x + cx - stamp.width / 2, y: o.y + cy - stamp.height / 2, groupId }) as PageObject);
}

/**
 * Brings the device and the account into step:
 * - a device stamp never uploaded goes up;
 * - an account stamp not on this device comes down;
 * - a device stamp that was uploaded before but is gone from the account
 *   was deleted elsewhere, and is dropped here too.
 * Returns what the device should now hold and the ids known to be in the account.
 */
export async function mergeStamps(local: MyStamp[], synced: string[], remote: StampRemote): Promise<{ stamps: MyStamp[]; synced: string[] }> {
  const theirs = await remote.list();
  const inAccount = new Set(theirs.map((s) => s.id));
  const wasSynced = new Set(synced);
  const kept: MyStamp[] = [];
  for (const stamp of local) {
    if (inAccount.has(stamp.id)) kept.push(stamp);
    else if (wasSynced.has(stamp.id)) continue; // deleted on another device
    else {
      try {
        await remote.put(stamp);
        inAccount.add(stamp.id);
      } catch {
        // Stays on the device; the next sync tries again.
      }
      kept.push(stamp);
    }
  }
  const have = new Set(kept.map((s) => s.id));
  const stamps = [...kept, ...theirs.filter((s) => !have.has(s.id))].slice(0, MAX_MY_STAMPS);
  return { stamps, synced: stamps.filter((s) => inAccount.has(s.id)).map((s) => s.id) };
}

const local = async () => (await deviceGet<MyStamp[]>(KEY)) ?? [];

export async function listMyStamps(): Promise<MyStamp[]> {
  const mine = await local();
  try {
    const remote = await stampRemote();
    if (!remote) return mine;
    const merged = await mergeStamps(mine, (await deviceGet<string[]>(SYNCED_KEY)) ?? [], remote);
    await deviceSet(KEY, merged.stamps).catch(() => undefined);
    await deviceSet(SYNCED_KEY, merged.synced).catch(() => undefined);
    return merged.stamps;
  } catch {
    return mine;
  }
}

/** Newest first; the oldest fall off past MAX_MY_STAMPS. */
export async function saveMyStamp(stamp: MyStamp): Promise<MyStamp[]> {
  const next = [stamp, ...(await local())].slice(0, MAX_MY_STAMPS);
  await deviceSet(KEY, next);
  try {
    const remote = await stampRemote();
    if (remote) {
      await remote.put(stamp);
      await deviceSet(SYNCED_KEY, [...((await deviceGet<string[]>(SYNCED_KEY)) ?? []), stamp.id]);
    }
  } catch {
    // On the device for now; listMyStamps uploads it later.
  }
  return next;
}

export async function deleteMyStamp(id: string): Promise<MyStamp[]> {
  const next = (await local()).filter((s) => s.id !== id);
  await deviceSet(KEY, next);
  try {
    const remote = await stampRemote();
    if (remote) await remote.remove(id);
    await deviceSet(SYNCED_KEY, ((await deviceGet<string[]>(SYNCED_KEY)) ?? []).filter((s) => s !== id));
  } catch {
    // Still in the account (and still marked as synced), so the next sync brings it back — visible, and deletable again.
  }
  return next;
}
