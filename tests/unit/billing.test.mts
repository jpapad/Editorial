import { createHmac } from "node:crypto";
import { formEncode, subscriptionRow, verifyStripeEvent } from "../../src/lib/stripe";
import { planForPrice, PLANS, CREDIT_PACKS } from "../../src/lib/plans";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };

// ---- form encoding (Stripe's nested a[b][0][c] style)
const encoded = decodeURIComponent(formEncode({ mode: "payment", line_items: [{ price: "price_1", quantity: 1 }], metadata: { user_id: "u1", credits: "100" }, skip: undefined }));
ok(encoded === "mode=payment&line_items[0][price]=price_1&line_items[0][quantity]=1&metadata[user_id]=u1&metadata[credits]=100", "nested params, arrays and undefined are encoded the way Stripe expects", encoded);
ok(formEncode({ email: "a+b@x.gr" }) === "email=a%2Bb%40x.gr", "values are URL-encoded");

// ---- webhook signature
const secret = "whsec_test";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
const now = 1_760_000_000;
const sign = (t: number, payload = body, key = secret) => createHmac("sha256", key).update(`${t}.${payload}`).digest("hex");
ok(verifyStripeEvent(body, `t=${now},v1=${sign(now)}`, secret, now).id === "evt_1", "a correctly signed event is accepted");
ok(verifyStripeEvent(body, `t=${now},v1=deadbeef,v1=${sign(now)}`, secret, now).id === "evt_1", "any one matching v1 signature is enough (secret rotation)");
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
ok(throws(() => verifyStripeEvent(body, `t=${now},v1=${sign(now, body, "whsec_other")}`, secret, now)), "a signature made with another secret is refused");
ok(throws(() => verifyStripeEvent(body.replace("cs_1", "cs_2"), `t=${now},v1=${sign(now)}`, secret, now)), "a changed body is refused");
ok(throws(() => verifyStripeEvent(body, `t=${now - 600},v1=${sign(now - 600)}`, secret, now)), "a replayed old event is refused");
ok(throws(() => verifyStripeEvent(body, null, secret, now)) && throws(() => verifyStripeEvent(body, "garbage", secret, now)), "a missing or malformed header is refused");

// ---- subscription → row
const env = { STRIPE_PRICE_PRO: "price_pro", STRIPE_PRICE_STUDIO: "price_studio" };
ok(planForPrice("price_studio", env) === "studio" && planForPrice("price_x", env) === null && planForPrice(undefined, env) === null, "plans are found by their Stripe price id");
const newer = subscriptionRow({ id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false, metadata: { plan: "pro" }, items: { data: [{ price: { id: "price_studio" }, current_period_end: 1_762_000_000 }] } }, env);
ok(newer.plan === "studio" && newer.stripe_customer_id === "cus_1" && newer.current_period_end === new Date(1_762_000_000 * 1000).toISOString(), "the price decides the plan (a change in the portal is followed); period end read from the item", JSON.stringify(newer));
const older = subscriptionRow({ id: "sub_2", status: "past_due", customer: { id: "cus_2" }, current_period_end: 1_761_000_000, cancel_at_period_end: true, metadata: { plan: "pro" }, items: { data: [{ price: { id: "price_unknown" } }] } }, env);
ok(older.plan === "pro" && older.status === "past_due" && older.cancel_at_period_end && older.stripe_customer_id === "cus_2" && older.current_period_end !== null, "older API shape: period end on the subscription, plan from metadata when the price is unknown");

// ---- plans match the SQL
ok(PLANS.map((p) => p.aiPerMonth).join() === "20,300,1500", "plan AI numbers match sql/09_billing.sql (20 / 300 / 1500)");
ok(CREDIT_PACKS.every((p) => p.credits > 0 && p.priceEnv.startsWith("STRIPE_PRICE_")), "every credit pack has a Stripe price variable");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
