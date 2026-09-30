// "A 20-page book of farm animals for 4-year-olds" → a concrete plan: title,
// age group, a drawing style, and one subject per page. Server-only (reads
// OPENAI_API_KEY). The model's JSON is untrusted: parseBookPlan() keeps only
// well-formed, bounded fields.

import { OPENAI_CHAT_ENDPOINT, providerError, REQUEST_TIMEOUT_MS, requireEnv } from "@/services/aiGenerator";

export const MAX_PLAN_PAGES = 24;
export const DEFAULT_PLAN_PAGES = 12;
const AGES = ["3-5", "6-8", "9+"] as const;
export type PlanAge = (typeof AGES)[number];

export interface PlannedPage {
  /** Shown to the user and used as the caption — in the user's language. */
  label: string;
  /** What the image model draws (English works best). */
  subject: string;
}

export interface BookPlan {
  title: string;
  ageGroup: PlanAge;
  /** A short drawing-style/theme line passed with every picture. */
  theme: string;
  pages: PlannedPage[];
  /** Print the label under each picture (on for the youngest readers). */
  captions: boolean;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Validates and bounds a model reply. Throws when there's nothing usable. */
export function parseBookPlan(raw: unknown): BookPlan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ageGroup: PlanAge = AGES.includes(o.ageGroup as PlanAge) ? (o.ageGroup as PlanAge) : "6-8";
  const seen = new Set<string>();
  const pages: PlannedPage[] = [];
  for (const item of Array.isArray(o.pages) ? o.pages : []) {
    const it = (item && typeof item === "object" ? item : { label: item, subject: item }) as Record<string, unknown>;
    const label = text(it.label, 60) || text(it.subject, 60);
    const subject = text(it.subject, 160) || label;
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    pages.push({ label, subject });
    if (pages.length === MAX_PLAN_PAGES) break;
  }
  if (pages.length === 0) throw new Error("The plan had no pages.");
  return {
    title: text(o.title, 80) || pages[0].label,
    ageGroup,
    theme: text(o.theme, 160),
    pages,
    captions: typeof o.captions === "boolean" ? o.captions : ageGroup === "3-5",
  };
}

export function buildBookPlanPrompt(description: string, lang: "el" | "en"): string {
  const language = lang === "el" ? "Greek" : "English";
  return [
    "You plan children's coloring books. Turn the request into a JSON object with exactly these keys:",
    `- "title": a short, friendly book title in ${language}.`,
    '- "ageGroup": one of "3-5", "6-8", "9+" (from the request; "6-8" if it doesn\'t say).',
    '- "theme": one short English line describing the drawing style for every page, matched to the age (e.g. "very simple bold outlines, big shapes, no background" for 3-5).',
    `- "pages": an array of distinct pages, each {"label": a 1-4 word caption in ${language}, "subject": a concrete English description of one coloring-page picture}. Use the page count the request asks for (at most ${MAX_PLAN_PAGES}); ${DEFAULT_PLAN_PAGES} if it doesn't say.`,
    '- "captions": true if the label should be printed under the picture (good for ages 3-5 or when asked).',
    "Keep everything G-rated. Reply with the JSON object only.",
    "",
    `Request: ${JSON.stringify(description)}`,
  ].join("\n");
}

export async function planBook(description: string, lang: "el" | "en"): Promise<BookPlan> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: buildBookPlanPrompt(description, lang) }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError("OpenAI", "planning request", response);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty plan.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("OpenAI returned a plan that wasn't valid JSON.");
    }
    return parseBookPlan(parsed);
  } finally {
    clearTimeout(timeout);
  }
}
