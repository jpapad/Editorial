// Plans & credits: usage, plan cards, checkout and portal hand-offs to Stripe (mocked).
import { BASE, launch, newPage, check, shot, noPageErrors } from "./harness.mjs";
import { mockSupabase } from "./mockSupabase.mjs";

const b = await launch();
const p = await newPage(b, { viewport: { width: 1280, height: 1000 } });
const db = await mockSupabase(p);
db.usage = { used: 14, limit: 20, extra: 35, plan: "free" };
const calls = [];
await p.route(`${BASE}/api/billing/**`, async (route) => {
  calls.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: `${BASE}/studio/billing?stripe=1` }) });
});

await p.goto(`${BASE}/studio`);
await p.waitForTimeout(2500);
const badge = p.locator('a[href="/studio/billing"]');
check((await badge.count()) === 1 && /\+35/.test(await badge.textContent()), "the library's credit badge shows bought credits and links to Plans & credits");
await badge.click();
await p.waitForURL(/\/studio\/billing/);
await p.waitForTimeout(1500);
check((await p.getByTestId("current-plan").textContent()) === "Free", "current plan: Free");
check((await p.getByTestId("ai-left").textContent()) === "6 of 20 left" && (await p.getByTestId("extra-credits").textContent()) === "35", "6 of 20 left this month, 35 bought credits");
check((await p.getByRole("button", { name: "Manage subscription" }).count()) === 0, "no 'Manage subscription' before there's a Stripe customer");
await p.screenshot({ path: shot("billing.png"), fullPage: true });

await p.getByRole("button", { name: "Get Pro" }).click();
await p.waitForURL(/stripe=1/);
check(calls[0]?.path === "/api/billing/checkout" && calls[0].body.plan === "pro", "Get Pro starts a checkout for the Pro plan", JSON.stringify(calls[0]));
await p.waitForTimeout(1200);
await p.getByRole("button", { name: /100 credits/ }).click();
await p.waitForTimeout(800);
check(calls[1]?.body.pack === "credits-100", "a credit pack starts a one-off checkout");

// A Pro subscriber: renew date, portal instead of checkout.
db.usage = { used: 2, limit: 300, extra: 0, plan: "pro" };
db.subscription = { user_id: "x", plan: "pro", status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", current_period_end: "2026-11-05T00:00:00Z", cancel_at_period_end: false, updated_at: "2026-10-05T00:00:00Z" };
await p.goto(`${BASE}/studio/billing`);
await p.waitForTimeout(2000);
check((await p.getByTestId("current-plan").textContent()) === "Pro" && (await p.getByText(/Renews on/).count()) === 1, "a Pro subscriber sees the plan and its renewal date");
calls.length = 0;
await p.getByRole("button", { name: "Switch to Studio" }).click();
await p.waitForTimeout(800);
check(calls[0]?.path === "/api/billing/portal", "changing plan goes through Stripe's portal (no second subscription)");

// The real route answers 503 until Stripe keys are set.
const res = (await fetch(`${BASE}/api/billing/webhook`, { method: "POST", body: "{}" })).status;
check(res === 503 || res === 400, "the webhook refuses unsigned requests", String(res));
noPageErrors(p);
await b.close();
