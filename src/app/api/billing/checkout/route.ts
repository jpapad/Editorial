// Starts a Stripe Checkout for a plan (subscription) or an AI credit pack
// (one-off payment) and returns its URL. Signed-in only. What the user gets
// is recorded later by /api/billing/webhook, never here: this route only
// sends them to pay.

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CREDIT_PACKS, PLANS } from "@/lib/plans";
import { siteOrigin, stripeConfigured, stripeRequest } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });

  let body: { plan?: unknown; pack?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const plan = PLANS.find((p) => p.id === body.plan && p.priceEnv);
  const pack = CREDIT_PACKS.find((p) => p.id === body.pack);
  if (!plan && !pack) return NextResponse.json({ error: "Choose a plan or a credit pack." }, { status: 400 });
  const priceId = process.env[(plan?.priceEnv ?? pack?.priceEnv)!];
  if (!priceId) return NextResponse.json({ error: "This option isn't on sale yet." }, { status: 503 });

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: existing } = await supabase.from("subscriptions").select("stripe_customer_id, plan, status").eq("user_id", auth.user.id).maybeSingle();
  if (plan && existing && existing.plan !== "free" && ["active", "trialing", "past_due"].includes(existing.status)) {
    return NextResponse.json({ error: "You already have a plan — change it from “Manage subscription”." }, { status: 409 });
  }

  const origin = siteOrigin(request);
  const customer = existing?.stripe_customer_id ? { customer: existing.stripe_customer_id } : { customer_email: auth.user.email ?? undefined };
  try {
    const session = await stripeRequest<{ url: string }>("POST", "checkout/sessions", {
      mode: plan ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: auth.user.id,
      ...customer,
      ...(plan ? {} : existing?.stripe_customer_id ? {} : { customer_creation: "always" }),
      allow_promotion_codes: true,
      success_url: `${origin}/studio/billing?done=1`,
      cancel_url: `${origin}/studio/billing`,
      metadata: { user_id: auth.user.id, ...(plan ? { plan: plan.id } : { credits: String(pack!.credits) }) },
      ...(plan ? { subscription_data: { metadata: { user_id: auth.user.id, plan: plan.id } } } : {}),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start the payment." }, { status: 502 });
  }
}
