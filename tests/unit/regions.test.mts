import { colorableRegions, colorPreview, findRegions, numberRegions, NUMBER_COLORS } from "../../src/components/studio/editor/regions";
import { colorByNumberPage } from "../../src/components/editor/colorByNumber";
import { chainStrokes, connectDotsFromPage, resamplePath } from "../../src/components/editor/worksheets";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

// A 200×160 transparent "page" with black rectangle outlines drawn on it.
const W = 200, H = 160;
function canvas(rects: [number, number, number, number][], open?: [number, number]) {
  const data = new Uint8ClampedArray(W * H * 4);
  const ink = (x: number, y: number) => { const o = (y * W + x) * 4; data[o] = data[o + 1] = data[o + 2] = 0; data[o + 3] = 255; };
  for (const [x0, y0, x1, y1] of rects) for (let t = 0; t < 2; t++) {
    for (let x = x0; x <= x1; x++) { ink(x, y0 + t); ink(x, y1 - t); }
    for (let y = y0; y <= y1; y++) { ink(x0 + t, y); ink(x1 - t, y); }
  }
  if (open) for (let d = 0; d < 6; d++) for (let t = 0; t < 2; t++) data[((open[1] + t) * W + open[0] + d) * 4 + 3] = 0; // a gap in a top edge
  return { width: W, height: H, data };
}
const boxes: [number, number, number, number][] = [[10, 10, 90, 70], [110, 10, 190, 70], [10, 90, 90, 150], [110, 90, 130, 104]];
const map = findRegions(canvas(boxes));
const areas = colorableRegions(map);
ok(areas.length === 4 && map.regions.filter((r) => r.edge).length === 1, `4 enclosed areas + 1 background (${areas.length})`);
const big = areas[0];
ok(Math.abs(big.x - 50) <= 2 && Math.abs(big.y - 40) <= 2 && big.depth > 25, `label point is deep inside the area (${big.x},${big.y}, depth ${big.depth.toFixed(0)})`);
ok(colorableRegions(findRegions(canvas(boxes, [40, 10]))).length === 3, "an outline with a gap is not an area (it leaks into the background)");

const img = colorPreview(canvas(boxes), 1);
const px = (b: { data: Uint8ClampedArray }, x: number, y: number) => [...b.data.slice((y * W + x) * 4, (y * W + x) * 4 + 4)].join(",");
ok(px(img, 10, 40) === "0,0,0,255", "ink stays black");
ok(px(img, 50, 40) !== "255,255,255,255" && px(img, 50, 40) !== px(img, 2, 2), "an enclosed area is colored, differently from the paper around");
ok(px(img, 50, 40) === px(img, 20, 60), "one area = one color");
ok(px(img, 50, 40) !== px(img, 150, 40), "areas next in line get different colors");
ok(px(colorPreview(canvas(boxes), 1), 50, 40) === px(img, 50, 40) && [2, 3, 4, 5].some((s) => px(colorPreview(canvas(boxes), s), 50, 40) !== px(img, 50, 40)), "same seed = same colors; shuffling changes them");

const nums = numberRegions(map, 3, 7);
ok(nums.length === 4 && nums.every((n) => n.n >= 1 && n.n <= 3), `every area that can hold a number gets one of 3 (${nums.map((n) => n.n).join("")})`);
ok(new Set(nums.slice(0, 3).map((n) => n.n)).size === 3 && nums.every((n, i) => i === 0 || n.n !== nums[i - 1].n), "all colors are used; consecutive areas differ");
ok(numberRegions(findRegions(canvas([[10, 10, 17, 17]])), 3, 1).length === 0, "an area too small for a number gets none");

const space = interiorSpace("8.5x11", false);
const source: BookPage = { id: "p", pageNumber: 3, space, lines: [{ id: "l", tool: "pen", strokeWidth: 4, points: [0, 0, 10, 10] }], objects: [], fillDataUrl: "data:x", traceImage: { src: "data:y", opacity: 0.3 } };
const cbn = colorByNumberPage(source, nums)!;
const texts = cbn.objects.filter((o) => o.kind === "text").map((o) => (o as { text: string }).text);
ok(cbn.id !== source.id && cbn.lines.length === 1 && cbn.lines[0].id !== "l", "color by number is a copy of the page (new ids), the original is untouched");
ok(texts.filter((s) => /^\d$/.test(s)).length === 4, "a number sits in each area");
ok([1, 2, 3].every((n) => texts.includes(`${n} ${NUMBER_COLORS[n - 1].name}`)) && cbn.objects.filter((o) => o.kind === "shape" && (o as { shapeKind: string }).shapeKind === "circle").length === 3, "the key lists each color used, with a swatch");
ok(!cbn.fillDataUrl && !cbn.traceImage, "the copy carries no paint and no tracing photo");
ok(colorByNumberPage(source, []) === null, "nothing to number → null");

// ---- connect the dots from the user's own strokes
const sq = [[100, 100, 300, 100, 300, 300], [300, 304, 100, 300, 100, 104], [180, 180, 200, 200]];
const chain = chainStrokes(sq, 30);
ok(chain.length === 12 && chain[0] === 100 && chain[1] === 100, "strokes that meet end-to-end are joined; a detail drawn apart is left out");
ok(chainStrokes([[0, 0, 50, 0], [200, 0, 60, 0]], 30).join() === "200,0,60,0,50,0,0,0", "a stroke drawn the other way round is flipped to continue the path");
const rs = resamplePath([0, 0, 100, 0], 5);
ok(rs.map((p) => p[0]).join() === "0,25,50,75,100", "resample: evenly spaced, both ends kept");
const mine: BookPage = { id: "m", pageNumber: 1, space, objects: [], lines: sq.map((points, i) => ({ id: "s" + i, tool: "pen" as const, strokeWidth: 4, points })) };
const dp = connectDotsFromPage(mine, space, 20)!;
const dots = dp.objects.filter((o) => o.kind === "shape");
const labels = dp.objects.filter((o) => o.kind === "text").map((o) => (o as { text: string }).text).filter((s) => /^\d+$/.test(s));
ok(dots.length === 19 && labels[0] === "1" && labels.at(-1) === "19", `closed outline: ${dots.length} dots numbered 1..19 (no double dot where it closes)`);
ok(dots.every((o) => o.x >= 36 && o.x + o.width <= 612 - 36 && o.y >= 36 && o.y + o.height <= 792 - 36), "dots stay inside the safe area");
ok(connectDotsFromPage({ ...mine, lines: [] }, space, 20) === null && connectDotsFromPage({ ...mine, lines: [mine.lines[2]] }, space, 20) === null, "no outline (or only a scribble) → null");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
