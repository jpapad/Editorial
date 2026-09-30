import { buildBookPlanPrompt, MAX_PLAN_PAGES, parseBookPlan } from "../../src/services/bookPlanner";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

const plan = parseBookPlan({ title: "  Ζώα   της φάρμας ", ageGroup: "3-5", theme: "bold outlines", pages: [{ label: "Αγελάδα", subject: "a cow" }, { label: "Γουρουνάκι", subject: "a piglet" }] });
ok(plan.title === "Ζώα της φάρμας" && plan.ageGroup === "3-5" && plan.pages.length === 2, "well-formed plan passes through (whitespace tidied)");
ok(plan.captions === true, "captions default on for ages 3-5");
ok(parseBookPlan({ pages: ["cat"] }).ageGroup === "6-8" && parseBookPlan({ pages: ["cat"] }).captions === false, "unknown age → 6-8, captions off");
ok(parseBookPlan({ ageGroup: "adults", pages: ["cat"] }).ageGroup === "6-8", "invalid age rejected");
ok(parseBookPlan({ pages: ["cat", "Cat", "dog"] }).pages.length === 2, "duplicate pages dropped");
ok(parseBookPlan({ pages: Array.from({ length: 40 }, (_, i) => `p${i}`) }).pages.length === MAX_PLAN_PAGES, `capped at ${MAX_PLAN_PAGES} pages`);
ok(parseBookPlan({ pages: [{ label: "x".repeat(500) }] }).pages[0].label.length === 60, "labels bounded");
ok(parseBookPlan({ pages: [{ subject: "an owl" }] }).title === "an owl", "missing title falls back to the first page");
ok(throws(() => parseBookPlan({ title: "t", pages: [] })) && throws(() => parseBookPlan("nonsense")) && throws(() => parseBookPlan(null)), "no usable pages → error");
ok(parseBookPlan({ pages: [{ label: 7, subject: {} }, "ok"] }).pages.length === 1, "non-string fields ignored");
const prompt = buildBookPlanPrompt('20 σελίδες "ζώα"', "el");
ok(prompt.includes("Greek") && prompt.includes(JSON.stringify('20 σελίδες "ζώα"')), "prompt names the language and quotes the request as data");
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
