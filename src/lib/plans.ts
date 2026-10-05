// Plans and AI credit packs — shared by the billing page (browser) and the
// Stripe routes (server). The monthly AI numbers must match
// sql/09_billing.sql's plan_ai_limit(). The prices shown here are labels
// only: what a customer actually pays is the Stripe Price each one points
// to (STRIPE_PRICE_* in .env.local), so keep the two in step.

export type PlanId = "free" | "pro" | "studio";
export type PackId = "credits-100" | "credits-500";

export interface Plan {
  id: PlanId;
  name: string;
  /** Shown as-is, e.g. "€9 / month". */
  price: string;
  aiPerMonth: number;
  features: string[];
  /** Env var holding the Stripe Price id (recurring). */
  priceEnv?: string;
}

export const PLANS: Plan[] = [
  { id: "free", name: "Free", price: "€0", aiPerMonth: 20, features: ["Every editor tool", "Print-ready PDF and cover", "20 AI pictures a month"] },
  { id: "pro", name: "Pro", price: "€9 / month", aiPerMonth: 300, features: ["Everything in Free", "300 AI pictures a month", "Digital download packs and listing tools"], priceEnv: "STRIPE_PRICE_PRO" },
  { id: "studio", name: "Studio", price: "€24 / month", aiPerMonth: 1500, features: ["Everything in Pro", "1,500 AI pictures a month", "For publishers with many books"], priceEnv: "STRIPE_PRICE_STUDIO" },
];

export interface CreditPack {
  id: PackId;
  credits: number;
  price: string;
  priceEnv: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "credits-100", credits: 100, price: "€5", priceEnv: "STRIPE_PRICE_CREDITS_100" },
  { id: "credits-500", credits: 500, price: "€19", priceEnv: "STRIPE_PRICE_CREDITS_500" },
];

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** Which plan a Stripe Price id stands for, given the env (server only). */
export function planForPrice(priceId: string | null | undefined, env: Record<string, string | undefined>): PlanId | null {
  if (!priceId) return null;
  return PLANS.find((p) => p.priceEnv && env[p.priceEnv] === priceId)?.id ?? null;
}
