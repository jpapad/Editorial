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
import { generateLineArtFromReference, generateLineArtImage, type LineArtRequest } from "@/services/aiGenerator";
import { reserveCredits } from "@/lib/aiCredits";

interface GenerateRequestBody extends LineArtRequest {
  count?: number;
  provider?: "fal" | "openai";
  /** PNG data URL of the book's character, to draw them the same way (needs OPENAI_API_KEY). */
  characterRef?: string;
}

const MAX_REF_BYTES = 4_000_000;

/** A PNG/JPEG/WebP data URL → bytes, or null when it isn't one (or is too big). */
function referenceImage(value: unknown): { data: Buffer; mimeType: string } | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const data = Buffer.from(match[2], "base64");
  return data.length > 0 && data.length <= MAX_REF_BYTES ? { data, mimeType: match[1] } : null;
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

  // One credit per image, reserved before any provider call; failures are refunded below.
  const grant = await reserveCredits("ai_image", count);
  if (!grant.ok) return NextResponse.json({ error: grant.error, used: grant.used, limit: grant.limit }, { status: grant.status });

  const lineArt: LineArtRequest = {
    subject: body.subject.slice(0, 300),
    theme: typeof body.theme === "string" ? body.theme.slice(0, 200) : undefined,
    aspectRatio: body.aspectRatio,
    character: typeof body.character === "string" && body.character.trim() ? body.character.trim().slice(0, 400) : undefined,
  };
  // With a reference picture of the character (and an OpenAI key), every page is drawn from it.
  const reference = process.env.OPENAI_API_KEY ? referenceImage(body.characterRef) : null;
  const requests = Array.from({ length: count }, () => (reference ? generateLineArtFromReference(lineArt, reference) : generateLineArtImage(lineArt, body.provider ?? "fal")));

  const settled = await Promise.allSettled(requests);
  const results: GenerateResultItem[] = settled.map((r) =>
    r.status === "fulfilled"
      ? { ok: true, svgMarkup: r.value.svgMarkup, promptUsed: r.value.promptUsed }
      : { ok: false, error: r.reason instanceof Error ? r.reason.message : "Generation failed" }
  );

  const refunded = results.filter((r) => !r.ok).length;
  await grant.refund(refunded);
  return NextResponse.json({ results, refunded });
}
