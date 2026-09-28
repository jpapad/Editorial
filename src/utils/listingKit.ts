// Amazon KDP listing copy for a studio book: subtitle, description and the
// 7 backend keywords. Deterministic — derived from the book itself (page
// count, trim, page captions, which page types it has) plus what the
// author tells us (theme, audience). Same inputs, same copy; no AI call.
//
// KDP limits honored here: title + subtitle ≤ 200 characters, description
// ≤ 4000 characters (limited HTML: <b>, <i>, <br>, <ul>/<li>), 7 keyword
// slots of ≤ 50 characters each.

import type { BookPage } from "@/types/editor";
import { trimShortLabel } from "@/utils/trimSizes";

export const KEYWORD_SLOTS = 7;
export const KEYWORD_MAX = 50;
export const TITLE_SUBTITLE_MAX = 200;
export const DESCRIPTION_MAX = 4000;

export type Audience = "toddlers" | "kids" | "teens" | "adults";

export const AUDIENCE_OPTIONS: { value: Audience; label: string; ages: string }[] = [
  { value: "toddlers", label: "Toddlers", ages: "Ages 2-4" },
  { value: "kids", label: "Kids", ages: "Ages 4-8" },
  { value: "teens", label: "Teens", ages: "Ages 12+" },
  { value: "adults", label: "Adults", ages: "" },
];

export interface ListingInput {
  title: string;
  /** e.g. "dinosaurs", "Ancient Greece" — the book's subject. */
  theme: string;
  audience: Audience;
  pages: BookPage[];
  trimSizeId?: string;
  bleed: boolean;
}

export interface ListingKit {
  subtitle: string;
  description: string;
  keywords: string[];
  /** Counted from the book, for the description and for display. */
  stats: { pages: number; illustrations: number; captions: string[] };
}

const STOP_WORDS = new Set(["the", "a", "an", "and", "of", "for", "to", "in", "on", "with", "this", "book", "belongs", "page", "age", "copyright", "all", "rights", "reserved"]);

/** Short text on pages that reads like a subject ("a trireme", "Athena's owl") — AI-series captions and similar. */
function pageCaptions(pages: BookPage[]): string[] {
  const out: string[] = [];
  for (const page of pages) {
    for (const obj of page.objects) {
      if (obj.kind !== "text") continue;
      const text = obj.text.replace(/\s+/g, " ").trim();
      if (!text || text.length > 40 || /double-click|drop your illustration|isbn|copyright/i.test(text)) continue;
      const words = text.toLowerCase().split(" ").filter((w) => !STOP_WORDS.has(w));
      if (words.length > 0 && !out.some((c) => c.toLowerCase() === text.toLowerCase())) out.push(text);
    }
  }
  return out;
}

function countIllustrations(pages: BookPage[]): number {
  return pages.filter((p) => !p.isBlankBack && (p.lines.length > 0 || p.objects.some((o) => o.kind === "stamp" && !o.isFrame))).length;
}

/** User text going into the description HTML (theme, captions) — KDP renders it, and so does our preview. */
function escapeHtml(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).trim();
}

export function buildListingKit(input: ListingInput): ListingKit {
  const theme = input.theme.trim();
  const audience = AUDIENCE_OPTIONS.find((a) => a.value === input.audience) ?? AUDIENCE_OPTIONS[1];
  const captions = pageCaptions(input.pages);
  const pageCount = input.pages.length;
  const illustrations = countIllustrations(input.pages);
  const singleSided = input.pages.some((p) => p.isBlankBack);
  const hasBelongsTo = input.pages.some((p) => p.objects.some((o) => o.kind === "text" && /belongs to/i.test(o.text)));
  const hasColorTest = input.pages.some((p) => p.objects.some((o) => o.kind === "text" && /color test/i.test(o.text)));
  const themeTitle = theme ? titleCase(theme) : "";

  // Subtitle: what it is, who it's for, how much is in it.
  const who = input.audience === "adults" ? "for Adults" : `for ${audience.label} ${audience.ages}`.trim();
  const what = themeTitle ? `${themeTitle} Coloring Book` : "Coloring Book";
  const shown = illustrations || pageCount;
  const subtitle = clip(`${what} ${who}: ${shown} ${singleSided ? "Single-Sided " : ""}Coloring Page${shown === 1 ? "" : "s"}`, Math.max(20, TITLE_SUBTITLE_MAX - input.title.length - 2));

  // Description: KDP-safe HTML. Only the tags written here; user text is escaped.
  const themeHtml = escapeHtml(theme);
  const bullets = [
    `<b>${shown} original ${theme ? `${themeHtml} ` : ""}illustration${shown === 1 ? "" : "s"}</b> with bold, clear outlines that are easy to color`,
    singleSided ? "<b>Single-sided pages</b> — markers won't bleed through onto the next picture" : "",
    `<b>Large ${trimShortLabel(input.trimSizeId)} pages</b>${input.bleed ? ", printed edge to edge" : ""}`,
    hasBelongsTo ? "A <b>“This book belongs to”</b> page to personalize" : "",
    hasColorTest ? "A <b>color test page</b> to try crayons and markers first" : "",
    input.audience === "toddlers" || input.audience === "kids" ? "Great for building <b>fine motor skills</b>, focus and creativity" : "A relaxing, screen-free way to <b>unwind</b>",
    "Makes a great <b>gift</b> for birthdays, holidays and rainy days",
  ].filter(Boolean);
  const inside = captions.length > 0 ? `<br><br><b>Inside you'll find:</b> ${captions.slice(0, 20).map(escapeHtml).join(", ")}${captions.length > 20 ? " and more" : ""}.` : "";
  const intro = theme
    ? `Dive into the world of <b>${themeHtml}</b> with this coloring book made ${input.audience === "adults" ? "for grown-ups who love to color" : `for ${audience.label.toLowerCase()}`}!`
    : `A coloring book made ${input.audience === "adults" ? "for grown-ups who love to color" : `for ${audience.label.toLowerCase()}`}!`;
  const description = clip(`${intro}${inside}<br><br><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>Grab your crayons and start coloring today!`, DESCRIPTION_MAX);

  // Keywords: specific first (theme × audience, captions), then format terms. No filler.
  const candidates = [
    theme && `${theme} coloring book for ${input.audience}`,
    theme && `${theme} coloring pages`,
    theme && `${theme} gifts for ${input.audience === "toddlers" ? "kids" : input.audience}`,
    ...captions.slice(0, 3).map((c) => `${c.toLowerCase()} coloring page`),
    input.audience === "toddlers" ? "toddler coloring book ages 2-4" : input.audience === "kids" ? "coloring books for kids ages 4-8" : input.audience === "teens" ? "coloring book for teens" : "adult coloring book stress relief",
    singleSided ? "single sided coloring pages" : "",
    "large print coloring book",
    input.audience === "adults" ? "relaxing coloring pages" : "activity book for kids",
  ];
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const c of candidates) {
    if (!c) continue;
    const k = clip(c.replace(/\s+/g, " ").trim(), KEYWORD_MAX);
    if (seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    keywords.push(k);
    if (keywords.length === KEYWORD_SLOTS) break;
  }

  return { subtitle, description, keywords, stats: { pages: pageCount, illustrations, captions } };
}
