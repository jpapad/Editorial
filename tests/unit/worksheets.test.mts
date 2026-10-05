import { generateMaze, seededRandom, connectDotsPage, mazePage, letterTracingPage, spotTheDifference, numberTracingPage } from "../../src/components/editor/worksheets";
import { interiorSpace } from "../../src/utils/pageGeometry";
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
for (const [cols, rows] of [[7, 9], [18, 23]]) {
  const { right, bottom } = generateMaze(cols, rows, seededRandom(42));
  // count open passages & BFS reachability
  let open = 0; const adj: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < cols * rows; i++) {
    if (i % cols < cols - 1 && !right[i]) { open++; adj[i].push(i + 1); adj[i + 1].push(i); }
    if (Math.floor(i / cols) < rows - 1 && !bottom[i]) { open++; adj[i].push(i + cols); adj[i + cols].push(i); }
  }
  const seen = new Set([0]); const q = [0]; while (q.length) for (const n of adj[q.shift()!]) if (!seen.has(n)) { seen.add(n); q.push(n); }
  ok(seen.size === cols * rows && open === cols * rows - 1, `maze ${cols}x${rows}: all ${seen.size} cells reachable, ${open} passages = cells-1 (perfect)`);
}
const m1 = mazePage(space, "medium", 7), m2 = mazePage(space, "medium", 7), m3 = mazePage(space, "medium", 8);
ok(JSON.stringify(m1.lines.map(l => l.points)) === JSON.stringify(m2.lines.map(l => l.points)) && JSON.stringify(m1.lines.map(l => l.points)) !== JSON.stringify(m3.lines.map(l => l.points)), "same seed = same maze, new seed = new maze");
const inSafe = (x: number, y: number) => x >= 36 - 0.5 && x <= 612 - 36 + 0.5 && y >= 36 - 0.5 && y <= 792 - 36 + 0.5;
ok(m1.lines.every(l => inSafe(l.points[0], l.points[1]) && inSafe(l.points[2], l.points[3])), "maze stays inside the safe area");
for (const d of ["star", "heart", "house", "fish", "butterfly"] as const) {
  const pg = connectDotsPage(space, d, 30);
  const dots = pg.objects.filter(o => o.kind === "shape").length;
  const nums = pg.objects.filter(o => o.kind === "text").map(o => (o as { text: string }).text).filter(t => /^\d+$/.test(t));
  ok(dots >= 10 && dots === nums.length && nums[0] === "1" && nums.at(-1) === String(dots), `dots ${d}: ${dots} dots numbered 1..${dots}`);
}
const lt = letterTracingPage(space, "α");
ok(lt.objects.some(o => o.kind === "text" && (o as { text: string }).text === "Αα") && lt.objects.some(o => o.kind === "text" && (o as { dashed?: boolean }).dashed), "Greek letter tracing: 'Αα' hero + dashed rows");
const nt = numberTracingPage(space, 7);
ok(nt.objects.filter(o => o.kind === "shape" && (o as { shapeKind: string }).shapeKind === "circle").length === 7, "number 7 page has 7 circles to color");
const src = { id: "s", pageNumber: 1, space, lines: [], objects: Array.from({ length: 8 }, (_, i) => ({ kind: "shape" as const, id: "o" + i, shapeKind: "star" as const, x: 60 + (i % 4) * 120, y: 100 + Math.floor(i / 4) * 300, width: 90, height: 90, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 4 })) };
const sd = spotTheDifference(src, space, 5, 3)!;
ok(sd.made === 5, `spot the difference: ${sd.made} changes`);
const circles = sd.answers.objects.filter(o => o.kind === "shape" && (o as { stroke: string }).stroke === "#c4453f").length;
ok(circles === 5, `answer page circles all ${circles} changes`);
ok(spotTheDifference({ ...src, objects: src.objects.slice(0, 1) }, space, 5, 1) === null, "too-sparse page is refused (null)");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
