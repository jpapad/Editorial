// Account sync (stamps, versions) with an in-memory stand-in for the account, and picture externalising.
import type { MyStamp } from "../../src/utils/myStamps";
import type { StampRemote, VersionMeta } from "../../src/utils/accountLibrary";
import type { BookPage, PageObject } from "../../src/types/editor";
// These modules import the browser Supabase client, which needs its env to load.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:1";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test";
const { mergeStamps } = await import("../../src/utils/myStamps");
const { mergeVersions, overflow } = await import("../../src/utils/versions");
const { decodeDataUrl, embeddedImages, externalize, MIN_UPLOAD_CHARS, withLinks } = await import("../../src/utils/imageStore");
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

// ---- stamps
const stamp = (id: string): MyStamp => ({ id, name: id, preview: "p", objects: [], width: 10, height: 10 });
function account(initial: MyStamp[], failing = false) {
  const rows = [...initial];
  const remote: StampRemote = {
    list: async () => [...rows],
    put: async (s) => { if (failing) throw new Error("offline"); rows.push(s); },
    remove: async (id) => { rows.splice(rows.findIndex((r) => r.id === id), 1); },
  };
  return { rows, remote };
}
let acc = account([stamp("cloud")]);
let m = await mergeStamps([stamp("new-here")], [], acc.remote);
ok(m.stamps.map((s) => s.id).join() === "new-here,cloud" && acc.rows.some((r) => r.id === "new-here") && m.synced.sort().join() === "cloud,new-here", "first sync: the device stamp goes up, the account stamp comes down");
acc = account([stamp("kept")]);
m = await mergeStamps([stamp("kept"), stamp("deleted-elsewhere")], ["kept", "deleted-elsewhere"], acc.remote);
ok(m.stamps.map((s) => s.id).join() === "kept" && acc.rows.length === 1, "a stamp deleted on another device disappears here too — and is not uploaded back");
acc = account([], true);
m = await mergeStamps([stamp("a")], [], acc.remote);
ok(m.stamps.length === 1 && m.synced.length === 0, "an upload that fails keeps the stamp on the device, to try again next time");
acc = account([stamp("x")]);
m = await mergeStamps([stamp("x")], ["x"], acc.remote);
ok(m.stamps.length === 1 && acc.rows.length === 1, "already in step → nothing changes, nothing doubles");

// ---- versions
const meta = (n: number, manual = false): VersionMeta => ({ id: "v" + n, at: new Date(Date.UTC(2026, 9, 1, 10, n)).toISOString(), title: "t", pageCount: 1, signature: "s" + n, manual: manual || undefined });
const mine = [{ ...meta(5), pages: [] as BookPage[] }, { ...meta(3), pages: [] as BookPage[] }];
const merged = mergeVersions(mine, [meta(5), meta(4), meta(1)]);
ok(merged.map((v) => v.id).join() === "v5,v4,v3,v1" && merged[1].pages === undefined && merged[0].pages !== undefined, "device and account versions are listed together, newest first; account-only ones come without pages");
ok(overflow([meta(1), meta(2, true), meta(3), meta(4), meta(5)], 3).sort().join() === "v1,v3", "over the account's limit: the oldest automatic versions go, the hand-saved one stays");
ok(overflow([meta(1), meta(2)], 6).length === 0 && overflow([meta(1, true), meta(2, true), meta(3, true)], 2).join() === "v1", "under the limit nothing goes; only hand-saved ones left → the oldest");

// ---- pictures as links
const big = (seed: string) => "data:image/png;base64," + btoa(seed.repeat(MIN_UPLOAD_CHARS));
const space = { width: 612, height: 792, bleed: 0 };
const st = (id: string, src: string): PageObject => ({ kind: "stamp", id, src, x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1 } as PageObject);
const A = big("a"), B = big("b"), tiny = "data:image/svg+xml;utf8,<svg/>";
const pages: BookPage[] = [
  { id: "1", pageNumber: 1, space, lines: [], objects: [st("s1", A), st("s2", tiny), st("s3", "https://x/y.png")], traceImage: { src: B, opacity: 0.3 }, fillDataUrl: big("paint"), thumbnailDataUrl: big("thumb") },
  { id: "2", pageNumber: 2, space, lines: [], objects: [st("s4", A)] },
  { id: "3", pageNumber: 3, space, lines: [], objects: [] },
];
ok(embeddedImages(pages).length === 2, "big embedded pictures are found once each; tiny ones, links, paint and previews are left alone");
const uploads: string[] = [];
const known = new Map<string, string>();
const up = async (src: string) => { uploads.push(src); return src === B ? null : `https://cdn/${uploads.length}.png`; };
const cover = { page: { id: "c", pageNumber: 0, space, lines: [], objects: [st("c1", A)] }, spineWidth: 10 };
const stored = await externalize(pages, cover, up, known);
const src = (p: BookPage, i: number) => (p.objects[i] as { src: string }).src;
ok(uploads.length === 2 && src(stored.pages[0], 0) === "https://cdn/1.png" && src(stored.pages[1], 0) === "https://cdn/1.png" && src(stored.cover!.page, 0) === "https://cdn/1.png", "the same picture on two pages and the cover is uploaded once and linked everywhere");
ok(stored.pages[0].traceImage!.src === B && src(stored.pages[0], 1) === tiny && stored.pages[0].fillDataUrl === pages[0].fillDataUrl, "a picture that couldn't be uploaded stays embedded; everything else is untouched");
ok(stored.pages[2] === pages[2] && src(pages[0], 0) === A, "pages without pictures keep their identity; the editor's own pages are not modified");
await externalize(pages, cover, up, known);
ok(uploads.filter((u) => u === A).length === 1, "saving again does not upload the picture again");
const failing = await externalize(pages, null, async () => { throw new Error("no bucket"); }, new Map());
ok(failing.pages.every((p, i) => p === pages[i]), "when uploads fail the book is saved exactly as before");
ok(withLinks(pages, new Map()) === pages, "no links → the same pages");
const png = decodeDataUrl("data:image/png;base64," + btoa("\x89PNG"));
const svg = decodeDataUrl("data:image/svg+xml;utf8," + encodeURIComponent("<svg>ά</svg>"));
ok(png?.mime === "image/png" && png.bytes[0] === 0x89 && png.bytes.length === 4 && svg?.mime === "image/svg+xml" && new TextDecoder().decode(svg.bytes) === "<svg>ά</svg>" && decodeDataUrl("https://x") === null, "data URLs decode to bytes (base64 and text), anything else is refused");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
