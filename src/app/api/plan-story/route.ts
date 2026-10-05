// Writes a short illustrated story from an idea (services/storyBook.ts).
// Signed-in only. Like /api/plan-book: one text call, no AI credits — the
// pictures are generated (and charged) one by one afterwards.

import { NextResponse } from "next/server";
import { requesterKey, takeRate, tooManyRequests } from "@/lib/rateLimit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NoTextProviderError, planStoryWithAi } from "@/services/textAi";

const MAX_IDEA = 500;

export async function POST(request: Request) {
  let body: { idea?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  if (!idea) return NextResponse.json({ error: "Describe the story first." }, { status: 400 });
  if (idea.length > MAX_IDEA) return NextResponse.json({ error: `Keep the idea under ${MAX_IDEA} characters.` }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });
  const rate = takeRate("aiText", requesterKey(request, auth.user.id));
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  try {
    const story = await planStoryWithAi(idea, body.lang === "en" ? "en" : "el");
    return NextResponse.json({ story });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Writing the story failed";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
