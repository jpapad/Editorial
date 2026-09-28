// Real integration point for the editor's "Generate with AI" stamp option
// (see AiGeneratePanel.tsx) — calls services/aiGenerator.ts, which is
// Node-only (reads FAL_KEY/OPENAI_API_KEY from process.env), so it has to
// run here rather than in the browser. Route Handlers run in the Node
// runtime by default, which is required — do not add `export const runtime
// = "edge"`.
//
// UNVERIFIED AGAINST A LIVE PROVIDER: this environment has no FAL_KEY/
// OPENAI_API_KEY configured, so this route has only been exercised for its
// own request validation, not against a real Fal.ai/OpenAI response. If
// either provider's response shape has drifted from what aiGenerator.ts
// expects, that would only surface once a real key is set.

import { NextResponse } from "next/server";
import { generateLineArtImage, type LineArtRequest } from "@/services/aiGenerator";

interface GenerateRequestBody extends LineArtRequest {
  count?: number;
  provider?: "fal" | "openai";
}

interface GenerateResultItem {
  ok: boolean;
  svgMarkup?: string;
  promptUsed?: string;
  error?: string;
}

const MAX_COUNT = 4;

export async function POST(request: Request) {
  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body || typeof body.subject !== "string" || body.subject.trim() === "") {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }

  const count = Math.min(Math.max(body.count ?? MAX_COUNT, 1), MAX_COUNT);
  const requests = Array.from({ length: count }, () =>
    generateLineArtImage({ subject: body.subject, theme: body.theme, aspectRatio: body.aspectRatio }, body.provider ?? "fal")
  );

  const settled = await Promise.allSettled(requests);
  const results: GenerateResultItem[] = settled.map((r) =>
    r.status === "fulfilled"
      ? { ok: true, svgMarkup: r.value.svgMarkup, promptUsed: r.value.promptUsed }
      : { ok: false, error: r.reason instanceof Error ? r.reason.message : "Generation failed" }
  );

  return NextResponse.json({ results });
}
