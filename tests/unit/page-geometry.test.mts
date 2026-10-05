import { convertPage, interiorSpace, LEGACY_SPACE, spaceTransform } from "../../src/utils/pageGeometry";
import { coverLayout, spineWidthPt, refitCover, emptyCover } from "../../src/utils/coverGeometry";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

const letter = interiorSpace("8.5x11", false);
ok(letter.width === 612 && letter.height === 792, "Letter canvas 612×792");
const letterBleed = interiorSpace("8.5x11", true);
ok(letterBleed.width === 630 && letterBleed.height === 810, "Letter + bleed canvas 630×810");

// Legacy A4 → Letter: same scale+center the old exporter's `fit` used
const { k, dx, dy } = spaceTransform(LEGACY_SPACE, letter);
ok(near(k, Math.min(612 / 595, 792 / 842)) && near(dy, 0) && dx > 0, `legacy→Letter k=${k.toFixed(4)} dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);
const legacy = { id: "p", pageNumber: 1, lines: [{ id: "l", tool: "pen" as const, strokeWidth: 6, points: [297.5, 421, 0, 0] }], objects: [{ kind: "shape" as const, id: "s", shapeKind: "rectangle" as const, x: 0, y: 0, width: 595, height: 842, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 1 }] };
const conv = await convertPage(legacy, letter);
ok(near(conv.lines[0].points[0], 306) && near(conv.lines[0].points[1], 396), "legacy page center → Letter center");
ok(near(conv.objects[0].x + 595 * conv.objects[0].scaleX, 612 - dx), "full-page object stays letterboxed exactly like the old export");

// Bleed toggle: same trim, pure 9pt shift, no scale
const b = spaceTransform(letter, letterBleed);
ok(b.k === 1 && b.dx === 9 && b.dy === 9, "bleed on: shift 9pt, no scaling");
const back = spaceTransform(letterBleed, letter);
ok(back.k === 1 && back.dx === -9 && back.dy === -9, "bleed off: shift back");

// KDP spine: 100 white pages → 0.2252in
ok(near(spineWidthPt(100, "white") / 72, 0.2252, 1e-9), "spine: 100 pages white = 0.2252in");
ok(near(spineWidthPt(100, "cream") / 72, 0.25, 1e-9), "spine: 100 pages cream = 0.25in");
ok(near(spineWidthPt(3, "white"), spineWidthPt(24, "white")), "spine floor at KDP's 24-page minimum");
// KDP cover for 8.5x11, 100 white pages: width = 0.125+8.5+0.2252+8.5+0.125 = 17.4752in, height 11.25in
const L = coverLayout("8.5x11", 100, "white");
ok(near(L.space.width / 72, 17.4752, 1e-6) && near(L.space.height / 72, 11.25), `cover 17.4752×11.25in (got ${(L.space.width/72).toFixed(4)}×${(L.space.height/72).toFixed(4)})`);
ok(!coverLayout("8.5x11", 79, "white").spineTextAllowed && coverLayout("8.5x11", 80, "white").spineTextAllowed, "spine text from 80 pages");

// Refit: front-cover object moves by the full spine change, back stays, spine by half
const c0 = emptyCover(coverLayout("8.5x11", 100, "white"), "c");
const mk = (id: string, x: number) => ({ kind: "shape" as const, id, shapeKind: "rectangle" as const, x, y: 100, width: 20, height: 20, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 1 });
c0.page.objects = [mk("back", 100), mk("spine", L.spineRect.left + L.spine / 2 - 10), mk("front", L.front.left + 100)];
const L2 = coverLayout("8.5x11", 300, "white");
const c1 = refitCover(c0, L2);
const d = L2.spine - L.spine;
const byId = Object.fromEntries(c1.page.objects.map(o => [o.id, o.x]));
ok(near(byId.back, 100) && near(byId.spine - (L.spineRect.left + L.spine / 2 - 10), d / 2) && near(byId.front - (L.front.left + 100), d), `refit: back 0, spine +${(d/2).toFixed(2)}, front +${d.toFixed(2)}`);
ok(near(byId.front, L2.front.left + 100), "front object keeps its place on the front panel");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
