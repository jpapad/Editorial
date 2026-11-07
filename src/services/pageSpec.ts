// "Page from instructions": the user describes a page in their own words;
// the model only *reads* it into a strict list of blocks (top to bottom),
// copying every text word for word and every number exactly. Where things
// go on the page is decided by utils/pageLayout.ts, not by the model, so
// "2 rows" is always two rows. What can't be done is reported, never
// silently approximated.
//
// The model's JSON is untrusted: parsePageSpec() keeps only known blocks
// with bounded fields.

export type TextSize = "small" | "medium" | "large";
export type TextStyle = "normal" | "outline" | "dashed";
export type Marker = "none" | "circle" | "checkbox";

/** "lineart": black outlines to color in (a coloring page). "color": a finished color page. "mixed": colored titles, boxes and lines, pictures left to color. */
export type PageMode = "lineart" | "color" | "mixed";
export const PAGE_MODES: PageMode[] = ["lineart", "mixed", "color"];

/** Colors a block may carry (hex). `color`: its text, or its lines and borders; `fill`: the inside of its box. */
export interface BlockColors {
  color?: string | null;
  fill?: string | null;
}

export type PageBlock = (
  | { type: "title"; text: string; size: TextSize; align: "left" | "center" | "right" }
  | { type: "text"; text: string; size: TextSize; align: "left" | "center" | "right"; style: TextStyle }
  | { type: "pictures"; items: { subject: string; label: string; caption: string }[]; columns: number; boxed: boolean; writeLine: boolean; marker: Marker }
  | { type: "lines"; count: number; handwriting: boolean }
  | { type: "table"; rows: number; columns: number; header: string[] }
  | { type: "choices"; question: string; options: string[]; marker: "circle" | "checkbox" }
  | { type: "numbered"; items: string[]; writeLine: boolean }
  | { type: "bubble"; text: string }
  | { type: "space"; label: string; boxed: boolean }
  | { type: "activity"; kind: "wordsearch" | "maze"; words: string[] }
) &
  BlockColors;

export interface PageSpec {
  mode: PageMode;
  /** Optional frame around the page (frameLibrary id) — only when asked for. */
  frame: string | null;
  /** The page's background color (color and mixed pages only). */
  background: string | null;
  /** A top-to-bottom gradient instead of one color (color and mixed pages only). */
  gradient: [string, string] | null;
  /** A repeating pattern (backgroundPatterns.ts id). */
  pattern: string | null;
  /** A scenery picture behind everything: what it shows, for the image model (English) and in the user's words. */
  scene: { subject: string; label: string } | null;
  blocks: PageBlock[];
  /** What was asked for but can't be done, in the user's language. */
  warnings: string[];
}

export const PAGE_FRAMES = ["classic", "simple", "dotted", "scallop", "stars", "hearts"] as const;
export const PAGE_PATTERNS = ["stars", "dots", "clouds", "hearts", "geometric"] as const;

const LIMITS = { blocks: 14, pictures: 12, columns: 4, lines: 20, tableRows: 12, tableCols: 6, options: 6, items: 12, words: 12 };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const SIZES = ["small", "medium", "large"] as const;
const ALIGNS = ["left", "center", "right"] as const;
const MARKERS = ["none", "circle", "checkbox"] as const;

const NAMED: Record<string, string> = { red: "#e5484d", orange: "#f08c2e", yellow: "#f5c518", green: "#3cb371", blue: "#2f80ed", purple: "#8e5ad6", pink: "#e05a9b", brown: "#8a5a3c", black: "#111827", white: "#ffffff", gray: "#7b8fa8", grey: "#7b8fa8" };

/** A color the page can use: #rgb / #rrggbb, or a few basic names; anything else → null. */
export function parseColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.trim().toLowerCase();
  if (NAMED[c]) return NAMED[c];
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  return null;
}

