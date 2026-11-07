import { parsePageSpec } from "../../src/services/pageSpec";
import { layoutPageSpec } from "../../src/utils/pageLayout";
import { applyBackgroundToAll, coverStamp, edgeWithoutBleed, hasEdgeBackground } from "../../src/utils/pageBackground";
import { bookReadiness } from "../../src/utils/readiness";
import { runEditorPreflightCheck } from "../../src/utils/editorPreflight";
import { nextVolumePages } from "../../src/utils/volumes";
import { createPageFromTemplate } from "../../src/components/editor/pageTemplates";
import { interiorSpace } from "../../src/utils/pageGeometry";
import type { BookPage } from "../../src/types/editor";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };
const space = interiorSpace("8.5x11", false);
const bled = interiorSpace("8.5x11", true);

// ---- reading
const raw = { background: "#e8f1fd", gradient: ["#bfe3ff", "#ffffff"], pattern: "clouds", scene: { subject: "a forest with tall trees", label: "ένα δάσος" }, blocks: [{ type: "title", text: "Στο δάσος", size: "large", align: "center" }] };
const color = parsePageSpec(raw, "color");
ok(color.gradient?.join() === "#bfe3ff,#ffffff" && color.pattern === "clouds" && color.scene?.label === "ένα δάσος", "gradient, pattern and scene are read");
const line = parsePageSpec(raw, "lineart");
ok(line.gradient === null && line.background === null && line.pattern === "clouds" && line.scene !== null, "a coloring page drops colors and gradients, keeps a pattern and a scene to color");
ok(parsePageSpec({ ...raw, pattern: "unicorns", gradient: ["#fff", "nope"] }, "color").pattern === null && parsePageSpec({ ...raw, gradient: ["#fff", "nope"] }, "color").gradient === null, "unknown patterns and bad gradients are dropped");

// ---- laying out, per kind of page
const scene = { src: "data:scene", width: 1024, height: 1536 };
const c = layoutPageSpec(color, space, new Map(), 1, scene).page;
ok(c.background?.image === "data:scene" && c.background.imageOpacity === 1 && c.background.gradient?.[0] === "#bfe3ff" && c.backgroundPatternId === "clouds", "a color page: the scene, gradient and pattern are the page's own background");
const mixed = layoutPageSpec(parsePageSpec(raw, "mixed"), space, new Map(), 1, scene).page;
ok(mixed.background?.imageOpacity === 0.35, "a mixed page: the scene is faded so the content stays in front");
const l = layoutPageSpec(line, space, new Map(), 1, scene).page;
const stamp = l.objects[0];
ok(!l.background && stamp.kind === "stamp" && stamp.role === "pageBackground" && stamp.locked === true, "a coloring page: the scene is a locked outline at the back, to color");
ok(stamp.x <= 0 && stamp.y <= 0 && stamp.x + stamp.width >= space.width && stamp.y + stamp.height >= space.height && Math.abs(stamp.width / stamp.height - 1024 / 1536) < 0.001, "the scene covers the whole page without being stretched");
const panel = l.objects.find((o) => o.kind === "shape" && (o as { fill: string }).fill.startsWith("rgba(255,255,255"));
const title = l.objects.find((o) => o.kind === "text")!;
ok(Boolean(panel) && l.objects.indexOf(panel!) < l.objects.indexOf(title) && panel!.y <= title.y, "on a busy background the title gets a light panel behind it");
const plain = layoutPageSpec(parsePageSpec({ blocks: raw.blocks }, "color"), space).page;
ok(!plain.objects.some((o) => o.kind === "shape"), "no background, no panel");

// ---- whole book
const pages: BookPage[] = [c, createPageFromTemplate(2, space), { ...createPageFromTemplate(3, space), isBlankBack: true }, l];
pages[1].objects.push({ kind: "text", id: "keep", text: "δικό μου", x: 100, y: 100, width: 200, height: 30, rotation: 0, scaleX: 1, scaleY: 1, fontFamily: "Arial", fontSize: 20, align: "left", fill: "#000", isDragging: false });
const themed = applyBackgroundToAll(pages, l.id);
ok(themed[1].objects.some((o) => o.id === "keep") && themed[1].objects[0].role === "pageBackground" && themed[1].objects[0].id !== stamp.id, "every page gets the scene (a copy, its own id); its content stays");
ok(!themed[2].objects.some((o) => o.role === "pageBackground"), "blank backs stay blank");
ok(themed[0].objects.filter((o) => o.role === "pageBackground").length === 1 && !themed[0].background, "a page's old background is replaced, not stacked");
const fromColor = applyBackgroundToAll(pages, c.id);
ok(fromColor[1].background?.image === "data:scene" && fromColor[1].backgroundPatternId === "clouds" && !fromColor[3].objects.some((o) => o.role === "pageBackground"), "a color background travels too (and replaces a scene to color)");

// ---- print checks
ok(hasEdgeBackground(c) && hasEdgeBackground(l) && !hasEdgeBackground(plain), "pages with any background count as edge-to-edge");
ok(edgeWithoutBleed([c, plain]).join() === c.id && edgeWithoutBleed([{ ...c, space: bled }]).length === 0, "without bleed they're flagged; with bleed they're fine");
const ready = bookReadiness([c, plain]);
ok(ready.items.some((i) => i.id === "edge-bleed" && !i.ok), "the print-readiness check warns about it");
ok(!bookReadiness([plain]).items.some((i) => i.id === "edge-bleed"), "…and says nothing for books without backgrounds");
ok(!runEditorPreflightCheck([l]).some((i) => i.code === "MARGIN_SAFETY"), "the edge-to-edge scene doesn't trip the safe-margin check");
const onlyBg = { ...createPageFromTemplate(9, space), objects: [coverStamp("data:s", { width: 10, height: 10 }, space)] };
ok(bookReadiness([onlyBg]).items.find((i) => i.id === "empty-pages")?.count === 1, "a page with only a background still counts as empty");
ok(nextVolumePages([l])[0].objects.some((o) => o.role === "pageBackground"), "the next volume keeps the background, like a frame");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
