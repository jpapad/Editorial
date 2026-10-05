// Coloring-book niche ideas for a topic (services/nicheIdeas.ts). Signed-in
// only; one text call, no AI credits.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NoTextProviderError, nicheIdeasWithAi } from "@/services/textAi";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MARKETS = ["us", "uk", "de", "gr"] as const;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const topic = text(body.topic, 200);
  if (!topic) return NextResponse.json({ error: "Type a topic first." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  try {
    const ideas = await nicheIdeasWithAi({
      topic,
      audience: text(body.audience, 100),
      market: MARKETS.includes(body.market as (typeof MARKETS)[number]) ? (body.market as (typeof MARKETS)[number]) : "us",
      lang: body.lang === "en" ? "en" : "el",
    });
    return NextResponse.json({ ideas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not get ideas";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
