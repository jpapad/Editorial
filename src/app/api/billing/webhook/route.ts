// Stripe → us. The only place plans and bought credits are written, with
// the service-role key (users can't write those tables themselves). The
// signature is checked against STRIPE_WEBHOOK_SECRET before anything else.
//
// In the Stripe dashboard, send these events to /api/billing/webhook:
//   checkout.session.completed, customer.subscription.created,
//   customer.subscription.updated, customer.subscription.deleted
//
// Every write is idempotent (upsert by user / unique session id), so
// Stripe retrying an event does no harm.

import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { stripeRequest, subscriptionRow, verifyStripeEvent, type StripeEvent } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 503 });

  const raw = await request.text();
  let event: StripeEvent;
  try {
    event = verifyStripeEvent(raw, request.headers.get("stripe-signature"), secret);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Bad signature" }, { status: 400 });
  }

  try {
    await handle(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    // A 500 makes Stripe retry later — right for a passing database hiccup.
    console.error("[billing webhook]", event.type, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Webhook failed" }, { status: 500 });
  }
}

async function handle(event: StripeEvent) {
  const db = createServiceSupabaseClient();
  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
    const userId = (obj.client_reference_id as string | null) ?? metadata.user_id;
    if (!userId) return;
    if (obj.mode === "payment") {
      const credits = Number(metadata.credits);
      if (obj.payment_status !== "paid" || !Number.isInteger(credits) || credits <= 0) return;
      const { error } = await db.from("credit_purchases").upsert({ user_id: userId, credits, stripe_session_id: String(obj.id) }, { onConflict: "stripe_session_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      // Remember the customer, so the next checkout and the portal know them.
      if (typeof obj.customer === "string") {
        await db.from("subscriptions").upsert({ user_id: userId, stripe_customer_id: obj.customer }, { onConflict: "user_id", ignoreDuplicates: true });
        await db.from("subscriptions").update({ stripe_customer_id: obj.customer }).eq("user_id", userId).is("stripe_customer_id", null);
      }
      return;
    }
    if (obj.mode === "subscription" && typeof obj.subscription === "string") {
      const sub = await stripeRequest<Record<string, unknown>>("GET", `subscriptions/${obj.subscription}`);
      await saveSubscription(db, userId, sub);
    }
    return;
  }

  if (event.type.startsWith("customer.subscription.")) {
    const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
    let userId: string | undefined = metadata.user_id;
    if (!userId && typeof obj.customer === "string") {
      const { data } = await db.from("subscriptions").select("user_id").eq("stripe_customer_id", obj.customer).maybeSingle();
      userId = data?.user_id;
    }
    if (!userId) return;
    await saveSubscription(db, userId, obj);
  }
}

async function saveSubscription(db: ReturnType<typeof createServiceSupabaseClient>, userId: string, sub: Record<string, unknown>) {
  const row = subscriptionRow(sub);
  // A deleted subscription leaves the account on Free, keeping the customer for next time.
  const ended = row.status === "canceled" || row.status === "incomplete_expired";
  const { error } = await db.from("subscriptions").upsert({ user_id: userId, ...row, plan: ended ? "free" : row.plan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
