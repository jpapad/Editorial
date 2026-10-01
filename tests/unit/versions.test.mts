import { bookReadiness, duplicatePages, pageSignature } from "../../src/utils/readiness";
import { bookSignature, MAX_VERSIONS, snapshotDue, VERSION_INTERVAL_MS, withVersion, type BookVersion } from "../../src/utils/versions";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const stamp = (id: string, src: string, x = 100, extra: Partial<PageObject> = {}): PageObject => ({ kind: "stamp", id, src, x, y: 100, width: 200, height: 200, rotation: 0, scaleX: 1, scaleY: 1, ...extra } as PageObject);
const page = (id: string, objects: PageObject[], extra: Partial<BookPage> = {}): BookPage => ({ id, pageNumber: 0, space, objects, lines: [], ...extra });
const big = (seed: string) => "data:image/png;base64," + seed.repeat(4000);

// ---- repeated pages
const a = page("a", [stamp("1", big("cat"))]);
const copy = page("b", [stamp("2", big("cat"))]);
const other = page("c", [stamp("3", big("dog"))]);
ok(pageSignature(a) === pageSignature(copy) && pageSignature(a) !== pageSignature(other), "same picture in the same place = same signature (ids don't matter); another picture differs");
ok(pageSignature(a) !== pageSignature(page("d", [stamp("4", big("cat"), 300)])) && pageSignature(a) === pageSignature(page("e", [stamp("5", big("cat"), 100.4)])), "moving it changes the page; a sub-point nudge doesn't");
const midDiff = big("cat").slice(0, 6000) + "X" + big("cat").slice(6001);
ok(pageSignature(a) !== pageSignature(page("f", [stamp("6", big("cat").slice(0, -3) + "zzz")])) && midDiff.length === big("cat").length, "pictures of the same size that differ at the end are told apart");
const numbered = page("g", [stamp("7", big("cat")), { kind: "text", id: "n", role: "pageNumber", text: "7", x: 0, y: 0, width: 10, height: 10, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "a", fontSize: 12, align: "center", fill: "#000", isDragging: false }, stamp("logo", "logo", 10, { repeatId: "r" })]);
ok(pageSignature(numbered) === pageSignature(a), "page numbers and elements repeated on every page are ignored");
const book = [a, other, copy, page("blank1", []), page("blank2", []), page("back", [stamp("8", big("cat"))], { isBlankBack: true })];
ok(duplicatePages(book).join() === "b", "only the later copy is reported — empty pages and blank backs are not 'repeats'");
const item = bookReadiness(book).items.find((i) => i.id === "duplicates")!;
ok(!item.ok && item.count === 1 && item.penalty === 5 && bookReadiness([a, other]).items.find((i) => i.id === "duplicates")!.ok, "the readiness score lists repeated pages and takes points off");
const drawn = (pts: number[]): BookPage => ({ ...page("l" + pts.join(""), []), lines: [{ id: "x" + pts[0], tool: "pen", strokeWidth: 4, points: pts }] });
ok(duplicatePages([drawn([0, 0, 50, 50]), drawn([0, 0, 50, 50]), drawn([0, 0, 50, 90])]).length === 1, "hand-drawn pages are compared by their strokes");

// ---- version history
const v = (at: number, signature: string, manual = false): BookVersion => ({ id: "v" + at, at: new Date(at).toISOString(), title: "t", pageCount: 1, signature, manual: manual || undefined, pages: [] });
const t0 = Date.parse("2026-10-01T10:00:00Z");
ok(snapshotDue([], "s1", t0), "no versions yet → take one");
ok(!snapshotDue([v(t0, "s1")], "s1", t0 + VERSION_INTERVAL_MS * 3), "nothing changed → no new version, however long ago");
ok(!snapshotDue([v(t0, "s1")], "s2", t0 + VERSION_INTERVAL_MS - 1000) && snapshotDue([v(t0, "s1")], "s2", t0 + VERSION_INTERVAL_MS), "changed → a new version once 10 minutes have passed");
let list: BookVersion[] = [];
for (let i = 0; i < MAX_VERSIONS + 5; i++) list = withVersion(list, v(t0 + i * 1000, "s" + i, i === 1));
ok(list.length === MAX_VERSIONS && list[0].id === "v" + (t0 + (MAX_VERSIONS + 4) * 1000), "newest first, capped");
ok(list.some((x) => x.manual) && !list.some((x) => x.id === "v" + t0), "the oldest automatic versions are dropped first; one saved by hand is kept");
ok(bookSignature([a, other]) !== bookSignature([other, a]) && bookSignature([a]) === bookSignature([copy]), "the book signature follows page order and content");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
