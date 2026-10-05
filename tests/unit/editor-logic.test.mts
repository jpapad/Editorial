import { findGaps } from "../../src/components/studio/editor/gapCheck";
import { objectBounds, flippedHorizontally, flippedVertically, alignDeltas, distributeDeltas, fitInside } from "../../src/utils/objectGeometry";
import { symmetricCopies, smoothStroke } from "../../src/components/editor/strokeTools";
import { polygonPoints } from "../../src/components/editor/shapeGeometry";

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) fails++; };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// --- gap check: 200x200 white page, square outline 3px thick ---
function page(drawGap: boolean, gapPx = 5) {
  const w = 200, h = 200, data = new Uint8ClampedArray(w * h * 4);
  const ink = (x: number, y: number) => { const i = (y * w + x) * 4; data[i] = data[i+1] = data[i+2] = 0; data[i+3] = 255; };
  for (let t = 0; t < 3; t++) for (let i = 50; i <= 150; i++) {
    ink(i, 50 + t); ink(i, 148 + t); ink(50 + t, i);
    const inGap = drawGap && i >= 100 && i < 100 + gapPx;
    if (!inGap) ink(148 + t, i);
  }
  return { width: w, height: h, data };
}
ok(findGaps(page(false)).length === 0, "closed square: no gaps");
const g = findGaps(page(true, 5));
ok(g.length === 1, `square with 5px gap: 1 marker (got ${g.length})`);
ok(g.length === 1 && Math.abs(g[0].x - 149) < 4 && Math.abs(g[0].y - 102) < 5, `marker at the gap (${g[0]?.x.toFixed(1)}, ${g[0]?.y.toFixed(1)})`);
ok(findGaps(page(true, 24)).length === 0, "24px opening is a doorway, not a gap (beyond radius)");

// --- geometry ---
const box = { x: 10, y: 20, width: 100, height: 50, rotation: 0, scaleX: 1, scaleY: 1 };
const b = objectBounds(box);
ok(b.left === 10 && b.top === 20 && b.right === 110 && b.bottom === 70, "unrotated bounds");
const fh = { ...box, ...flippedHorizontally(box) };
const bh = objectBounds(fh);
ok(near(bh.left, 10) && near(bh.right, 110) && fh.scaleX === -1, "flip H keeps bounds in place");
const rot = { ...box, rotation: 90 };
const fr = { ...rot, ...flippedHorizontally(rot) };
const br0 = objectBounds(rot), br1 = objectBounds(fr);
ok(near(br0.left, br1.left) && near(br0.top, br1.top) && near(br0.right, br1.right) && near(br0.bottom, br1.bottom), "flip H of rotated object keeps bounds");
const fv = { ...rot, ...flippedVertically(rot) };
const bv = objectBounds(fv);
ok(near(br0.left, bv.left) && near(br0.top, bv.top), "flip V of rotated object keeps bounds");
const objs = [box, { ...box, x: 200 }, { ...box, x: 60 }];
const al = alignDeltas(objs, "left", { left: 0, top: 0, right: 500, bottom: 500 });
ok(al.every((d, i) => near(objs[i].x + d.dx, 0)), "align left");
const dist = distributeDeltas([{ ...box, x: 0 }, { ...box, x: 130 }, { ...box, x: 400 }], "x");
ok(near(dist[0].dx, 0) && near(dist[2].dx, 0) && near(130 + dist[1].dx, 200), `distribute x (middle -> ${130 + dist[1].dx})`);
const fit = fitInside({ ...box, x: -30 }, { left: 0, top: 0, right: 500, bottom: 500 });
ok(objectBounds(fit).left >= 0, "fitInside shifts in");
const big = fitInside({ ...box, width: 1000 }, { left: 0, top: 0, right: 500, bottom: 500 });
ok(objectBounds(big).right <= 500 + 1e-6 && objectBounds(big).left >= -1e-6, "fitInside shrinks oversize");

// --- symmetry ---
const copies = symmetricCopies([10, 20, 30, 40], "mirror-x", 100, 100);
ok(copies.length === 1 && copies[0][0] === 190 && copies[0][1] === 20, "mirror-x copy");
ok(symmetricCopies([1, 2], "quad", 0, 0).length === 3, "quad: 3 copies");
const r8 = symmetricCopies([100, 0], "radial-8", 0, 0);
ok(r8.length === 7 && near(r8[1][0], 0) && near(r8[1][1], 100), "radial-8 rotates 90° at step 2");
const sm = smoothStroke([0, 0, 10, 10, 0, 20, 10, 30, 0, 40], 1);
ok(sm[0] === 0 && sm[1] === 0 && sm[8] === 0 && sm[9] === 40, "smoothing keeps endpoints");

// --- shapes stay within their box ---
for (const k of ["triangle", "star", "heart", "hexagon"] as const) {
  const p = polygonPoints(k, 140, 140);
  const xs = p.filter((_, i) => i % 2 === 0), ys = p.filter((_, i) => i % 2 === 1);
  ok(Math.min(...xs) >= -0.01 && Math.max(...xs) <= 140.01 && Math.min(...ys) >= -0.01 && Math.max(...ys) <= 140.01, `${k} inside its box`);
}
console.log(fails ? `${fails} FAILED` : "ALL PASSED");
process.exit(fails ? 1 : 0);
