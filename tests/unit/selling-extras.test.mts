import { applyCoverLayout, coverObjects, coverPictureFrom, COVER_STYLES } from "../../src/utils/coverTemplates";
import { coverLayout, coverSafeAreas, emptyCover } from "../../src/utils/coverGeometry";
import { isPicturePage, nextVolumePages, nextVolumeTitle } from "../../src/utils/volumes";
import { applyPageNumbers, repeatOnAllPages } from "../../src/utils/pageNumbers";
import { applyFrameToAll } from "../../src/utils/bookTools";
import { createPageFromTemplate } from "../../src/components/editor/pageTemplates";
import { FRAMES } from "../../src/components/editor/frameLibrary";
import { objectBounds } from "../../src/utils/objectGeometry";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);

// ---- cover layouts
const layout = coverLayout("8.5x11", 40, "white");
const [backSafe, frontSafe] = coverSafeAreas(layout);
const content = { title: "Ζωάκια της φάρμας", subtitle: "Βιβλίο ζωγραφικής για ηλικίες 3–5", author: "Γ. Παπαδόπουλος", blurb: "40 σελίδες για χρωμάτισμα", picture: { src: "data:pic", width: 400, height: 500 } };
for (const { value: style } of COVER_STYLES) {
  const objs = coverObjects(layout, style, content);
  const front = objs.filter((o) => o.x + (o.width * o.scaleX) / 2 > layout.front.left);
  const back = objs.filter((o) => o.x + (o.width * o.scaleX) / 2 < layout.back.right);
  const texts = front.filter((o) => o.kind === "text") as (PageObject & { text: string })[];
  const inside = (o: PageObject, box: { left: number; top: number; right: number; bottom: number }) => { const b = objectBounds(o); return b.left >= box.left - 0.5 && b.right <= box.right + 0.5 && b.top >= box.top - 0.5 && b.bottom <= box.bottom + 0.5; };
  ok(texts.some((t) => t.text === content.title) && texts.some((t) => t.text === content.subtitle) && texts.some((t) => t.text === content.author), `${style}: title, subtitle and author are on the front`);
  ok(front.filter((o) => o.kind !== "shape").every((o) => inside(o, frontSafe)), `${style}: front text and picture stay inside the safe area`);
  const pic = front.find((o) => o.kind === "stamp")!;
  ok(Boolean(pic) && Math.abs(pic.width / pic.height - 0.8) < 0.001, `${style}: the picture keeps its proportions`);
  ok(back.length >= 2 && back.every((o) => inside(o, backSafe) && objectBounds(o).bottom <= layout.barcode.top), `${style}: back cover text is clear of the barcode box`);
  ok(objs.every((o) => o.role === "coverLayout") && new Set(objs.map((o) => o.id)).size === objs.length, `${style}: every piece is marked as layout, with its own id`);
  // No two front texts overlap vertically.
  const rows = texts.map(objectBounds).sort((a, b) => a.top - b.top);
  ok(rows.every((r, i) => i === 0 || r.top >= rows[i - 1].bottom - 0.5), `${style}: front texts don't overlap`);
}
const band = coverObjects(layout, "band", content);
ok(band.some((o) => o.kind === "shape" && (o as { fill: string }).fill === "#111827") && band.filter((o) => o.kind === "text" && (o as { fill: string }).fill === "#ffffff").length === 2, "title band: white title and subtitle on a dark band");
const noPic = coverObjects(layout, "classic", { title: "T" });
ok(noPic.every((o) => o.kind !== "stamp") && noPic.filter((o) => o.kind === "text").length === 2, "without a picture, subtitle or author: just the title (front and back)");
const long = coverObjects(layout, "bold", { title: "Ένα πάρα πολύ μεγάλο όνομα για βιβλίο ζωγραφικής με ζωάκια" }).find((o) => o.kind === "text") as PageObject & { fontSize: number };
ok(long.fontSize < 96 && long.height <= (frontSafe.bottom - frontSafe.top) * 0.45, `a long title is shrunk to fit its area (${long.fontSize}pt)`);
const cover = emptyCover(layout, "c").page;
const mine: PageObject = { kind: "shape", id: "mine", shapeKind: "star", x: 900, y: 100, width: 40, height: 40, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 3 };
const first = applyCoverLayout({ ...cover, objects: [mine] }, layout, "classic", content);
const second = applyCoverLayout(first, layout, "framed", content);
ok(second.objects.filter((o) => o.id === "mine").length === 1 && second.objects.at(-1)!.id === "mine", "the user's own cover objects are kept, on top");
ok(second.objects.filter((o) => o.role === "coverLayout").length === coverObjects(layout, "framed", content).length && !second.objects.some((o) => first.objects.some((f) => f.role === "coverLayout" && f.id === o.id)), "choosing another layout replaces the previous one");
const stamp = (id: string, w: number, extra: Partial<PageObject> = {}): PageObject => ({ kind: "stamp", id, src: "src-" + id, x: 50, y: 50, width: w, height: w * 1.25, rotation: 0, scaleX: 1, scaleY: 1, ...extra } as PageObject);
const page = (id: string, objects: PageObject[], extra: Partial<BookPage> = {}): BookPage => ({ id, pageNumber: 0, space, objects, lines: [], ...extra });
ok(coverPictureFrom([page("e", []), page("f", [stamp("frame", 500, { isFrame: true } as Partial<PageObject>), stamp("small", 100), stamp("big", 300)]), page("g", [stamp("later", 400)])])?.src === "src-big", "cover picture: the biggest picture on the first page that has one (frames don't count)");
ok(coverPictureFrom([page("e", [])]) === undefined, "no picture in the book → none");

