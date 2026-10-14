// Page art for the kids' mobile app: once editing pauses, each page's lines are
// drawn on a hidden canvas, uploaded to Storage and linked from the page
// (artUrl + artKey). Blank backs are skipped; a page that changes gets new art.
import fs from "node:fs";
import { BASE, launch, newPage, check, draw, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase, bookRow, TEST_USER } from "./mockSupabase.mjs";

const supabaseBase = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1].replace(/\/$/, "");
const PNG = fs.readFileSync(new URL("../../public/icon-maskable-512.png", import.meta.url));
const space = { width: 612, height: 792, bleed: 0 };
const pages = [
  { id: "p1", pageNumber: 1, space, lines: [], objects: [{ kind: "stamp", id: "s1", src: `${supabaseBase}/storage/v1/object/public/book-images/${TEST_USER.id}/picture.png`, x: 156, y: 150, width: 300, height: 300, rotation: 0, scaleX: 1, scaleY: 1 }] },
  { id: "p2", pageNumber: 2, space, lines: [], objects: [{ kind: "shape", id: "h1", shapeKind: "heart", x: 200, y: 250, width: 200, height: 200, rotation: 0, scaleX: 1, scaleY: 1, fill: "#ffffff", stroke: "#111827", strokeWidth: 6 }] },
  { id: "p3", pageNumber: 3, space, lines: [], objects: [], isBlankBack: true },
];

const b = await launch();
const p = await newPage(b, { viewport: { width: 1440, height: 1000 } });
const db = await mockSupabase(p, { books: [bookRow({ title: "Art book", pages })] });
db.storage = { [`book-images/${TEST_USER.id}/picture.png`]: { type: "image/png", body: PNG } };
const book = () => db.books[0].pages;
const waitFor = async (cond, ms = 60000) => { for (let t = 0; t < ms && !cond(); t += 250) await p.waitForTimeout(250); return cond(); };
const pngSize = (key) => { const f = db.storage[key]?.body; return f ? [f.readUInt32BE(16), f.readUInt32BE(20)] : null; };
const storageKey = (url) => url && decodeURIComponent(new URL(url).pathname.replace("/storage/v1/object/public/", ""));

await p.goto(`${BASE}/studio/editor?book=${bookRow().id}`);
await p.waitForSelector("canvas", { timeout: 30000 });

check(await waitFor(() => book().filter((pg) => !pg.isBlankBack).every((pg) => pg.artUrl && pg.artKey)), "both pages get art once editing pauses", JSON.stringify(book().map((pg) => [pg.id, Boolean(pg.artUrl)])));
const [art1, art2] = book().map((pg) => storageKey(pg.artUrl));
check(Boolean(art1 && db.storage[art1] && art2 && db.storage[art2]), "the art is uploaded to Storage and linked from the page", `${art1} | ${art2}`);
check(art1?.startsWith(`book-images/${TEST_USER.id}/art/`) && art1.endsWith(".png"), "kept as PNG in art/ inside the owner's folder, apart from their pictures", art1);
const [w, h] = pngSize(art1) ?? [0, 0];
check(h === 2048 && Math.abs(w - Math.round((2048 * 612) / 792)) <= 1, "2048 px on the long side, the page's proportions", `${w}×${h}`);
check(art1 !== art2, "each page has its own picture");
check(!book()[2].artUrl, "the blank back gets none");
for (const [i, key] of [art1, art2].entries()) if (db.storage[key]) fs.writeFileSync(shot(`page-art-${i + 1}.png`), db.storage[key].body);

// Draw on page 1: its art is made again for the new lines.
const before = { url: book()[0].artUrl, key: book()[0].artKey };
const cb = await p.locator("canvas").first().boundingBox();
await p.keyboard.press("p");
await draw(p, cb, [[120, 120], [300, 200], [200, 400]]);
check(await waitFor(() => book()[0].artKey && book()[0].artKey !== before.key), "a page that changes gets new art", `${before.key} → ${book()[0].artKey}`);
check(book()[0].artUrl !== before.url && db.storage[storageKey(book()[0].artUrl)], "…as a new picture in Storage");
check(book()[1].artKey === pages[1].artKey || book()[1].artUrl === db.books[0].pages[1].artUrl, "the untouched page keeps its art");
noPageErrors(p);
await b.close();
