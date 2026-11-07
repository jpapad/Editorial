// Reads a page described in the user's own words into a strict layout list
// (services/pageSpec.ts). Signed-in only; one text call, no AI credits —
// the pictures on the page are generated (and charged) afterwards.

import { NextResponse } from "next/server";
import { requesterKey, takeRate, tooManyRequests } from "@/lib/rateLimit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NoTextProviderError, pageSpecWithAi } from "@/services/textAi";
import { PAGE_MODES, type PageMode } from "@/services/pageSpec";

const MAX_INSTRUCTIONS = 3000;

export async function POST(request: Request) {
  let body: { instructions?: unknown; lang?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
  if (!instructions) return NextResponse.json({ error: "Describe the page first." }, { status: 400 });
  if (instructions.length > MAX_INSTRUCTIONS) return NextResponse.json({ error: `Keep the instructions under ${MAX_INSTRUCTIONS} characters.` }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });
  const rate = takeRate("aiText", requesterKey(request, auth.user.id));
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  try {
    const mode = PAGE_MODES.includes(body.mode as PageMode) ? (body.mode as PageMode) : "lineart";
    const spec = await pageSpecWithAi(instructions, body.lang === "en" ? "en" : "el", mode);
    return NextResponse.json({ spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the instructions";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
