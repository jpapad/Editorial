// "A brave little turtle who wants to see the sea" → a short illustrated
// story: one sentence or two per page, plus a scene to color. The same
// character description goes with every picture so they look alike.
// The model's JSON is untrusted: parseStoryPlan() keeps only well-formed,
// bounded fields.

import type { PlanAge } from "@/services/bookPlanner";

export const MAX_STORY_PAGES = 16;
/** The most text the user can give: an idea, or a whole story to split into pages. */
export const MAX_STORY_INPUT = 4000;
export const DEFAULT_STORY_PAGES = 8;
const AGES = ["3-5", "6-8", "9+"] as const;

/** Languages a story can be written in (the page text, the activity pages and the voice that reads it). */
export const STORY_LANGUAGES = [
  { value: "el", label: "Ελληνικά", name: "Greek" },
  { value: "en", label: "English", name: "English" },
  { value: "de", label: "Deutsch", name: "German" },
  { value: "fr", label: "Français", name: "French" },
  { value: "es", label: "Español", name: "Spanish" },
  { value: "it", label: "Italiano", name: "Italian" },
] as const;
export type StoryLanguage = (typeof STORY_LANGUAGES)[number]["value"];

export function isStoryLanguage(v: unknown): v is StoryLanguage {
  return STORY_LANGUAGES.some((l) => l.value === v);
}

export interface StoryPage {
  /** The story text printed on the page, in the user's language. */
  text: string;
  /** What the picture shows (English, for the image model). */
  scene: string;
}

/** A multiple-choice question about the story (all in the story's language). */
export interface StoryQuestion {
  question: string;
  choices: string[];
  /** Index into `choices`. */
  answer: number;
}

export interface StoryPlan {
  title: string;
  ageGroup: PlanAge;
  /** Drawing style for every page (English). */
  theme: string;
  /** A detailed, fixed visual description of the main character (English). */
  character: string;
  pages: StoryPage[];
  /** For the activity pages, all in the story's language. */
  questions: StoryQuestion[];
  /** Single words from the story, for the word search. */
  words: string[];
  /** The story's message in one sentence (may be empty). */
  moral: string;
  /** Open questions to talk about with a grown-up. */
  discussion: string[];
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
  const questions: StoryQuestion[] = [];
  for (const item of Array.isArray(o.questions) ? o.questions : []) {
    const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const question = text(it.question, 160);
    const choices = (Array.isArray(it.choices) ? it.choices : []).map((c) => text(c, 60)).filter(Boolean).slice(0, 4);
    const answer = typeof it.answer === "number" ? Math.round(it.answer) : -1;
    if (!question || choices.length < 2 || answer < 0 || answer >= choices.length) continue;
    questions.push({ question, choices, answer });
    if (questions.length === 5) break;
  }
  const words = [...new Set((Array.isArray(o.words) ? o.words : []).map((w) => text(w, 14)).filter((w) => w && !/\s/.test(w)))].slice(0, 10);
  const discussion = (Array.isArray(o.discussion) ? o.discussion : []).map((d) => text(d, 160)).filter(Boolean).slice(0, 4);
  return {
    title: text(o.title, 80) || pages[0].text.slice(0, 40),
    ageGroup,
    theme: text(o.theme, 160),
    character: text(o.character, 400),
    pages,
    questions,
    words,
    moral: text(o.moral, 200),
    discussion,
  };
}

export function buildStoryPrompt(idea: string, lang: StoryLanguage): string {
  const language = STORY_LANGUAGES.find((l) => l.value === lang)?.name ?? "Greek";
  return [
    "You write short illustrated stories for children's coloring books. Turn the idea into a JSON object with exactly these keys:",
    `- "title": a short, warm book title in ${language}.`,
    '- "ageGroup": one of "3-5", "6-8", "9+" (from the idea; "3-5" if it doesn\'t say).',
    '- "theme": one short English line describing the drawing style, matched to the age (e.g. "very simple bold outlines, big shapes" for 3-5).',
    '- "character": a detailed English visual description of the main character that stays the same on every page (species or kind, body shape, face, clothes, accessories, distinctive marks) — 1 or 2 sentences, no colors (it is a coloring book).',
    `- "pages": the story, page by page (as many as the idea asks for, at most ${MAX_STORY_PAGES}; ${DEFAULT_STORY_PAGES} if it doesn't say). Each page is {"text": 1–2 short sentences of the story in ${language}, simple enough for the age, "scene": a concrete English description of the picture for that page, naming the main character and what they do, with a few simple surroundings}.`,
    "If the request is only an idea, write the story: a clear beginning, a small problem, and a happy ending on the last page.",
    `If the request is already a story or a summary, do NOT invent a different one: keep its title (if it has one), its characters, its events and their order, and split it into pages — one scene per page, in the same order, with the story's own wording shortened to 1–2 sentences per page in ${language}.`,
    `- "questions": 3 to 5 multiple-choice questions about what happens in the story, each {"question", "choices": 3 short answers, "answer": the index (0-based) of the right one}, in ${language}, simple enough for the age.`,
    `- "words": 6 to 10 single words from the story (names of things, animals, places — no phrases, no spaces), in ${language}, for a word search.`,
    `- "moral": the story's message in one short sentence in ${language} (empty if it has none).`,
    `- "discussion": 2 or 3 open questions in ${language} a grown-up can ask the child about the story (feelings, choices, what they would do).`,
    "Keep everything gentle and G-rated. Reply with the JSON object only.",
    "",
    `Request: ${JSON.stringify(idea)}`,
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
    questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, choices: { type: "array", items: { type: "string" } }, answer: { type: "integer" } }, required: ["question", "choices", "answer"], additionalProperties: false } },
    words: { type: "array", items: { type: "string" } },
    moral: { type: "string" },
    discussion: { type: "array", items: { type: "string" } },
  },
  required: ["title", "ageGroup", "theme", "character", "pages", "questions", "words", "moral", "discussion"],
  additionalProperties: false,
};
