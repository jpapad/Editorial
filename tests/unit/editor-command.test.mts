import { applyCommandActions, MAX_COMMAND_ACTIONS, parseCommandResult, summarizePage, type CommandPictures } from "../../src/utils/editorCommand";
import { geometryFromSpace } from "../../src/utils/pageGeometry";
import { objectBounds } from "../../src/utils/objectGeometry";
import type { BookPage, PageObject } from "../../src/types/editor";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const near = (a: number, b: number, e = 1) => Math.abs(a - b) <= e;
const space = { width: 612, height: 792, bleed: 0 };
const geo = geometryFromSpace(space);
const { safe } = geo;
const shape = (id: string, x: number, y: number, extra: Partial<PageObject> = {}) => ({ kind: "shape", id, shapeKind: "star", x, y, width: 100, height: 100, rotation: 0, scaleX: 1, scaleY: 1, fill: "#fff", stroke: "#000", strokeWidth: 6, ...extra }) as PageObject;
const page = (objects: PageObject[]): BookPage => ({ id: "p", pageNumber: 1, space, lines: [], objects });
const center = (o: PageObject) => { const b = objectBounds(o); return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }; };
const get = (p: BookPage, id: string) => p.objects.find((o) => o.id === id)!;

// --- parse: only known actions, known ids, bounded values ---
const parsed = parseCommandResult({
  reply: "Done",
  actions: [
    { type: "move", ids: ["a", "ghost"], x: 2, y: -1 },
    { type: "rm -rf", ids: ["a"] },
    { type: "scale", ids: ["a"], factor: 50 },
    { type: "add_shape", shape: "dodecahedron" },
    { type: "add_picture", subject: "  a  crab ", x: 0.1, y: 0.9, w: 0.3 },
    { type: "set_frame", frame: "not-a-frame" },
    { type: "set_pattern", pattern: "stars" },
    { type: "delete", ids: ["ghost"] },
  ],
}, ["a", "b"]);
ok(parsed.actions.map((a) => a.type).join(",") === "move,scale,add_picture,set_pattern", `unknown types, shapes, frames and ids dropped → ${parsed.actions.map((a) => a.type).join(",")}`);
const mv = parsed.actions[0] as { ids: string[]; x: number; y: number };
ok(mv.ids.join() === "a" && mv.x === 1 && mv.y === 0, "ids filtered to real objects; coordinates clamped to the page");
ok((parsed.actions[1] as { factor: number }).factor === 4, "scale factor capped at 4×");
ok((parsed.actions[2] as { subject: string }).subject === "a crab", "picture subject tidied");
ok(parseCommandResult({ actions: Array.from({ length: 20 }, () => ({ type: "thicken_lines" })) }, []).actions.length === MAX_COMMAND_ACTIONS, `at most ${MAX_COMMAND_ACTIONS} actions`);
ok(parseCommandResult("garbage", []).actions.length === 0 && parseCommandResult(null, []).reply === "", "garbage → no actions, no crash");

// --- apply ---
const base = page([shape("a", 200, 200), shape("b", 300, 300, { locked: true }), shape("g1", 100, 500, { groupId: "G" }), shape("g2", 250, 500, { groupId: "G" })]);
const moved = applyCommandActions(base, geo, [{ type: "move", ids: ["a"], x: 0.5, y: 0.5 }]).page;
const c = center(get(moved, "a"));
ok(near(c.x, (safe.left + safe.right) / 2) && near(c.y, (safe.top + safe.bottom) / 2), "move centres the object where asked");
ok(get(applyCommandActions(base, geo, [{ type: "delete", ids: ["b"] }]).page, "b") !== undefined, "locked object is not deleted");
ok(get(applyCommandActions(base, geo, [{ type: "move", ids: ["b"], x: 0, y: 0 }]).page, "b").x === 300, "locked object is not moved");
const grp = applyCommandActions(base, geo, [{ type: "move", ids: ["g1"], x: 0.5, y: 0.2 }]).page;
ok(get(grp, "g2").x - get(grp, "g1").x === 150, "moving one group member moves the group together");
const big = applyCommandActions(base, geo, [{ type: "scale", ids: ["a"], factor: 2 }]).page;
ok(get(big, "a").width === 200 && near(center(get(big, "a")).x, center(get(base, "a")).x), "scale keeps the centre");
const edge = applyCommandActions(base, geo, [{ type: "scale", ids: ["a"], factor: 4 }, { type: "move", ids: ["a"], x: 1, y: 1 }]).page;
const eb = objectBounds(get(edge, "a"));
ok(eb.right <= safe.right + 0.5 && eb.bottom <= safe.bottom + 0.5, "results stay inside the safe area");

const pics: CommandPictures = new Map([[0, { src: "data:x", size: { width: 400, height: 200 } }]]);
const added = applyCommandActions(base, geo, [{ type: "add_picture", subject: "a crab", x: 0.2, y: 0.8, w: 0.3 }, { type: "add_picture", subject: "failed one", x: 0.5, y: 0.5, w: 0.3 }], pics);
const crab = added.page.objects.at(-1)!;
ok(added.page.objects.length === base.objects.length + 1 && crab.kind === "stamp" && crab.label === "a crab", "picture added (with its label); a failed picture is skipped");
ok(near(crab.width, 0.3 * (safe.right - safe.left)) && near(crab.height, crab.width / 2) && added.selected[0] === crab.id, "sized from w, keeps aspect ratio, and gets selected");

const framed = applyCommandActions(base, geo, [{ type: "set_frame", frame: "stars" }, { type: "set_frame", frame: "classic" }]).page;
ok(framed.objects.filter((o) => o.kind === "stamp" && o.isFrame).length === 1 && framed.objects[0].kind === "stamp", "one frame at most, kept at the back");
ok(applyCommandActions(base, geo, [{ type: "set_pattern", pattern: "dots" }]).page.backgroundPatternId === "dots", "pattern set");

const summary = summarizePage(framed, geo, ["a", "nope"]);
ok(summary.frame === "classic" && summary.objects.every((o) => o.kind !== "stamp") && summary.selected.join() === "a", "summary: frame reported by id, not as an object; selection filtered");
ok(summary.objects.find((o) => o.id === "b")?.locked === true, "summary marks locked objects");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
