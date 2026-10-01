import { traceLoops, vectorize } from "../../src/components/studio/editor/vectorize";
import { arcPath, eraseSegment } from "../../src/components/editor/strokeTools";
import type { LineData } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

// ---- vectorize: a white image with black shapes painted on it
function image(w: number, h: number, paint: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (paint(x, y)) data[(y * w + x) * 4] = data[(y * w + x) * 4 + 1] = data[(y * w + x) * 4 + 2] = 0;
  return { width: w, height: h, data };
}
const shoelace = (pts: [number, number][]) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0) / 2);
const solid = traceLoops(image(40, 40, (x, y) => x >= 10 && x < 30 && y >= 5 && y < 20));
ok(solid.length === 1 && solid[0].length === 4 && shoelace(solid[0]) === 20 * 15, "a filled rectangle is one loop of 4 corners with the right area");
const ring = traceLoops(image(40, 40, (x, y) => x >= 5 && x < 35 && y >= 5 && y < 35 && !(x >= 10 && x < 30 && y >= 10 && y < 30)));
ok(ring.length === 2 && ring.map(shoelace).sort((a, b) => a - b).join() === "400,900", "a ring gives an outer loop and a hole");
const diag = traceLoops(image(10, 10, (x, y) => (x === 2 && y === 2) || (x === 3 && y === 3)));
ok(diag.length === 2 && diag.every((l) => shoelace(l) === 1), "pixels touching only at a corner stay two separate shapes");
ok(traceLoops(image(8, 8, () => true)).length === 1 && traceLoops(image(8, 8, () => false)).length === 0, "all-dark image = one loop round the edge; blank image = nothing");

const circle = image(200, 200, (x, y) => { const d = Math.hypot(x - 100, y - 100); return d < 80 && d > 70; });
const v = vectorize(circle);
ok(v.paths === 2 && v.svg.includes('fill-rule="evenodd"') && v.svg.includes('viewBox="0 0 200 200"'), "a drawn circle line = outer + inner outline, punched out with evenodd");
ok(v.points < 120 && v.points > 20, `the outline is simplified, not one point per pixel (${v.points} points)`);
ok(!/NaN|undefined/.test(v.svg) && /^<svg[^>]+><path[^>]+d="M[\d. ]+Q/.test(v.svg), "valid path data");
const dusty = image(60, 60, (x, y) => (x === 5 && y === 5) || (x >= 20 && x < 40 && y >= 20 && y < 40));
ok(vectorize(dusty).paths === 1 && vectorize(dusty, { minArea: 0 }).paths === 2, "single-pixel dust is dropped (unless asked to keep it)");
const grey = image(20, 20, () => false); for (let i = 0; i < 20 * 20; i++) grey.data[i * 4] = grey.data[i * 4 + 1] = grey.data[i * 4 + 2] = 150;
ok(vectorize(grey).paths === 0 && vectorize(grey, { threshold: 80 }).paths === 1, "the threshold decides what counts as line");

// ---- segment eraser
const pen = (id: string, points: number[], tool: "pen" | "eraser" = "pen"): LineData => ({ id, tool, strokeWidth: 4, points });
const cross = [pen("h", [0, 50, 100, 50]), pen("v1", [30, 0, 30, 100]), pen("v2", [70, 0, 70, 100])];
const mid = eraseSegment(cross, "h", 50, 50);
const hs = mid.filter((l) => l.id.startsWith("h"));
ok(hs.length === 2 && hs[0].points.join() === "0,50,30,50" && hs[1].points.join() === "70,50,100,50", "clicking between two crossings removes just that piece, leaving both ends");
const end = eraseSegment(cross, "h", 90, 50).filter((l) => l.id.startsWith("h"));
ok(end.length === 1 && end[0].points.join() === "0,50,70,50", "clicking the overshoot past a crossing trims it back to the crossing");
ok(eraseSegment(cross, "v1", 30, 10).find((l) => l.id === "v1")!.points.join() === "30,50,30,100", "works on the other stroke too");
ok(eraseSegment([pen("solo", [0, 0, 50, 50])], "solo", 20, 20).length === 0, "a stroke nothing crosses is removed whole");
ok(eraseSegment(cross, "nope", 0, 0) === cross && eraseSegment([pen("e", [0, 0, 9, 9], "eraser")], "e", 1, 1).length === 1, "unknown ids and eraser strokes are left alone");
const withEraser = [pen("h", [0, 50, 100, 50]), pen("x", [50, 0, 50, 100], "eraser")];
ok(eraseSegment(withEraser, "h", 10, 50).filter((l) => l.tool === "pen").length === 0, "an eraser stroke crossing the line is not a cut point");
ok(mid.filter((l) => l.id.startsWith("v")).every((l, i) => l === cross[i + 1]) && new Set(mid.map((l) => l.id)).size === mid.length, "other strokes are untouched; the two leftovers have distinct ids");

// ---- text on a curve
ok(arcPath(200, 0) === "M0 0L200 0", "no bend = a straight line");
const up = arcPath(200, 90).match(/[\d.]+/g)!.map(Number);
const r = 200 / (Math.PI / 2);
ok(Math.abs(up[2] - r) < 0.01 && Math.abs(up[up.length - 2] + up[0] - 200) < 0.01 && up[1] > 0, "arch: radius gives an arc exactly as long as the text box, centred on it");
ok(/A[\d. ]+ 0 0 1 /.test(arcPath(200, 90)) && /A[\d. ]+ 0 0 0 /.test(arcPath(200, -90)) && /A[\d. ]+ 0 1 1 /.test(arcPath(200, 270)), "arch sweeps one way, smile the other; past 180° uses the large arc");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
