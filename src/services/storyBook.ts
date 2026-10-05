// "A brave little turtle who wants to see the sea" → a short illustrated
// story: one sentence or two per page, plus a scene to color. The same
// character description goes with every picture so they look alike.
// The model's JSON is untrusted: parseStoryPlan() keeps only well-formed,
// bounded fields.

import type { PlanAge } from "@/services/bookPlanner";

export const MAX_STORY_PAGES = 16;
export const DEFAULT_STORY_PAGES = 8;
const AGES = ["3-5", "6-8", "9+"] as const;

export interface StoryPage {
  /** The story text printed on the page, in the user's language. */
  text: string;
  /** What the picture shows (English, for the image model). */
  scene: string;
}

export interface StoryPlan {
  title: string;
  ageGroup: PlanAge;
  /** Drawing style for every page (English). */
  theme: string;
  /** A detailed, fixed visual description of the main character (English). */
  character: string;
  pages: StoryPage[];
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseStoryPlan(raw: unknown): StoryPlan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ageGroup: PlanAge = AGES.includes(o.ageGroup as PlanAge) ? (o.ageGroup as PlanAge) : "3-5";
  const pages: StoryPage[] = [];
  for (const item of Array.isArray(o.pages) ? o.pages : []) {
    const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const pageText = text(it.text, 260);
    const scene = text(it.scene, 240);
    if (!pageText || !scene) continue;
    pages.push({ text: pageText, scene });
    if (pages.length === MAX_STORY_PAGES) break;
  }
  if (pages.length === 0) throw new Error("The story had no pages.");
  return {
    title: text(o.title, 80) || pages[0].text.slice(0, 40),
    ageGroup,
    theme: text(o.theme, 160),
    character: text(o.character, 400),
    pages,
  };
}

export function buildStoryPrompt(idea: string, lang: "el" | "en"): string {
  const language = lang === "el" ? "Greek" : "English";
  return [
    "You write short illustrated stories for children's coloring books. Turn the idea into a JSON object with exactly these keys:",
    `- "title": a short, warm book title in ${language}.`,
    '- "ageGroup": one of "3-5", "6-8", "9+" (from the idea; "3-5" if it doesn\'t say).',
    '- "theme": one short English line describing the drawing style, matched to the age (e.g. "very simple bold outlines, big shapes" for 3-5).',
    '- "character": a detailed English visual description of the main character that stays the same on every page (species or kind, body shape, face, clothes, accessories, distinctive marks) — 1 or 2 sentences, no colors (it is a coloring book).',
    `- "pages": the story, page by page (as many as the idea asks for, at most ${MAX_STORY_PAGES}; ${DEFAULT_STORY_PAGES} if it doesn't say). Each page is {"text": 1–2 short sentences of the story in ${language}, simple enough for the age, "scene": a concrete English description of the picture for that page, naming the main character and what they do, with a few simple surroundings}.`,
    "The story has a clear beginning, a small problem, and a happy ending on the last page. Keep everything gentle and G-rated. Reply with the JSON object only.",
    "",
    `Idea: ${JSON.stringify(idea)}`,
  ].join("\n");
}

export const STORY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    ageGroup: { type: "string", enum: ["3-5", "6-8", "9+"] },
    theme: { type: "string" },
    character: { type: "string" },
    pages: { type: "array", items: { type: "object", properties: { text: { type: "string" }, scene: { type: "string" } }, required: ["text", "scene"], additionalProperties: false }, description: `At most ${MAX_STORY_PAGES} pages.` },
  },
  required: ["title", "ageGroup", "theme", "character", "pages"],
  additionalProperties: false,
};
