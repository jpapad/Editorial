// Server-only: asks the model to turn one editor command into actions from
// the fixed set in utils/editorCommand.ts. The reply is validated there;
// nothing the model says is executed directly.

import { OPENAI_CHAT_ENDPOINT, providerError, REQUEST_TIMEOUT_MS, requireEnv } from "@/services/aiGenerator";
import { COMMAND_FRAMES, COMMAND_PATTERNS, COMMAND_SHAPES, MAX_COMMAND_ACTIONS, parseCommandResult, type CommandResult, type PageSummary } from "@/utils/editorCommand";

export function buildCommandPrompt(command: string, summary: PageSummary, lang: "el" | "en"): string {
  const language = lang === "el" ? "Greek" : "English";
  return [
    "You edit one page of a children's coloring book by returning actions. Reply with a JSON object: {\"reply\": string, \"actions\": array}.",
    `"reply": one short, friendly sentence in ${language} saying what you did — or, if the request can't be done with the actions below, why not (with "actions": []).`,
    `"actions": at most ${MAX_COMMAND_ACTIONS}, in order, each one of:`,
    '- {"type":"add_picture","subject":"<concrete English description of one black-and-white line drawing>","x":0-1,"y":0-1,"w":0.1-1}',
    '- {"type":"add_text","text":"<short text, in the user\'s language>","x":0-1,"y":0-1,"size":"small"|"medium"|"large"}',
    `- {"type":"add_shape","shape":${JSON.stringify(COMMAND_SHAPES)},"x":0-1,"y":0-1,"w":0.05-1}`,
    '- {"type":"move","ids":[...],"x":0-1,"y":0-1}  (centre of the moved objects)',
    '- {"type":"scale","ids":[...],"factor":0.25-4}',
    '- {"type":"delete","ids":[...]}   {"type":"duplicate","ids":[...]}   {"type":"flip","ids":[...],"direction":"horizontal"|"vertical"}',
    `- {"type":"set_frame","frame":${JSON.stringify(COMMAND_FRAMES)} or null}   {"type":"set_pattern","pattern":${JSON.stringify(COMMAND_PATTERNS)} or null}`,
    '- {"type":"thicken_lines"} (fixes faint lines)   {"type":"fit_margins"} (pulls everything inside the print margin)',
    "Coordinates are fractions of the printable area: x=0 left, x=1 right, y=0 top, y=1 bottom; (0.5,0.5) is the middle; \"bottom left\" ≈ (0.2,0.8). w is a fraction of the page width.",
    "Only use ids from the page below. \"this\"/\"it\" means the selected objects. Never change locked objects. Keep everything G-rated.",
    "",
    `Page: ${JSON.stringify(summary)}`,
    `Request: ${JSON.stringify(command)}`,
  ].join("\n");
}

export async function runEditorCommand(command: string, summary: PageSummary, lang: "el" | "en"): Promise<CommandResult> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: buildCommandPrompt(command, summary, lang) }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError("OpenAI", "command request", response);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "null");
    } catch {
      // fall through: an unparseable reply is simply "no actions"
    }
    return parseCommandResult(parsed, summary.objects.map((o) => o.id));
  } finally {
    clearTimeout(timeout);
  }
}
