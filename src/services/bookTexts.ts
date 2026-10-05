// Two text jobs for a finished book, done by the text model: listing ideas
// (KDP keywords, categories, a subtitle) and translating the book's words.
// Prompts and parsers only — the model's JSON is untrusted, so the parsers
// keep just well-formed, bounded fields. Providers call these (textAi.ts).

export const KEYWORD_SLOTS = 7;
export const KEYWORD_MAX = 50;

export interface ListingIdeasInput {
  title: string;
  theme: string;
  /** Who the book is for, in words ("kids ages 3-5"). */
  audience: string;
  /** Captions found on the pages — what the book actually shows. */
  subjects: string[];
  pageCount: number;
  /** Marketplace language for the keywords. */
  lang: "el" | "en";
}

export interface ListingIdeas {
  /** Up to 7 search phrases, each at most 50 characters. */
  keywords: string[];
  /** Browse categories, most specific last ("Books > Children's Books > Activities > Coloring"). */
  categories: string[];
  subtitle: string;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function buildListingIdeasPrompt(input: ListingIdeasInput): string {
  const language = input.lang === "el" ? "Greek" : "English";
  return [
    "You help self-publishers list coloring books on Amazon KDP. Reply with a JSON object with exactly these keys:",
    `- "keywords": exactly ${KEYWORD_SLOTS} search phrases in ${language} that a buyer would type, each at most ${KEYWORD_MAX} characters. Phrases of 2-4 words; no repeats of the title's own words alone; no brand names, no "best", "free", "new", no author names, no quotation marks.`,
    '- "categories": 3 Amazon browse categories that fit, each written as a path like "Books > Children\'s Books > Activities, Crafts & Games > Coloring". Most relevant first.',
    `- "subtitle": one subtitle in ${language}, at most 150 characters, saying who it is for and what is inside. No keyword stuffing.`,
    "Use only what the book really contains. Reply with the JSON object only.",
    "",
    `Book: ${JSON.stringify({ title: input.title, theme: input.theme, audience: input.audience, pages: input.pageCount, shows: input.subjects.slice(0, 40) })}`,
  ].join("\n");
}

export function parseListingIdeas(raw: unknown): ListingIdeas {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const unique = (list: unknown, max: number, limit: number) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of Array.isArray(list) ? list : []) {
      const value = clean(item, max).replace(/["“”]/g, "");
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      out.push(value);
      if (out.length === limit) break;
    }
    return out;
  };
  const keywords = unique(o.keywords, KEYWORD_MAX, KEYWORD_SLOTS);
  if (keywords.length === 0) throw new Error("The reply had no keywords.");
  return { keywords, categories: unique(o.categories, 160, 3), subtitle: clean(o.subtitle, 150) };
}

// ---------- Translation ----------

export const TRANSLATE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "el", name: "Greek" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
] as const;
export type TranslateCode = (typeof TRANSLATE_LANGUAGES)[number]["code"];
export const isTranslateCode = (v: unknown): v is TranslateCode => TRANSLATE_LANGUAGES.some((l) => l.code === v);

/** Texts per request: enough to keep a book to a few calls, small enough that a reply is never cut off. */
export const TRANSLATE_BATCH = 60;
export const TRANSLATE_TEXT_MAX = 600;

export function buildTranslatePrompt(texts: string[], target: TranslateCode): string {
  const language = TRANSLATE_LANGUAGES.find((l) => l.code === target)!.name;
  return [
    `Translate these texts from a children's coloring and activity book into ${language}. Reply with a JSON object {"translations": [...]} holding exactly ${texts.length} strings, in the same order.`,
    "Rules: keep it natural and simple for a child; keep line breaks (\\n) where they are; keep placeholders in curly braces such as {name} exactly as written; keep numbers, bracketed fill-ins like [ISBN] and proper names; if a text is already in the target language, return it unchanged.",
    "",
    JSON.stringify(texts),
  ].join("\n");
}

/** One translation per input, in order. A missing or empty one falls back to the original, so no text is ever lost. */
export function parseTranslations(raw: unknown, originals: string[]): string[] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.translations) ? o.translations : Array.isArray(raw) ? (raw as unknown[]) : [];
  return originals.map((original, i) => {
    const value = typeof list[i] === "string" ? (list[i] as string).trim().slice(0, TRANSLATE_TEXT_MAX * 2) : "";
    return value || original;
  });
}
