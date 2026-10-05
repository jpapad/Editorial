"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Sparkles } from "lucide-react";
import Button from "@/components/studio/ui/Button";
import Card from "@/components/studio/ui/Card";
import MetaLabel from "@/components/studio/ui/MetaLabel";
import { cn } from "@/utils/cn";
import { useT } from "@/lib/i18n";
import { useAiUsage } from "@/lib/aiUsage";
import { supabase } from "@/lib/supabase/client";
import { CREDIT_PACKS, PLANS, planById, type PackId, type PlanId } from "@/lib/plans";
import type { SubscriptionRow } from "@/types/database";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

/**
 * Plans & credits: this month's AI use, the plan (Stripe subscription) and
 * credit packs. Buttons only send the user to Stripe; the plan and credits
 * change when Stripe tells /api/billing/webhook, so after paying the page
 * re-reads them for a little while.
 */
export default function BillingScreen() {
  const t = useT();
  const { usage, refresh } = useAiUsage();
  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justPaid] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("done"));

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      supabase
        .from("subscriptions")
        .select("*")
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setSub(data ?? null);
        });
    void load();
    if (!justPaid) return;
    // Stripe's webhook usually lands within seconds of the redirect back.
    const timer = setInterval(() => {
      void load();
      refresh();
    }, 3000);
    const stop = setTimeout(() => clearInterval(timer), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [justPaid, refresh]);

  const currentPlan: PlanId = (usage?.plan as PlanId | undefined) ?? "free";
  const paid = currentPlan !== "free";

  async function go(path: string, body: Record<string, string>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !json?.url) throw new Error(json?.error ? t(json.error) : t("Could not start the payment."));
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not start the payment."));
      setBusy(null);
    }
  }

  const left = usage && usage.limit !== null ? Math.max(0, usage.limit - usage.used) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <MetaLabel>Pagewright</MetaLabel>
          <h1 className="text-page-title font-semibold tracking-[-0.02em] text-ink">{t("Plans & credits")}</h1>
        </div>
        <Link href="/studio" className="text-body font-medium text-ink-secondary hover:text-ink">
          ← {t("Back to the studio")}
        </Link>
      </header>

      {justPaid && (
        <p role="status" className="rounded-row-sm bg-success/15 px-4 py-3 text-body text-ink">
          {t("Thank you! Your payment went through — your plan and credits update here in a few seconds.")}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-row-sm bg-error/10 px-4 py-3 text-body text-error">
          {error}
        </p>
      )}

      <Card className="flex flex-wrap items-center gap-6 p-5">
        <div className="flex flex-col gap-0.5">
          <MetaLabel>{t("Your plan")}</MetaLabel>
          <p className="text-section-title font-semibold text-ink" data-testid="current-plan">
            {planById(currentPlan).name}
          </p>
          {sub?.current_period_end && paid && (
            <p className="text-helper text-ink-muted">
              {sub.cancel_at_period_end ? t("Ends on {date}", { date: dateFmt.format(new Date(sub.current_period_end)) }) : t("Renews on {date}", { date: dateFmt.format(new Date(sub.current_period_end)) })}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <MetaLabel>{t("AI this month")}</MetaLabel>
          <p className="text-section-title font-semibold text-ink" data-testid="ai-left">
            {usage === null ? "—" : usage.limit === null ? t("Unlimited") : t("{left} of {limit} left", { left: left ?? 0, limit: usage.limit })}
          </p>
          <p className="text-helper text-ink-muted">{t("Resets on the 1st of the month.")}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <MetaLabel>{t("Bought credits")}</MetaLabel>
          <p className="text-section-title font-semibold text-ink" data-testid="extra-credits">
            {usage?.extra ?? 0}
          </p>
          <p className="text-helper text-ink-muted">{t("Never expire; used after the monthly ones.")}</p>
        </div>
        {sub?.stripe_customer_id && (
          <Button variant="secondary" className="ml-auto" onClick={() => void go("/api/billing/portal", {}, "portal")} disabled={busy !== null} icon={busy === "portal" ? <Loader2 size={14} className="animate-spin" /> : undefined}>
            {t("Manage subscription")}
          </Button>
        )}
      </Card>

      <section aria-label={t("Plans")} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <Card key={plan.id} className={cn("flex flex-col gap-3 p-5", isCurrent && "ring-2 ring-accent")}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-section-title font-semibold text-ink">{plan.name}</p>
                <p className="text-body font-semibold text-ink-secondary">{t(plan.price)}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-body text-ink-secondary">
                    <Check size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    {t(f)}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <p className="text-center text-helper font-semibold text-accent">{t("Your current plan")}</p>
              ) : plan.id === "free" ? (
                <p className="text-center text-helper text-ink-muted">{paid ? t("Cancel from “Manage subscription”.") : ""}</p>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => (paid ? void go("/api/billing/portal", {}, "portal") : void go("/api/billing/checkout", { plan: plan.id }, plan.id))}
                  disabled={busy !== null}
                  icon={busy === plan.id ? <Loader2 size={14} className="animate-spin" /> : undefined}
                >
                  {paid ? t("Switch to {plan}", { plan: plan.name }) : t("Get {plan}", { plan: plan.name })}
                </Button>
              )}
            </Card>
          );
        })}
      </section>

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" aria-hidden />
          <p className="text-section-title font-semibold text-ink">{t("More AI credits")}</p>
        </div>
        <p className="text-body text-ink-secondary">{t("A one-off top-up for a busy month. One credit makes one AI picture.")}</p>
        <div className="flex flex-wrap gap-3">
          {CREDIT_PACKS.map((pack) => (
            <Button key={pack.id} variant="secondary" onClick={() => void go("/api/billing/checkout", { pack: pack.id satisfies PackId }, pack.id)} disabled={busy !== null} icon={busy === pack.id ? <Loader2 size={14} className="animate-spin" /> : undefined}>
              {t("{n} credits · {price}", { n: pack.credits, price: pack.price })}
            </Button>
          ))}
        </div>
      </Card>

      <p className="text-helper text-ink-muted">{t("Payments are handled by Stripe; we never see your card. Prices include VAT where it applies.")}</p>
    </div>
  );
}
