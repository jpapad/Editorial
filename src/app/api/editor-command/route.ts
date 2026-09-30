// The editor's AI command bar (see utils/editorCommand.ts for what a command
// can do). Signed-in only; the command itself is one text call and costs no
// AI credits — any pictures it adds are generated (and charged) afterwards
// through /api/generate-line-art.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { editorCommandWithAi, NoTextProviderError } from "@/services/textAi";
import { MAX_SUMMARY_OBJECTS, type PageSummary } from "@/utils/editorCommand";

const MAX_COMMAND = 300;

/** Rebuilds the summary from known fields only, so the prompt never carries anything else the client sent. */
function cleanSummary(raw: unknown): PageSummary | null {
  const s = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!s || !Array.isArray(s.objects)) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0);
  const text = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const objects = s.objects.slice(0, MAX_SUMMARY_OBJECTS).flatMap((o) => {
    const r = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    const id = text(r.id, 80);
    if (!id) return [];
    return [{ id, kind: text(r.kind, 10), what: text(r.what, 60), x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h), ...(r.locked === true ? { locked: true } : {}) }];
  });
  return {
    objects,
    lines: typeof s.lines === "number" ? Math.max(0, Math.floor(s.lines)) : 0,
    frame: typeof s.frame === "string" ? s.frame.slice(0, 40) : null,
    pattern: typeof s.pattern === "string" ? s.pattern.slice(0, 40) : null,
    selected: Array.isArray(s.selected) ? s.selected.filter((x): x is string => typeof x === "string").slice(0, MAX_SUMMARY_OBJECTS) : [],
  };
}

export async function POST(request: Request) {
  let body: { command?: unknown; page?: unknown; lang?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const command = typeof body.command === "string" ? body.command.trim() : "";
  if (!command) return NextResponse.json({ error: "Type what to change first." }, { status: 400 });
  if (command.length > MAX_COMMAND) return NextResponse.json({ error: `Keep it under ${MAX_COMMAND} characters.` }, { status: 400 });
  const summary = cleanSummary(body.page);
  if (!summary) return NextResponse.json({ error: "Missing page summary" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to use AI features." }, { status: 401 });

  try {
    return NextResponse.json(await editorCommandWithAi(command, summary, body.lang === "en" ? "en" : "el"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "The command failed";
    return NextResponse.json({ error: message }, { status: err instanceof NoTextProviderError || /is not set/.test(message) ? 503 : 502 });
  }
}
