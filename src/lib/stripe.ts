// Stripe, server side only (reads STRIPE_SECRET_KEY). Plain `fetch` to
// Stripe's REST API instead of the SDK — the few calls we need are form
// posts, and the app keeps its dependencies few (see aiGenerator.ts).
// Never import this from a "use client" file.

import { createHmac, timingSafeEqual } from "node:crypto";
import { planForPrice, type PlanId } from "@/lib/plans";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Payments aren't set up yet.");
  }
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

type Params = { [key: string]: string | number | boolean | undefined | null | Params | Params[] };

/** Stripe's form encoding: nested objects as a[b]=…, arrays as a[0][b]=…. */
export function formEncode(params: Params, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) value.forEach((item, i) => parts.push(formEncode(item, `${name}[${i}]`)));
    else if (typeof value === "object") parts.push(formEncode(value, name));
    else parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return parts.filter(Boolean).join("&");
}

export async function stripeRequest<T>(method: "GET" | "POST", path: string, params?: Params): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  const body = params ? formEncode(params) : undefined;
  const url = method === "GET" && body ? `https://api.stripe.com/v1/${path}?${body}` : `https://api.stripe.com/v1/${path}`;
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
  });
  const json = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!response.ok || !json) throw new Error(json?.error?.message ?? `Stripe request failed (${response.status})`);
  return json;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Checks the Stripe-Signature header (HMAC-SHA256 of "timestamp.body" with
 * the endpoint's signing secret) and returns the parsed event. Throws when
 * the signature doesn't match or is older than `toleranceSec`.
 */
export function verifyStripeEvent(rawBody: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): StripeEvent {
  if (!header) throw new Error("Missing Stripe-Signature header");
  const fields = header.split(",").map((kv) => kv.split("=") as [string, string]);
  const timestamp = Number(fields.find(([k]) => k === "t")?.[1]);
  const signatures = fields.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) throw new Error("Malformed Stripe-Signature header");
  if (Math.abs(nowSec - timestamp) > toleranceSec) throw new Error("Stripe signature is too old");
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"));
  const matches = signatures.some((sig) => {
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) throw new Error("Stripe signature doesn't match");
  return JSON.parse(rawBody) as StripeEvent;
}

/** The fields of a Stripe Subscription object that we keep. */
export interface SubscriptionRow {
  plan: PlanId;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/**
 * A Stripe Subscription → our row. The plan comes from the price (so a
 * change made in Stripe's customer portal is followed), falling back to the
 * metadata set at checkout. Newer API versions keep the period end on the
 * subscription item, older ones on the subscription itself.
 */
export function subscriptionRow(sub: Record<string, unknown>, env: Record<string, string | undefined> = process.env): SubscriptionRow {
  const items = (sub.items as { data?: { price?: { id?: string }; current_period_end?: number }[] } | undefined)?.data ?? [];
  const metadata = (sub.metadata as Record<string, string> | undefined) ?? {};
  const fromMeta = metadata.plan === "pro" || metadata.plan === "studio" ? metadata.plan : null;
  const plan = planForPrice(items[0]?.price?.id, env) ?? fromMeta ?? "free";
  const periodEnd = (sub.current_period_end as number | undefined) ?? items[0]?.current_period_end;
  const customer = sub.customer;
  return {
    plan,
    status: String(sub.status ?? "incomplete"),
    stripe_customer_id: typeof customer === "string" ? customer : ((customer as { id?: string } | null)?.id ?? null),
    stripe_subscription_id: String(sub.id),
    current_period_end: typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  };
}

/** The site's own origin for Stripe's return links. */
export function siteOrigin(request: Request): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
}