function parseBlock(raw: unknown): PageBlock | null {
  const block = parseBlockShape(raw);
  if (!block) return null;
  const o = raw as Record<string, unknown>;
  return { ...block, color: parseColor(o.color), fill: parseColor(o.fill) };
}

function parseBlockShape(raw: unknown): PageBlock | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (o.type) {
    case "title": {
      const text = str(o.text, 120);
      return text ? { type: "title", text, size: oneOf(o.size, SIZES, "large"), align: oneOf(o.align, ALIGNS, "center") } : null;
    }
    case "text": {
      const text = str(o.text, 600);
      return text ? { type: "text", text, size: oneOf(o.size, SIZES, "medium"), align: oneOf(o.align, ALIGNS, "left"), style: oneOf(o.style, ["normal", "outline", "dashed"] as const, "normal") } : null;
    }
    case "pictures": {
      const items = (Array.isArray(o.items) ? o.items : [])
        .map((it) => {
          const x = (it && typeof it === "object" ? it : { subject: it }) as Record<string, unknown>;
          return { subject: str(x.subject, 160), label: str(x.label, 60), caption: str(x.caption, 60) };
        })
        .filter((it) => it.subject)
        .slice(0, LIMITS.pictures);
      if (items.length === 0) return null;
      return { type: "pictures", items, columns: int(o.columns, 1, LIMITS.columns, Math.min(items.length, 2)), boxed: o.boxed === true, writeLine: o.writeLine === true, marker: oneOf(o.marker, MARKERS, "none") };
    }
    case "lines":
      return { type: "lines", count: int(o.count, 1, LIMITS.lines, 3), handwriting: o.handwriting === true };
    case "table": {
      const columns = int(o.columns, 1, LIMITS.tableCols, 2);
      return { type: "table", rows: int(o.rows, 1, LIMITS.tableRows, 3), columns, header: (Array.isArray(o.header) ? o.header : []).map((h) => str(h, 40)).slice(0, columns) };
    }
    case "choices": {
      const options = (Array.isArray(o.options) ? o.options : []).map((x) => str(x, 60)).filter(Boolean).slice(0, LIMITS.options);
      return options.length >= 2 ? { type: "choices", question: str(o.question, 200), options, marker: oneOf(o.marker, ["circle", "checkbox"] as const, "circle") } : null;
    }
    case "numbered": {
      const items = (Array.isArray(o.items) ? o.items : []).map((x) => str(x, 200)).filter(Boolean).slice(0, LIMITS.items);
      return items.length ? { type: "numbered", items, writeLine: o.writeLine === true } : null;
    }
    case "bubble": {
      const text = str(o.text, 200);
      return text ? { type: "bubble", text } : null;
    }
    case "space":
      return { type: "space", label: str(o.label, 120), boxed: o.boxed !== false };
    case "activity": {
      const kind = oneOf(o.kind, ["wordsearch", "maze"] as const, "maze");
      const words = (Array.isArray(o.words) ? o.words : []).map((x) => str(x, 14)).filter((w) => w && !/\s/.test(w)).slice(0, LIMITS.words);
      if (kind === "wordsearch" && words.length === 0) return null;
      return { type: "activity", kind, words };
    }
    default:
      return null;
  }
}

function parseGradient(v: unknown): [string, string] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const [from, to] = [parseColor(v[0]), parseColor(v[1])];
  return from && to ? [from, to] : null;
}

function parseScene(v: unknown): PageSpec["scene"] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const subject = str(o.subject, 240);
  return subject ? { subject, label: str(o.label, 120) || subject } : null;
}

