// Browser errors (src/instrumentation-client.ts) → the app's error log.
// Open to signed-out pages too (the kids' side has no accounts), so it is
// rate-limited per IP and only bounded text is kept.

import { NextResponse } from "next/server";
import { errorPath, logAppError } from "@/lib/errorLog";
import { requesterKey, takeRate, tooManyRequests } from "@/lib/rateLimit";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const rate = takeRate("errorLog", requesterKey(request));
  if (!rate.ok) return tooManyRequests(rate.retryAfter);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await request.text()).slice(0, 8000));
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const message = text(body.message, 500);
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  await logAppError("client", message, errorPath(text(body.path, 300)), { userAgent: request.headers.get("user-agent") ?? undefined });
  return new NextResponse(null, { status: 204 });
}
