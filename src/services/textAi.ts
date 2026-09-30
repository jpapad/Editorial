// Which model plans books and runs editor commands. Claude when
// ANTHROPIC_API_KEY is set, else OpenAI; AI_TEXT_PROVIDER=openai|anthropic
// forces one. Pictures are always made by the image providers
// (services/aiGenerator.ts) — Claude doesn't generate images.

import { claudeEditorCommand, claudePlanBook } from "@/services/claudeText";
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
