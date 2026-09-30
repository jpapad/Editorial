// Plans a whole coloring book from a sentence (services/bookPlanner.ts).
// Signed-in only. Planning is one cheap text call, so it costs no AI
// credits; the pictures are generated (and charged) one by one afterwards
// through /api/generate-line-art.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NoTextProviderError, planBookWithAi } from "@/services/textAi";

const MAX_DESCRIPTION = 500;

export async function POST(request: Request) {
  let body: { description?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "Describe the book first." }, { status: 400 });
  if (description.length > MAX_DESCRIPTION) return NextResponse.json({ error: `Keep the description under ${MAX_DESCRIPTION} characters.` }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  try {
    const plan = await planBookWithAi(description, body.lang === "en" ? "en" : "el");
    return NextResponse.json({ plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
