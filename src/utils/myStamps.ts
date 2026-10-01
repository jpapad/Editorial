// "My stamps": pieces the user saved to reuse in any book — one object or a
// whole selection. Kept on this device (IndexedDB, see deviceStore.ts):
// pictures are data URLs, far too big for localStorage.

import type { PageObject } from "@/types/editor";
import { makeId } from "@/components/editor/pageTemplates";
import { objectBounds, unionBounds } from "@/utils/objectGeometry";
import { deviceGet, deviceSet } from "@/utils/deviceStore";

const KEY = "my-stamps";
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

export async function listMyStamps(): Promise<MyStamp[]> {
  return (await deviceGet<MyStamp[]>(KEY)) ?? [];
}

/** Newest first; the oldest fall off past MAX_MY_STAMPS. */
export async function saveMyStamp(stamp: MyStamp): Promise<MyStamp[]> {
  const next = [stamp, ...(await listMyStamps())].slice(0, MAX_MY_STAMPS);
  await deviceSet(KEY, next);
  return next;
}

export async function deleteMyStamp(id: string): Promise<MyStamp[]> {
  const next = (await listMyStamps()).filter((s) => s.id !== id);
  await deviceSet(KEY, next);
  return next;
}
