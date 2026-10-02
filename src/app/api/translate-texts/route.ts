// Translates a batch of a book's texts (services/bookTexts.ts). Signed-in
// only. Text calls cost no AI credits; batches are capped so one request
// can't be used to translate arbitrary amounts of text.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isTranslateCode, TRANSLATE_BATCH, TRANSLATE_TEXT_MAX } from "@/services/bookTexts";
import { NoTextProviderError, translateWithAi } from "@/services/textAi";

export async function POST(request: Request) {
  let body: { texts?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (!isTranslateCode(body.target)) return NextResponse.json({ error: "Unknown language." }, { status: 400 });
  const texts = Array.isArray(body.texts) ? body.texts : [];
  if (texts.length === 0 || texts.length > TRANSLATE_BATCH || !texts.every((t) => typeof t === "string" && t.length > 0 && t.length <= TRANSLATE_TEXT_MAX)) {
    return NextResponse.json({ error: `Send 1 to ${TRANSLATE_BATCH} texts of at most ${TRANSLATE_TEXT_MAX} characters.` }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  try {
    return NextResponse.json({ translations: await translateWithAi(texts as string[], body.target) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