/** `mode` is the user's choice, not the model's: a coloring page keeps no colors whatever the reply says. */
export function parsePageSpec(raw: unknown, mode: PageMode = "lineart"): PageSpec {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let blocks = (Array.isArray(o.blocks) ? o.blocks : []).map(parseBlock).filter((b): b is PageBlock => b !== null).slice(0, LIMITS.blocks);
  if (mode === "lineart") blocks = blocks.map((b) => ({ ...b, color: null, fill: null }));
  const warnings = (Array.isArray(o.warnings) ? o.warnings : []).map((w) => str(w, 200)).filter(Boolean).slice(0, 6);
  if (blocks.length === 0 && warnings.length === 0) throw new Error("Nothing on the page could be understood.");
  return {
    mode,
    frame: PAGE_FRAMES.includes(o.frame as (typeof PAGE_FRAMES)[number]) ? (o.frame as string) : null,
    background: mode === "lineart" ? null : parseColor(o.background),
    gradient: mode === "lineart" ? null : parseGradient(o.gradient),
    pattern: PAGE_PATTERNS.includes(o.pattern as (typeof PAGE_PATTERNS)[number]) ? (o.pattern as string) : null,
    scene: parseScene(o.scene),
    blocks,
    warnings,
  };
}

const MODE_RULES: Record<PageMode, string> = {
  lineart: "This is a COLORING page: everything is black on white. Use null for every color, fill, background and gradient. If the instructions ask for colors, add a warning that a coloring page stays black and white (choose a color or mixed page instead). A pattern or a scene background is fine — drawn as outlines to color.",
  mixed: 'This is a MIXED page: titles, texts, boxes, lines, table headers and the background may be colored, but pictures stay black outlines for the child to color. Use exactly the colors the instructions name, as hex (e.g. "κόκκινο"/"red" → "#e5484d"). Where no color is named, use null for texts (black) and a gentle, harmonious palette of at most 3 soft colors for titles, box fills and borders; background stays null unless asked for.',
  color: 'This is a COLOR page: a finished, full-color page (pictures are drawn in color too). Use exactly the colors the instructions name, as hex (e.g. "μπλε"/"blue" → "#2f80ed"). Where no color is named, choose a cheerful, harmonious palette of at most 4 colors for titles, borders and box fills, keep body text dark for reading; background null unless asked for or a very light tint suits the page.',
};

