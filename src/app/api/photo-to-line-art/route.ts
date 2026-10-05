// Photo → coloring page (AI). Takes a (client-downscaled) photo as a data
// URL and returns a line-art PNG data URL from services/aiGenerator.ts's
// photoToLineArt. Node runtime (the service reads OPENAI_API_KEY).

import { NextResponse } from "next/server";
import { photoToLineArt } from "@/services/aiGenerator";
import { reserveCredits } from "@/lib/aiCredits";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let body: { photo?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const match = typeof body.photo === "string" ? body.photo.match(/^data:(image\/[a-z]+);base64,(.+)$/) : null;
  if (!match || !ACCEPTED.has(match[1])) return NextResponse.json({ error: "photo must be a JPEG, PNG or WebP data URL" }, { status: 400 });
  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > MAX_BYTES) return NextResponse.json({ error: "photo must be under 8 MB" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.slice(0, 300) : undefined;

  const grant = await reserveCredits("ai_photo", 1);
  if (!grant.ok) return NextResponse.json({ error: grant.error, used: grant.used, limit: grant.limit }, { status: grant.status });

  try {
    const result = await photoToLineArt({ data, mimeType: match[1] }, note);
    return NextResponse.json(result);
  } catch (err) {
    await grant.refund();
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed", refunded: 1 }, { status: 502 });
  }
}
