// The editor's AI command bar, the parts that don't talk to a model:
//  - summarizePage(): what the model gets to see (ids, kinds, positions);
//  - parseCommandResult(): the model's reply, reduced to a fixed, validated
//    set of actions (anything else is dropped);
//  - applyCommandActions(): those actions applied to a page, as one pure step
//    (the editor wraps it in a single undo entry).
// Coordinates the model sees and returns are 0–1 fractions of the page's
// safe (printable) area: x to the right, y down, (0.5, 0.5) the middle.

import { BACKGROUND_PATTERNS } from "@/components/editor/backgroundPatterns";
import { FRAMES } from "@/components/editor/frameLibrary";
import { createFrameStamp, makeId } from "@/components/editor/pageTemplates";
import { defaultShapeSize, isOpenStroke } from "@/components/editor/shapeGeometry";
import { clampObjectsToMargin, thickenThinStrokes } from "@/utils/editorPreflight";
import { fitInside, flippedHorizontally, flippedVertically, objectBounds, unionBounds } from "@/utils/objectGeometry";
import type { PageGeometry } from "@/utils/pageGeometry";
import type { BookPage, PageObject, ShapeKind } from "@/types/editor";
import type { ImageSize } from "@/utils/imagePages";

export const MAX_COMMAND_ACTIONS = 8;
export const MAX_SUMMARY_OBJECTS = 60;
export const COMMAND_SHAPES = ["rectangle", "circle", "triangle", "star", "heart", "hexagon", "line", "arrow"] as const satisfies readonly ShapeKind[];
export const COMMAND_FRAMES = FRAMES.map((f) => f.id);
export const COMMAND_PATTERNS = BACKGROUND_PATTERNS.map((p) => p.id);
const TEXT_SIZES = { small: 28, medium: 44, large: 64 } as const;

export type CommandAction =
  | { type: "add_picture"; subject: string; x: number; y: number; w: number }
  | { type: "add_text"; text: string; x: number; y: number; size: keyof typeof TEXT_SIZES }
  | { type: "add_shape"; shape: ShapeKind; x: number; y: number; w: number }
  | { type: "move"; ids: string[]; x: number; y: number }
  | { type: "scale"; ids: string[]; factor: number }
  | { type: "delete"; ids: string[] }
  | { type: "duplicate"; ids: string[] }
  | { type: "flip"; ids: string[]; direction: "horizontal" | "vertical" }
  | { type: "set_frame"; frame: string | null }
  | { type: "set_pattern"; pattern: string | null }
  | { type: "thicken_lines" }
  | { type: "fit_margins" };

export interface CommandResult {
  /** One short sentence for the user, in their language. */
  reply: string;
  actions: CommandAction[];
}

