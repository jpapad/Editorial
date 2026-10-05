import { findGaps } from "../../src/components/studio/editor/gapCheck";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
function page(gaps: [number, number][]) {
  const w = 240, h = 240, data = new Uint8ClampedArray(w * h * 4);
  const ink = (x: number, y: number) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (Math.round(y) * w + Math.round(x)) * 4; data[i] = data[i+1] = data[i+2] = 0; data[i+3] = 255; };
  const inGap = (side: string, i: number) => gaps.some(([s, len]) => (["top","right","bottom","left"][s] === side) && i >= 110 && i < 110 + len);
  for (let tk = -1; tk <= 1; tk++) for (let i = 40; i <= 200; i++) {
    if (!inGap("top", i)) ink(i, 40 + tk); if (!inGap("bottom", i)) ink(i, 200 + tk);
    if (!inGap("left", i)) ink(40 + tk, i); if (!inGap("right", i)) ink(200 + tk, i);
  }
  return { w, h, data, ink };
}
// Render a bridge stroke (thick line) into the buffer
function drawBridge(pg: ReturnType<typeof page>, pts: number[], width: number) {
  const [x1, y1, x2, y2] = pts; const L = Math.hypot(x2 - x1, y2 - y1); const r = width / 2;
  for (let s = 0; s <= L; s += 0.5) { const cx = x1 + (x2 - x1) * s / L, cy = y1 + (y2 - y1) * s / L; for (let dy = -r; dy <= r; dy += 0.5) for (let dx = -r; dx <= r; dx += 0.5) if (dx * dx + dy * dy <= r * r) pg.ink(cx + dx, cy + dy); }
}
for (const [label, gaps] of [["one 10px gap (right side)", [[1, 10]]], ["two gaps (top 8px, left 11px)", [[0, 8], [3, 11]]]] as const) {
  const pg = page(gaps as unknown as [number, number][]);
  const buf = { width: pg.w, height: pg.h, data: pg.data };
  const found = findGaps(buf);
  ok(found.length === gaps.length, `${label}: found ${found.length}`);
  for (const m of found) drawBridge(pg, m.bridge.points, m.bridge.width);
  const after = findGaps(buf);
  ok(after.length === 0, `${label}: closed after bridging (${after.length} left); bridges ${found.map(m => m.bridge.points.map(v => v.toFixed(0)).join(",") + " w" + m.bridge.width.toFixed(1)).join(" | ")}`);
}
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
