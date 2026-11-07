import { addOntoPage, contentBounds, freeArea } from "../../src/utils/placeOnPage";
import { coverStamp } from "../../src/utils/pageBackground";
import { mazePage } from "../../src/components/editor/worksheets";
import { createPageFromTemplate, text } from "../../src/components/editor/pageTemplates";
import { geometryFromSpace, interiorSpace } from "../../src/utils/pageGeometry";
import { objectBounds } from "../../src/utils/objectGeometry";
import type { BookPage } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const { safe } = geometryFromSpace(space);

// A colored farm page: a background scene, a title at the top.
const farm: BookPage = { ...createPageFromTemplate(1, space), background: { image: "data:farm" }, objects: [coverStamp("data:scene", { width: 1024, height: 1536 }, space), text({ text: "Στη φάρμα", x: safe.left, y: safe.top, width: safe.right - safe.left, fontSize: 44 })] };
const title = farm.objects[1];
ok(contentBounds(farm)!.bottom === objectBounds(title).bottom, "the background doesn't count as content — only the title does");
const free = freeArea(farm, space);
ok(free.box.top > objectBounds(title).bottom && free.box.bottom === safe.bottom && free.share > 0.8, "the free space is everything under the title");

const maze = mazePage(space, "easy", 3);
const placed = addOntoPage(farm, maze, space);
ok(placed.ok, "a maze goes onto the page");
if (placed.ok) {
  const p = placed.page;
  ok(p.objects[0] === farm.objects[0] && p.objects[1] === farm.objects[1] && p.background?.image === "data:farm", "what was on the page stays exactly as it was (background, scene, title)");
  const addedLines = p.lines.slice(farm.lines.length);
  ok(addedLines.length === maze.lines.length && p.objects.length - farm.objects.length >= maze.objects.length, "every part of the maze is added");
  const addedBounds = contentBounds({ ...p, objects: p.objects.slice(2).filter((o) => !(o.kind === "shape" && String((o as { fill: string }).fill).startsWith("rgba"))), lines: addedLines })!;
  ok(addedBounds.top >= free.box.top - 0.5 && addedBounds.bottom <= safe.bottom + 0.5 && addedBounds.left >= safe.left - 0.5 && addedBounds.right <= safe.right + 0.5, "it sits in the free space, inside the safe area", JSON.stringify(addedBounds));
  ok(placed.scale < 1 && placed.scale > 0.5, "made smaller to fit, evenly", String(placed.scale));
  ok(p.objects.some((o) => o.kind === "shape" && String((o as { fill: string }).fill).startsWith("rgba(255,255,255")), "on a page with a background it gets a light panel behind it");
  ok(new Set(p.objects.map((o) => o.id)).size === p.objects.length, "every added object has its own id");
}

const plain = createPageFromTemplate(2, space);
const onPlain = addOntoPage(plain, maze, space);
ok(onPlain.ok && onPlain.scale > 0.98 && !onPlain.page.objects.some((o) => o.kind === "shape" && String((o as { fill: string }).fill).startsWith("rgba")), "on an empty page without background: (almost) full size, no panel");

const full: BookPage = { ...plain, objects: [text({ text: "x", x: safe.left, y: safe.top, width: 100, height: safe.bottom - safe.top - 40, fontSize: 20 })] };
const noRoom = addOntoPage(full, maze, space);
ok(!noRoom.ok && noRoom.reason === "no-room", "a full page says there's no room instead of squashing");
ok(!addOntoPage(farm, createPageFromTemplate(3, space), space).ok, "an empty activity adds nothing");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
