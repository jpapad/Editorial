// Short-term rate limits for the API routes: how many requests one user
// (or, signed out, one IP address) may make per minute. The monthly AI
// credits (sql/05, sql/09) cap cost; this stops bursts — a stuck loop, a
// script hammering an endpoint — before they reach a paid provider.
//
// In memory, per server instance: on a host running several instances
// each keeps its own count, so the real limit is a small multiple of
// these numbers. That is enough for its purpose; a shared store (Redis,
// Postgres) can replace `hits` later without changing callers.

export interface RateRule {
  /** Requests allowed per window. */
  max: number;
  windowMs: number;
}

export const RATE_RULES = {
  /** Picture generation (each request may be up to 4 images). */
  aiImage: { max: 10, windowMs: 60_000 },
  /** Text AI: planning, stories, ideas, listing, translation, editor commands. */
  aiText: { max: 20, windowMs: 60_000 },
  /** PDF building is heavy on the server. */
  export: { max: 30, windowMs: 60_000 },
  /** Browser error reports. */
  errorLog: { max: 20, windowMs: 60_000 },
} satisfies Record<string, RateRule>;

export type RateBucket = keyof typeof RATE_RULES;

const hits = new Map<string, number[]>();
let lastSweep = 0;

/**
 * Records one request for `key` in `bucket` and says whether it's allowed.
 * `retryAfter` is in seconds, for the Retry-After header.
 */
export function takeRate(bucket: RateBucket, key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const rule = RATE_RULES[bucket];
  const id = `${bucket}:${key}`;
  const recent = (hits.get(id) ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.max) {
    hits.set(id, recent);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(id, recent);
  // Now and then, forget keys that have gone quiet so the map can't grow without end.
  if (now - lastSweep > 5 * 60_000) {
    lastSweep = now;
    for (const [k, times] of hits) if (times.every((t) => now - t >= 10 * 60_000)) hits.delete(k);
  }
  return { ok: true };
}

/** Who's asking: the user id when signed in, else the client's IP (behind a proxy, its first forwarded address). */
export function requesterKey(request: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}

/** A 429 response for a refused request. */
export function tooManyRequests(retryAfter: number): Response {
  return Response.json({ error: "Too many requests — wait a moment and try again." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}

/** Test hook: start from an empty count. */
export function resetRates() {
  hits.clear();
}
