// KDP keywords, categories and a subtitle for a book (services/bookTexts.ts).
// Signed-in only. One cheap text call — no AI credits.

import { NextResponse } from "next/server";
import { requesterKey, takeRate, tooManyRequests } from "@/lib/rateLimit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listingIdeasWithAi, NoTextProviderError } from "@/services/textAi";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const title = text(body.title, 120);
  if (!title) return NextResponse.json({ error: "The book needs a title first." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });
  const rate = takeRate("aiText", requesterKey(request, auth.user.id));
  if (!rate.ok) return tooManyRequests(rate.retryAfter);

  try {
    const ideas = await listingIdeasWithAi({
      title,
      theme: text(body.theme, 120),
      audience: text(body.audience, 60),
      subjects: (Array.isArray(body.subjects) ? body.subjects : []).map((s) => text(s, 60)).filter(Boolean).slice(0, 40),
      pageCount: typeof body.pageCount === "number" && Number.isFinite(body.pageCount) ? Math.max(0, Math.round(body.pageCount)) : 0,
      lang: body.lang === "el" ? "el" : "en",
    });
    return NextResponse.json({ ideas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not get listing ideas";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
