// Server-only: Claude as the app's text model — the book planner and the
// editor's command bar. Structured outputs (output_config.format) make the
// reply match our JSON schema; parseBookPlan / parseCommandResult still
// validate and bound it, exactly as for the OpenAI path.

import { buildListingIdeasPrompt, buildTranslatePrompt, parseListingIdeas, parseTranslations, type ListingIdeas, type ListingIdeasInput, type TranslateCode } from "@/services/bookTexts";
import Anthropic from "@anthropic-ai/sdk";
import { buildBookPlanPrompt, MAX_PLAN_PAGES, parseBookPlan, type BookPlan } from "@/services/bookPlanner";
import { buildCommandPrompt } from "@/services/editorCommandAi";
import { COMMAND_FRAMES, COMMAND_PATTERNS, COMMAND_SHAPES, parseCommandResult, type CommandResult, type PageSummary } from "@/utils/editorCommand";

/** Claude Opus 5.5 unless ANTHROPIC_MODEL says otherwise. */
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic()); // reads ANTHROPIC_API_KEY

type Effort = "low" | "medium" | "high";

/** One request whose reply must be JSON matching `schema`. Throws a message that's safe to show a user. */
async function claudeJson(prompt: string, schema: Record<string, unknown>, effort: Effort): Promise<unknown> {
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API re-runs the request on
      // Anthropic's recommended fallback model instead of refusing outright.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort, format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    // Details stay in the server log; the user gets a plain hint.
    console.error("[claudeText] request failed:", err);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new Error("Claude rejected the API key — check ANTHROPIC_API_KEY in .env.local.");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is busy (rate limit) — try again in a moment.");
    if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) throw new Error("Claude had a problem — try again.");
    if (err instanceof Anthropic.APIConnectionError) throw new Error("Couldn't reach Claude — check the connection.");
    throw new Error("The request to Claude was refused.");
  }
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request. Try wording it differently.");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off. Try a shorter request.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Claude returned something that wasn't valid JSON.");
  }
}

const str = { type: "string" };
const num = { type: "number" };
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const ids = { type: "array", items: str };

const BOOK_PLAN_SCHEMA = obj({
  title: str,
  ageGroup: { type: "string", enum: ["3-5", "6-8", "9+"] },
  theme: str,
  pages: { type: "array", items: obj({ label: str, subject: str }), description: `At most ${MAX_PLAN_PAGES} pages.` },
  captions: { type: "boolean" },
});

const action = (type: string, fields: Record<string, unknown> = {}) => obj({ type: { type: "string", enum: [type] }, ...fields });
const COMMAND_SCHEMA = obj({
  reply: str,
  actions: {
    type: "array",
    items: {
      anyOf: [
        action("add_picture", { subject: str, x: num, y: num, w: num }),
        action("add_text", { text: str, x: num, y: num, size: { type: "string", enum: ["small", "medium", "large"] } }),
        action("add_shape", { shape: { type: "string", enum: [...COMMAND_SHAPES] }, x: num, y: num, w: num }),
        action("move", { ids, x: num, y: num }),
        action("scale", { ids, factor: num }),
        action("delete", { ids }),
        action("duplicate", { ids }),
        action("flip", { ids, direction: { type: "string", enum: ["horizontal", "vertical"] } }),
        action("set_frame", { frame: { anyOf: [{ type: "string", enum: COMMAND_FRAMES }, { type: "null" }] } }),
        action("set_pattern", { pattern: { anyOf: [{ type: "string", enum: COMMAND_PATTERNS }, { type: "null" }] } }),
        action("thicken_lines"),
        action("fit_margins"),
      ],
    },
  },
});

const LISTING_SCHEMA = obj({ keywords: { type: "array", items: str }, categories: { type: "array", items: str }, subtitle: str });
const TRANSLATIONS_SCHEMA = obj({ translations: { type: "array", items: str } });

export async function claudeListingIdeas(input: ListingIdeasInput): Promise<ListingIdeas> {
  return parseListingIdeas(await claudeJson(buildListingIdeasPrompt(input), LISTING_SCHEMA, "medium"));
}

export async function claudeTranslate(texts: string[], target: TranslateCode): Promise<string[]> {
  return parseTranslations(await claudeJson(buildTranslatePrompt(texts, target), TRANSLATIONS_SCHEMA, "low"), texts);
}

export async function claudePlanBook(description: string, lang: "el" | "en"): Promise<BookPlan> {
  return parseBookPlan(await claudeJson(buildBookPlanPrompt(description, lang), BOOK_PLAN_SCHEMA, "medium"));
}

export async function claudeEditorCommand(command: string, summary: PageSummary, lang: "el" | "en"): Promise<CommandResult> {
  // Low effort: a command should feel quick, and the action set is small.
  return parseCommandResult(await claudeJson(buildCommandPrompt(command, summary, lang), COMMAND_SCHEMA, "low"), summary.objects.map((o) => o.id));
}
