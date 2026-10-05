import { curveThrough, moveStrokes, strokeAt, strokeBounds, strokesInRect } from "../../src/components/editor/strokeTools";
import { snapBox, snapTargets } from "../../src/utils/snapping";
import { placeMyStamp, toMyStamp } from "../../src/utils/myStamps";
import type { LineData, PageObject } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const near = (a: number, b: number, e = 0.01) => Math.abs(a - b) <= e;

// ---- curve
const anchors = [0, 0, 100, 100, 200, 0];
const c = curveThrough(anchors);
const hits = (pts: number[], x: number, y: number) => pts.some((_, i) => i % 2 === 0 && near(pts[i], x) && near(pts[i + 1], y));
ok(c.length > 40 && anchors.every((_, i) => i % 2 !== 0 || hits(c, anchors[i], anchors[i + 1])), `curve is dense (${c.length / 2} pts) and passes through every anchor`);
ok(near(c[0], 0) && near(c[1], 0) && near(c.at(-2)!, 200) && near(c.at(-1)!, 0), "open curve starts and ends on the first and last anchor");
let maxStep = 0; for (let i = 2; i < c.length; i += 2) maxStep = Math.max(maxStep, Math.hypot(c[i] - c[i - 2], c[i + 1] - c[i - 1]));
ok(maxStep < 20, `no long straight jumps (longest step ${maxStep.toFixed(1)})`);
const closed = curveThrough(anchors, true);
ok(near(closed[0], closed.at(-2)!) && near(closed[1], closed.at(-1)!) && closed.length > c.length, "closed curve returns to its start");
ok(curveThrough([5, 5, 50, 80]).join() === "5,5,50,80" && curveThrough([5, 5]).join() === "5,5", "two anchors = a straight line; one = nothing to smooth");

// ---- selecting strokes
const pen = (id: string, points: number[], tool: "pen" | "eraser" = "pen"): LineData => ({ id, tool, strokeWidth: 4, points });
const lines = [pen("a", [10, 10, 50, 10]), pen("b", [100, 100, 150, 150]), pen("e", [10, 10, 50, 10], "eraser"), pen("c", [200, 20, 260, 20])];
ok(strokesInRect(lines, { left: 0, top: 0, right: 60, bottom: 60 }).join() === "a", "box picks pen strokes inside it — never eraser strokes");
ok(strokesInRect(lines, { left: 40, top: 0, right: 220, bottom: 200 }).join() === "a,b,c", "a stroke partly inside the box is picked");
ok(strokeAt(lines, 125, 127, 4) === "b" && strokeAt(lines, 125, 160, 4) === null && strokeAt(lines, 30, 11, 4) === "a", "a tap picks the stroke under it (not the eraser stroke on top), nothing when it misses");
const b = strokeBounds(lines[1]);
ok(b.left === 98 && b.right === 152 && b.top === 98, "stroke bounds include the line's thickness");
const movedLines = moveStrokes(lines, ["b"], 10, -5);
ok(movedLines[1].points.join() === "110,95,160,145" && movedLines[0] === lines[0] && lines[1].points[0] === 100, "move shifts only the picked strokes, without touching the originals");

// ---- smart guides
const targets = snapTargets([{ left: 0, top: 0, right: 600, bottom: 800 }, { left: 100, top: 100, right: 200, bottom: 200 }]);
const s1 = snapBox({ left: 247, top: 400, right: 347, bottom: 500 }, targets, 6);
ok(s1.dx === 3 && s1.guides.some((g) => g.axis === "x" && g.at === 300), "centre snaps to the page centre, with a guide there");
const s2 = snapBox({ left: 203, top: 96, right: 263, bottom: 156 }, targets, 6);
ok(s2.dx === -3 && s2.dy === 4, "edges snap to another object's edges (each axis on its own)");
const s3 = snapBox({ left: 420, top: 620, right: 450, bottom: 650 }, targets, 6);
ok(s3.dx === 0 && s3.dy === 0 && s3.guides.length === 0, "nothing within reach → no snap, no guide");
ok(snapBox({ left: 104, top: 300, right: 130, bottom: 320 }, targets, 6).dx === -4 && snapBox({ left: 107, top: 300, right: 133, bottom: 320 }, targets, 6).dx === 0, "snaps only inside the tolerance");

// ---- my stamps
const star: PageObject = { kind: "shape", id: "s1", shapeKind: "star", x: 140, y: 240, width: 50, height: 50, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 3, locked: true, repeatId: "r1", groupId: "g1" };
const label: PageObject = { kind: "text", id: "t1", text: "Hi", x: 200, y: 300, width: 80, height: 20, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "Arial", fontSize: 14, align: "center", fill: "#000", isDragging: false, groupId: "g1" };
const saved = toMyStamp([star, label], "Star + label", "data:image/png;base64,xx")!;
ok(saved.width === 140 && saved.height === 80 && saved.objects[0].x === 0 && saved.objects[0].y === 0 && saved.objects[1].x === 60, "saved piece is positioned from its own top-left corner");
ok(!saved.objects[0].locked && !saved.objects[0].repeatId, "page-specific flags (locked, repeat) are dropped");
const placed = placeMyStamp(saved, 300, 400);
const placed2 = placeMyStamp(saved, 300, 400);
ok(placed[0].x === 230 && placed[0].y === 360 && placed[1].x === 290, "placing centres the piece on the given point, keeping its layout");
ok(placed[0].id !== "s1" && placed[0].id !== placed2[0].id && placed[0].groupId === placed[1].groupId && placed[0].groupId !== "g1" && placed[0].groupId !== placed2[0].groupId, "each placement gets fresh ids and its own group");
ok(placeMyStamp(toMyStamp([star], "One", "x")!, 0, 0)[0].groupId === undefined && toMyStamp([], "none", "x") === null, "a single object isn't grouped; an empty selection can't be saved");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
