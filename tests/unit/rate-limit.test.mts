import { RATE_RULES, requesterKey, resetRates, takeRate } from "../../src/lib/rateLimit";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };

resetRates();
const t0 = 1_000_000;
const max = RATE_RULES.aiImage.max;
const results = Array.from({ length: max + 1 }, (_, i) => takeRate("aiImage", "u:alice", t0 + i));
ok(results.slice(0, max).every((r) => r.ok) && !results[max].ok, `${max} requests a minute pass, the next is refused`);
const refused = results[max];
ok(!refused.ok && refused.retryAfter === 60, "the refusal says when to try again", JSON.stringify(refused));
ok(takeRate("aiImage", "u:bob", t0 + 5).ok, "another user has their own count");
ok(takeRate("aiText", "u:alice", t0 + 5).ok, "each bucket counts separately");
ok(!takeRate("aiImage", "u:alice", t0 + 59_000).ok && takeRate("aiImage", "u:alice", t0 + 60_001).ok, "the window slides: a minute later the oldest request no longer counts");

const req = (headers: Record<string, string>) => new Request("http://x/api", { headers });
ok(requesterKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), "abc") === "u:abc", "signed in: keyed by user");
ok(requesterKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })) === "ip:1.2.3.4" && requesterKey(req({ "x-real-ip": "5.6.7.8" })) === "ip:5.6.7.8" && requesterKey(req({})) === "ip:unknown", "signed out: keyed by the client's IP");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