export interface PageSummary {
  objects: { id: string; kind: string; what: string; x: number; y: number; w: number; h: number; locked?: boolean }[];
  lines: number;
  frame: string | null;
  pattern: string | null;
  selected: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What the model is told about the page — no image data, just structure. */
export function summarizePage(page: BookPage, geo: PageGeometry, selectedIds: string[]): PageSummary {
  const { safe } = geo;
  const sw = safe.right - safe.left;
  const sh = safe.bottom - safe.top;
  const visible = page.objects.filter((o) => !o.hidden && !(o.kind === "stamp" && o.isFrame));
  const frame = page.objects.find((o) => o.kind === "stamp" && o.isFrame);
  return {
    objects: visible.slice(-MAX_SUMMARY_OBJECTS).map((o) => {
      const b = objectBounds(o);
      const what = o.kind === "shape" ? o.shapeKind : o.kind === "text" ? o.text.slice(0, 40) : (o.label ?? "picture");
      return {
        id: o.id,
        kind: o.kind,
        what,
        x: r2(((b.left + b.right) / 2 - safe.left) / sw),
        y: r2(((b.top + b.bottom) / 2 - safe.top) / sh),
        w: r2((b.right - b.left) / sw),
        h: r2((b.bottom - b.top) / sh),
        ...(o.locked ? { locked: true } : {}),
      };
    }),
    lines: page.lines.length,
    frame: frame?.kind === "stamp" ? (frame.frameId ?? null) : null,
    pattern: page.backgroundPatternId ?? null,
    selected: selectedIds.filter((id) => visible.some((o) => o.id === id)),
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const unit = (v: unknown, fallback = 0.5) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/** Keeps only well-formed actions on objects that exist. Never throws; an empty list is a valid "can't do that". */
export function parseCommandResult(raw: unknown, knownIds: string[]): CommandResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const known = new Set(knownIds);
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && known.has(x)))] : []);
  const actions: CommandAction[] = [];
  for (const item of Array.isArray(o.actions) ? o.actions : []) {
    if (actions.length === MAX_COMMAND_ACTIONS) break;
    const a = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    switch (a.type) {
      case "add_picture": {
        const subject = str(a.subject, 160);
        if (subject) actions.push({ type: "add_picture", subject, x: unit(a.x), y: unit(a.y), w: Math.max(0.1, unit(a.w, 0.35)) });
        break;
      }
      case "add_text": {
        const text = str(a.text, 80);
        const size = a.size === "small" || a.size === "large" ? a.size : "medium";
        if (text) actions.push({ type: "add_text", text, x: unit(a.x), y: unit(a.y), size });
        break;
      }
      case "add_shape":
        if (COMMAND_SHAPES.includes(a.shape as ShapeKind)) actions.push({ type: "add_shape", shape: a.shape as ShapeKind, x: unit(a.x), y: unit(a.y), w: Math.max(0.05, unit(a.w, 0.25)) });
        break;
      case "move":
      case "delete":
      case "duplicate": {
        const target = ids(a.ids);
        if (target.length === 0) break;
        if (a.type === "move") actions.push({ type: "move", ids: target, x: unit(a.x), y: unit(a.y) });
        else actions.push({ type: a.type, ids: target });
        break;
      }
      case "scale": {
        const target = ids(a.ids);
        const factor = typeof a.factor === "number" && Number.isFinite(a.factor) ? Math.min(4, Math.max(0.25, a.factor)) : null;
        if (target.length && factor && factor !== 1) actions.push({ type: "scale", ids: target, factor });
        break;
      }
      case "flip": {
        const target = ids(a.ids);
        if (target.length) actions.push({ type: "flip", ids: target, direction: a.direction === "vertical" ? "vertical" : "horizontal" });
        break;
      }
      case "set_frame":
        if (a.frame === null || COMMAND_FRAMES.includes(a.frame as string)) actions.push({ type: "set_frame", frame: (a.frame as string | null) ?? null });
        break;
      case "set_pattern":
        if (a.pattern === null || COMMAND_PATTERNS.includes(a.pattern as string)) actions.push({ type: "set_pattern", pattern: (a.pattern as string | null) ?? null });
        break;
      case "thicken_lines":
      case "fit_margins":
        actions.push({ type: a.type });
        break;
    }
  }
  return { reply: str(o.reply, 200), actions };
}

/** Pictures for the add_picture actions, by action index (missing = generation failed; that action is skipped). */
export type CommandPictures = Map<number, { src: string; size: ImageSize }>;

