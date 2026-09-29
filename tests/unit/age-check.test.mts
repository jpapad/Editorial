import { checkAge } from "../../src/components/studio/editor/ageCheck";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const W = 612, H = 792;
function page(draw: (ink: (x: number, y: number) => void) => void) {
  const data = new Uint8ClampedArray(W * H * 4);
  const ink = (x: number, y: number) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; data[i] = data[i+1] = data[i+2] = 0; data[i+3] = 255; };
  draw(ink); return { width: W, height: H, data };
}
// Big circle, 8pt line
const simple = page((ink) => { for (let a = 0; a < 6.3; a += 0.002) for (let t = -4; t <= 4; t += 0.5) ink(306 + (200 + t) * Math.cos(a), 396 + (200 + t) * Math.sin(a)); });
// Dense grid 20x20pt cells, 2pt lines
const dense = page((ink) => { for (let x = 100; x <= 500; x += 20) for (let y = 100; y <= 600; y++) for (let t = 0; t < 2; t++) ink(x + t, y); for (let y = 100; y <= 600; y += 20) for (let x = 100; x <= 500; x++) for (let t = 0; t < 2; t++) ink(x, y + t); });
const a = checkAge(simple, "3-5");
ok(a.verdict === "good" && a.areas === 1 && a.lineWidth >= 6, `simple circle, ages 3–5: ${a.verdict}, ${a.areas} area, line ${a.lineWidth}pt`);
const b = checkAge(dense, "3-5");
ok(b.verdict === "too-detailed" && b.tooSmall.length > 100, `dense grid, ages 3–5: ${b.verdict}, ${b.tooSmall.length} too small, line ${b.lineWidth}pt, advice ${b.advice.length}`);
const c = checkAge(dense, "9+");
ok(c.tooSmall.length === 0 && c.verdict === "good", `dense grid, adults: ${c.verdict}, ${c.areas} areas`);
ok(checkAge(page(() => {}), "6-8").verdict === "empty", "empty page");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
