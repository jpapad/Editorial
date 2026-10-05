// Opens Stripe's customer portal (change plan, card, invoices, cancel).

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { siteOrigin, stripeConfigured, stripeRequest } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripeConfigured()) return NextResponse.json({ error: "Payments aren't set up yet." }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: row } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", auth.user.id).maybeSingle();
  if (!row?.stripe_customer_id) return NextResponse.json({ error: "There's no subscription to manage yet." }, { status: 404 });
  try {
    const session = await stripeRequest<{ url: string }>("POST", "billing_portal/sessions", { customer: row.stripe_customer_id, return_url: `${siteOrigin(request)}/studio/billing` });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not open the subscription page." }, { status: 502 });
  }
}