// ---- next volume
ok(nextVolumeTitle("Ζωάκια") === "Ζωάκια 2" && nextVolumeTitle("Ζωάκια 2") === "Ζωάκια 3" && nextVolumeTitle("Farm Animals 19 ") === "Farm Animals 20", "titles count up");
const belongs = createPageFromTemplate(1, space, "belongs-to");
const stickers = createPageFromTemplate(2, space, "stickers");
const art = page("art", [stamp("pic", 400)], { fillDataUrl: "data:paint", thumbnailDataUrl: "data:thumb", traceImage: { src: "x", opacity: 0.3 }, backgroundPatternId: "stars" });
const sketch: BookPage = { ...page("sketch", []), lines: [{ id: "l", tool: "pen", strokeWidth: 5, points: [0, 0, 20, 30, 60, 10] }] };
ok(!isPicturePage(belongs) && !isPicturePage(stickers) && isPicturePage(art) && isPicturePage(sketch), "front matter and sticker pages are structure; pictures and hand drawings are content");
let book = applyFrameToAll([belongs, art, sketch, stickers], FRAMES[0].id);
book = repeatOnAllPages(book.map((p) => (p.id === "art" ? { ...p, objects: [...p.objects, stamp("logo", 40)] } : p)), "art", ["logo"]);
book = applyPageNumbers(book, "center");
const v2 = nextVolumePages(book);
const kinds = (p: BookPage) => p.objects.map((o) => (o.kind === "stamp" && o.isFrame ? "frame" : o.repeatId ? "repeat" : o.role === "pageNumber" ? "number" : o.kind)).sort().join();
ok(v2.length === 4 && kinds(v2[1]) === "frame,number,repeat" && v2[2].lines.length === 0 && kinds(v2[2]) === "frame,number,repeat", "picture pages are emptied but keep frame, repeated logo and page number");
ok(v2[1].backgroundPatternId === "stars" && !v2[1].fillDataUrl && !v2[1].thumbnailDataUrl && !v2[1].traceImage, "…and their background; paint, preview and tracing photo are dropped");
ok(v2[0].objects.length === book[0].objects.length && v2[3].lines.length === 12, "front matter and the sticker page are copied whole");
ok(v2.every((p, i) => p.id !== book[i].id) && !v2.flatMap((p) => p.objects).some((o) => book.flatMap((p) => p.objects).some((b) => b.id === o.id)), "the new volume shares no ids with the original");
ok(book[1].objects.length === 4 && book[1].fillDataUrl === "data:paint", "the original book is untouched");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
