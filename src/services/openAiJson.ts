// One OpenAI chat request whose reply is a JSON object — the OpenAI side of
// the text jobs in bookTexts.ts (Claude's side is claudeText.ts).

import { OPENAI_CHAT_ENDPOINT, providerError, REQUEST_TIMEOUT_MS, requireEnv } from "@/services/aiGenerator";

export async function openAiJson(prompt: string, what: string, maxTokens = 4000): Promise<unknown> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.4, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError("OpenAI", what, response);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned an empty reply.");
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("OpenAI returned a reply that wasn't valid JSON.");
    }
  } finally {
    clearTimeout(timeout);
  }
}
