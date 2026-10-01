import { bookReadiness, KDP_MIN_PAGES } from "../../src/utils/readiness";
import type { BookPage } from "../../src/types/editor";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const space = { width: 612, height: 792, bleed: 0 };
// Every line is a little different, so no two test pages repeat each other (that has its own check).
let drawn = 0;
const line = (w: number, x = 200) => ({ id: "l" + Math.random(), tool: "pen" as const, strokeWidth: w, points: [x, 200 + (drawn += 4), x + 100, 300 + drawn] });
const page = (i: number, extra: Partial<BookPage> = {}): BookPage => ({ id: "p" + i, pageNumber: i + 1, space, lines: [line(6)], objects: [], ...extra });
const book = (n: number, f?: (i: number) => Partial<BookPage>) => Array.from({ length: n }, (_, i) => page(i, f?.(i)));

const perfect = bookReadiness(book(KDP_MIN_PAGES));
ok(perfect.score === 100 && perfect.level === "ready" && perfect.items.every((i) => i.ok), "24 clean pages = 100, ready");
ok(bookReadiness([]).score === 0, "no pages = 0");

const short = bookReadiness(book(10));
ok(short.score === 80 && short.level === "almost", `10 pages: -10 under KDP minimum, -10 not a multiple of 4 → ${short.score}`);

const thin = bookReadiness(book(24, (i) => (i < 2 ? { lines: [line(1)] } : {})));
ok(thin.score === 92 && thin.items.find((i) => i.id === "thin-strokes")!.pageIds.length === 2, `2 pages with thin lines: -8 → ${thin.score}`);

const edge = bookReadiness(book(24, (i) => (i === 0 ? { lines: [line(6, 1)] } : {})));
ok(edge.items.find((i) => i.id === "margin")!.pageIds[0] === "p0" && edge.score === 95, `line past the margin on page 1: -5 → ${edge.score}`);

const empty = bookReadiness(book(24, (i) => (i < 3 ? { lines: [] } : i === 3 ? { lines: [], isBlankBack: true } : {})));
ok(empty.items.find((i) => i.id === "empty-pages")!.count === 3 && empty.score === 85, `3 empty pages (blank back not counted): -15 → ${empty.score}`);

const worst = bookReadiness(book(3, () => ({ lines: [line(1, 1)] })));
ok(worst.level === "work" && worst.score >= 0, `many problems → needs work (${worst.score})`);
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