/** Applies validated actions to a page. Locked objects are never moved, resized, flipped or deleted. Returns the new page and what to select. */
export function applyCommandActions(page: BookPage, geo: PageGeometry, actions: CommandAction[], pictures: CommandPictures = new Map()): { page: BookPage; selected: string[] } {
  const { safe } = geo;
  const sw = safe.right - safe.left;
  const sh = safe.bottom - safe.top;
  const at = (x: number, y: number) => ({ x: safe.left + x * sw, y: safe.top + y * sh });
  let next: BookPage = { ...page, objects: [...page.objects] };
  let selected: string[] = [];
  const editable = (targets: string[]) => {
    const withGroups = new Set(targets);
    for (const o of next.objects) if (o.groupId && next.objects.some((m) => withGroups.has(m.id) && m.groupId === o.groupId)) withGroups.add(o.id);
    return new Set(next.objects.filter((o) => withGroups.has(o.id) && !o.locked).map((o) => o.id));
  };
  const place = (obj: PageObject) => {
    next.objects.push(fitInside(obj, safe) as PageObject);
    selected = [...selected, obj.id];
  };

  actions.forEach((action, index) => {
    switch (action.type) {
      case "add_picture": {
        const pic = pictures.get(index);
        if (!pic) return;
        const width = action.w * sw;
        const height = width * (pic.size.height / pic.size.width);
        const c = at(action.x, action.y);
        place({ kind: "stamp", id: makeId("stamp"), src: pic.src, label: action.subject, x: c.x - width / 2, y: c.y - height / 2, width, height, rotation: 0, scaleX: 1, scaleY: 1, filter: "none" });
        return;
      }
      case "add_text": {
        const fontSize = TEXT_SIZES[action.size];
        const width = sw * 0.8;
        const height = fontSize * 1.4;
        const c = at(action.x, action.y);
        place({ kind: "text", id: makeId("text"), text: action.text, fontFamily: '"Fredoka", "Comic Sans MS", cursive', fontSize, align: "center", x: c.x - width / 2, y: c.y - height / 2, width, height, rotation: 0, scaleX: 1, scaleY: 1, fill: "#111827", isDragging: false, outline: true });
        return;
      }
      case "add_shape": {
        const base = defaultShapeSize(action.shape);
        const width = action.w * sw;
        const height = isOpenStroke(action.shape) ? base.height : width * (base.height / base.width);
        const c = at(action.x, action.y);
        place({ kind: "shape", id: makeId("shape"), shapeKind: action.shape, x: c.x - width / 2, y: c.y - height / 2, width, height, rotation: 0, scaleX: 1, scaleY: 1, fill: isOpenStroke(action.shape) ? "transparent" : "#ffffff", stroke: "#111827", strokeWidth: 6 });
        return;
      }
      case "move": {
        const targets = editable(action.ids);
        const box = unionBounds(next.objects.filter((o) => targets.has(o.id)).map(objectBounds));
        if (!box) return;
        const c = at(action.x, action.y);
        const dx = c.x - (box.left + box.right) / 2;
        const dy = c.y - (box.top + box.bottom) / 2;
        next.objects = next.objects.map((o) => (targets.has(o.id) ? (fitInside({ ...o, x: o.x + dx, y: o.y + dy }, safe) as PageObject) : o));
        selected = [...targets];
        return;
      }
      case "scale": {
        const targets = editable(action.ids);
        next.objects = next.objects.map((o) => {
          if (!targets.has(o.id)) return o;
          const b = objectBounds(o);
          const cx = (b.left + b.right) / 2;
          const cy = (b.top + b.bottom) / 2;
          const grown = { ...o, width: o.width * action.factor, height: o.height * action.factor, ...(o.kind === "text" ? { fontSize: o.fontSize * action.factor } : {}) } as PageObject;
          const gb = objectBounds(grown);
          return fitInside({ ...grown, x: grown.x + cx - (gb.left + gb.right) / 2, y: grown.y + cy - (gb.top + gb.bottom) / 2 }, safe) as PageObject;
        });
        selected = [...targets];
        return;
      }
      case "delete": {
        const targets = editable(action.ids);
        next.objects = next.objects.filter((o) => !targets.has(o.id));
        selected = selected.filter((id) => !targets.has(id));
        return;
      }
      case "duplicate": {
        const targets = editable(action.ids);
        const copies = next.objects.filter((o) => targets.has(o.id)).map((o) => ({ ...o, id: makeId(o.kind), x: o.x + 24, y: o.y + 24, groupId: undefined }) as PageObject);
        next.objects.push(...copies);
        selected = copies.map((c) => c.id);
        return;
      }
      case "flip": {
        const targets = editable(action.ids);
        next.objects = next.objects.map((o) => (targets.has(o.id) ? ({ ...o, ...(action.direction === "horizontal" ? flippedHorizontally(o) : flippedVertically(o)) } as PageObject) : o));
        selected = [...targets];
        return;
      }
      case "set_frame": {
        const without = next.objects.filter((o) => !(o.kind === "stamp" && o.isFrame));
        const frame = action.frame ? createFrameStamp(action.frame, geo) : null;
        next.objects = frame ? [frame, ...without] : without;
        return;
      }
      case "set_pattern":
        next = { ...next, backgroundPatternId: action.pattern };
        return;
      case "thicken_lines":
        next = thickenThinStrokes([next])[0];
        return;
      case "fit_margins":
        next = clampObjectsToMargin([next])[0];
        return;
    }
  });
  return { page: next, selected };
}