export function buildPageSpecPrompt(instructions: string, lang: "el" | "en", mode: PageMode = "lineart"): string {
  const language = lang === "el" ? "Greek" : "English";
  return [
    "You turn a teacher's or parent's instructions for ONE printable children's page into a strict JSON layout list. You are a careful transcriber, not a designer.",
    "",
    "Rules — follow them exactly:",
    "1. Include ONLY what the instructions ask for. Never add titles, decorations, pictures, instructions or lines they didn't ask for.",
    "2. Copy every piece of text that should appear on the page WORD FOR WORD, in the language it was written in (keep accents, punctuation and capitals). Never translate, shorten, correct or 'improve' it.",
    "3. Numbers are exact: 4 pictures means 4 items, 2 rows of 3 means columns 3, 5 lines means count 5.",
    "4. Keep the order of the instructions, top of the page first.",
    `5. Anything you cannot represent with the blocks below goes into "warnings" (in ${language}), saying plainly what will be missing. Do not approximate it with something else.`,
    "6. For each picture: \"subject\" in English for the image model, describing exactly the thing asked for (e.g. 'a cow'); \"label\" = the user's own word for it, verbatim, in their language (shown back to them, not printed); \"caption\" = text to PRINT under it — only if the instructions ask for a caption/name under the picture, verbatim; otherwise empty.",
    "",
    `7. ${MODE_RULES[mode]}`,
    `8. Backgrounds, only when asked for: "background" = one color; "gradient" = [top color, bottom color] (e.g. "from light blue to white"); "pattern" = one of ${JSON.stringify(PAGE_PATTERNS)} for a repeating pattern (stars, dots, clouds, hearts, geometric shapes); "scene" = {"subject": an English description of a full-page background scenery for the image model (e.g. "a forest with tall trees and flowers, no people, no text"), "label": the user's own words for it, verbatim} for a picture behind everything. A pattern or scene that isn't in the list → a warning.`,
    "",
    'Reply with {"frame": null or one of ' + JSON.stringify(PAGE_FRAMES) + ' (only if a border/frame is asked for), "background": null or a hex color, "gradient": null or [hex, hex], "pattern": null or a pattern name, "scene": null or {"subject","label"}, "blocks": [...], "warnings": [...]}. Every block also has "color" (its text, or its lines and borders) and "fill" (the inside of its box) — a hex color or null. Block types:',
    '- {"type":"title","text","size":"small|medium|large","align":"left|center|right"}',
    '- {"type":"text","text","size","align","style":"normal|outline|dashed"}  — "dashed" = dotted letters to trace over; "outline" = hollow letters to color',
    '- {"type":"pictures","items":[{"subject","label","caption"}],"columns":1-4,"boxed":bool (a frame around each picture),"writeLine":bool (a line under each picture to write on),"marker":"none|circle|checkbox" (something to mark next to each picture)}',
    '- {"type":"lines","count":1-20,"handwriting":bool (three-line handwriting guides)}',
    '- {"type":"table","rows","columns","header":[column titles, verbatim, may be empty]}',
    '- {"type":"choices","question","options":[...],"marker":"circle|checkbox"}  — answers to circle or tick',
    '- {"type":"numbered","items":[...],"writeLine":bool}  — a numbered list (e.g. questions), optionally with a line after each',
    '- {"type":"bubble","text"}  — a speech bubble',
    '- {"type":"space","label","boxed":bool}  — an empty area to draw in, with an optional label above it',
    '- {"type":"activity","kind":"wordsearch|maze","words":[...]}  — added as its own extra page after this one',
    "Use sensible defaults only where the instructions are silent (e.g. title size large, centred). Reply with the JSON object only.",
    "",
    `Instructions: ${JSON.stringify(instructions)}`,
  ].join("\n");
}

const s = { type: "string" };
const b = { type: "boolean" };
const i = { type: "integer" };
const arr = (items: unknown) => ({ type: "array", items });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const hexOrNull = { anyOf: [{ type: "string" }, { type: "null" }] };
const kind = (type: string, fields: Record<string, unknown>) => obj({ type: { type: "string", enum: [type] }, ...fields, color: hexOrNull, fill: hexOrNull });

export const PAGE_SPEC_SCHEMA = obj({
  frame: { anyOf: [{ type: "string", enum: [...PAGE_FRAMES] }, { type: "null" }] },
  background: hexOrNull,
  gradient: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] },
  pattern: { anyOf: [{ type: "string", enum: [...PAGE_PATTERNS] }, { type: "null" }] },
  scene: { anyOf: [obj({ subject: s, label: s }), { type: "null" }] },
  blocks: arr({
    anyOf: [
      kind("title", { text: s, size: { type: "string", enum: [...SIZES] }, align: { type: "string", enum: [...ALIGNS] } }),
      kind("text", { text: s, size: { type: "string", enum: [...SIZES] }, align: { type: "string", enum: [...ALIGNS] }, style: { type: "string", enum: ["normal", "outline", "dashed"] } }),
      kind("pictures", { items: arr(obj({ subject: s, label: s, caption: s })), columns: i, boxed: b, writeLine: b, marker: { type: "string", enum: [...MARKERS] } }),
      kind("lines", { count: i, handwriting: b }),
      kind("table", { rows: i, columns: i, header: arr(s) }),
      kind("choices", { question: s, options: arr(s), marker: { type: "string", enum: ["circle", "checkbox"] } }),
      kind("numbered", { items: arr(s), writeLine: b }),
      kind("bubble", { text: s }),
      kind("space", { label: s, boxed: b }),
      kind("activity", { kind: { type: "string", enum: ["wordsearch", "maze"] }, words: arr(s) }),
    ],
  }),
  warnings: arr(s),
});
