import { cleanSketch } from "../../src/components/studio/editor/sketchCleanup";
const w = 400, h = 300, data = new Uint8ClampedArray(w * h * 4);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const paper = 110 + (x / w) * 140;              // shadow: 110 on the left → 250 on the right
  let v = paper + (rnd() - 0.5) * 10;             // paper grain
  if (Math.abs(y - 150) <= 1) v = paper * 0.72;   // faint pencil line, 28% darker than local paper
  if (rnd() < 0.0015) v = paper * 0.6;            // isolated dust specks
  const i = (y * w + x) * 4; data[i] = data[i+1] = data[i+2] = v; data[i+3] = 255;
}
// Global threshold baseline (what the old filter effectively does at 50%)
let globalLeftBlack = 0; for (let y = 0; y < h; y++) for (let x = 0; x < 60; x++) if (data[(y*w+x)*4] < 128) globalLeftBlack++;
const r = cleanSketch({ width: w, height: h, data }, { sensitivity: 0.12, bolder: false });
const { width: cw, height: ch, data: out } = r.buffer;
const inkAt = (x: number, y: number) => out[(y * cw + x) * 4 + 3] > 0;
let best = 0;
for (let y = 0; y < ch; y++) { let c = 0; for (let x = 0; x < cw; x++) if (inkAt(x, y)) c++; if (c > best) best = c; }
const offLine = r.inkPixels - best * 3;
console.log(`global threshold: ${(100 * globalLeftBlack / (60 * h)).toFixed(0)}% of the shadowed left strip turns black`);
console.log(`adaptive: line row covers ${(100 * best / w).toFixed(0)}% of the width (crop ${cw}x${ch}), stray ink px ≈ ${Math.max(0, offLine)}`);
const pass = best / w > 0.95 && offLine < 200;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
