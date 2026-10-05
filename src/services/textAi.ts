// Which model plans books and runs editor commands. Claude when
// ANTHROPIC_API_KEY is set, else OpenAI; AI_TEXT_PROVIDER=openai|anthropic
// forces one. Pictures are always made by the image providers
// (services/aiGenerator.ts) — Claude doesn't generate images.

import { claudeEditorCommand, claudeListingIdeas, claudeNicheIdeas, claudePlanBook, claudePlanStory, claudeTranslate } from "@/services/claudeText";
import { buildNichePrompt, parseNicheIdeas, type NicheIdea, type NicheRequest } from "@/services/nicheIdeas";
import { buildStoryPrompt, parseStoryPlan, type StoryPlan } from "@/services/storyBook";
import { buildListingIdeasPrompt, buildTranslatePrompt, parseListingIdeas, parseTranslations, type ListingIdeas, type ListingIdeasInput, type TranslateCode } from "@/services/bookTexts";
import { openAiJson } from "@/services/openAiJson";
import { planBook as openAiPlanBook, type BookPlan } from "@/services/bookPlanner";
import { runEditorCommand as openAiEditorCommand } from "@/services/editorCommandAi";
import type { CommandResult, PageSummary } from "@/utils/editorCommand";

export type TextProvider = "anthropic" | "openai";

export function textProvider(env: Record<string, string | undefined> = process.env): TextProvider | null {
  const has = { anthropic: Boolean(env.ANTHROPIC_API_KEY), openai: Boolean(env.OPENAI_API_KEY) };
  const forced = env.AI_TEXT_PROVIDER;
  if ((forced === "anthropic" || forced === "openai") && has[forced]) return forced;
  if (has.anthropic) return "anthropic";
  if (has.openai) return "openai";
  return null;
}

export class NoTextProviderError extends Error {
  constructor() {
    super("No AI key is set — add ANTHROPIC_API_KEY (Claude) or OPENAI_API_KEY to .env.local.");
  }
}

export async function planBookWithAi(description: string, lang: "el" | "en"): Promise<BookPlan> {
  const provider = textProvider();
  if (!provider) throw new NoTextProviderError();
  return provider === "anthropic" ? claudePlanBook(description, lang) : openAiPlanBook(description, lang);
}

export async function editorCommandWithAi(command: string, summary: PageSummary, lang: "el" | "en"): Promise<CommandResult> {
  const provider = textProvider();
  if (!provider) throw new NoTextProviderError();
  return provider === "anthropic" ? claudeEditorCommand(command, summary, lang) : openAiEditorCommand(command, summary, lang);
}

export async function listingIdeasWithAi(input: ListingIdeasInput): Promise<ListingIdeas> {
  const provider = textProvider();
  if (!provider) throw new NoTextProviderError();
  return provider === "anthropic" ? claudeListingIdeas(input) : parseListingIdeas(await openAiJson(buildListingIdeasPrompt(input), "listing request", 1200));
}

export async function translateWithAi(texts: string[], target: TranslateCode): Promise<string[]> {
  const provider = textProvider();
  if (!provider) throw new NoTextProviderError();
  return provider === "anthropic" ? claudeTranslate(texts, target) : parseTranslations(await openAiJson(buildTranslatePrompt(texts, target), "translation request", 8000), texts);
}

export async function planStoryWithAi(idea: string, lang: "el" | "en"): Promise<StoryPlan> {
  const provider = textProvider();
  if (!provider) throw new NoTextProviderError();
  return provider === "anthropic" ? claudePlanStory(idea, lang) : parseStoryPlan(await openAiJson(buildStoryPrompt(idea, lang), "story request", 3000));
}

export async function nicheIdeasWithAi(req: NicheRequest): Promise<NicheIdea[]> {
  const provider = textProvider();
  if (!provider) throw new NoTextProviderError();
  return provider === "anthropic" ? claudeNicheIdeas(req) : parseNicheIdeas(await openAiJson(buildNichePrompt(req), "niche request", 3000));
}
