import { needsPageArt, nextPageForArt, pageArtKey } from "../../src/utils/pageArt";
import type { BookPage } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

const page = (over: Partial<BookPage> = {}): BookPage => ({
  id: "p1",
  pageNumber: 1,
  space: { width: 612, height: 612, bleed: 0 },
  lines: [{ id: "l1", tool: "pen", strokeWidth: 6, points: [10, 10, 100, 100] }],
  objects: [{ kind: "shape", id: "s1", shapeKind: "star", x: 50, y: 50, width: 80, height: 80, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 4 }],
  ...over,
});

const base = pageArtKey(page());
ok(base === pageArtKey(page()), "the same content gives the same key");
ok(base === pageArtKey(page({ id: "other", pageNumber: 7, thumbnailDataUrl: "data:x", fillDataUrl: "data:y", completedAt: "2026-10-15", artUrl: "https://x/a.png", artKey: "old" })), "id, page number, thumbnail, a child's paint and the art link don't change the key");
ok(base !== pageArtKey(page({ lines: [] })), "removing a line changes the key");
ok(base !== pageArtKey(page({ objects: [{ ...page().objects[0], x: 51 }] })), "moving a shape changes the key");
ok(base !== pageArtKey(page({ space: { width: 612, height: 792, bleed: 0 } })), "another trim size changes the key");
ok(base !== pageArtKey(page({ backgroundPatternId: "dots" })), "a background pattern changes the key");

ok(needsPageArt(page()), "a page without art needs it");
ok(!needsPageArt(page({ artUrl: "https://x/a.png", artKey: base })), "art for this exact content is kept");
ok(needsPageArt(page({ artUrl: "https://x/a.png", artKey: base, lines: [] })), "art for older content is redone");
ok(!needsPageArt(page({ isBlankBack: true, lines: [], objects: [] })), "blank backs need no art (children never get them)");

const done = page({ id: "a", artUrl: "u", artKey: base });
const todo = page({ id: "b" });
const later = page({ id: "c", lines: [] });
ok(nextPageForArt([done, todo, later])?.id === "b", "the first page that needs art is next");
ok(nextPageForArt([done, todo, later], new Set(["b"]))?.id === "c", "a page that failed this session is skipped");
ok(nextPageForArt([done]) === null, "nothing to do when every page is current");

console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
