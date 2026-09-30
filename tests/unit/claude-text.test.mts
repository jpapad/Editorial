// Claude wiring without a real key: a local stand-in for the Anthropic API
// (ANTHROPIC_BASE_URL) records what the SDK sends and replies with canned messages.
import http from "node:http";
import type { AddressInfo } from "node:net";

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

type Reply = { status: number; body: unknown };
let next: Reply = { status: 200, body: {} };
const seen: { headers: http.IncomingHttpHeaders; body: Record<string, unknown> }[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    seen.push({ headers: req.headers, body: JSON.parse(raw || "{}") });
    res.writeHead(next.status, { "content-type": "application/json" });
    res.end(JSON.stringify(next.body));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
process.env.ANTHROPIC_API_KEY = "test-key";
delete process.env.ANTHROPIC_MODEL;

const { claudePlanBook, claudeEditorCommand } = await import("../../src/services/claudeText");
const { textProvider } = await import("../../src/services/textAi");

const message = (text: string, stop_reason = "end_turn") => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason, stop_sequence: null,
  content: text ? [{ type: "text", text }] : [], usage: { input_tokens: 10, output_tokens: 10 },
});

// Book plan
next = { status: 200, body: message(JSON.stringify({ title: "Ζώα της φάρμας", ageGroup: "3-5", theme: "bold outlines", captions: true, pages: [{ label: "Αγελάδα", subject: "a cow" }] })) };
const plan = await claudePlanBook("ζώα της φάρμας για 4χρονα", "el");
const req = seen.at(-1)!;
ok(plan.title === "Ζώα της φάρμας" && plan.pages[0].subject === "a cow", "plan parsed from Claude's JSON reply");
ok(req.body.model === "claude-opus-5-5", "uses Claude Opus 5.5 by default");
const oc = req.body.output_config as { effort: string; format: { type: string; schema: { required: string[] } } };
ok(oc.format.type === "json_schema" && oc.format.schema.required.includes("pages") && oc.effort === "medium", "structured output schema + medium effort for planning");
ok(req.body.fallbacks === "default" && String(req.headers["anthropic-beta"]).includes("server-side-fallback-2026-07-01"), "server-side fallback on, with its beta header");
ok(req.headers["x-api-key"] === "test-key" && String(req.body.messages && JSON.stringify(req.body.messages)).includes("ζώα της φάρμας"), "sends the key and the request text");

// Editor command: bogus ids/actions are still filtered after Claude
next = { status: 200, body: message(JSON.stringify({ reply: "Έγινε.", actions: [{ type: "scale", ids: ["s1", "ghost"], factor: 2 }, { type: "delete", ids: ["ghost"] }] })) };
const cmd = await claudeEditorCommand("μεγάλωσέ το", { objects: [{ id: "s1", kind: "shape", what: "star", x: 0.5, y: 0.5, w: 0.2, h: 0.2 }], lines: 0, frame: null, pattern: null, selected: ["s1"] }, "el");
const creq = seen.at(-1)!;
ok(cmd.actions.length === 1 && (cmd.actions[0] as { ids: string[] }).ids.join() === "s1" && cmd.reply === "Έγινε.", "command actions re-validated against the page");
ok((creq.body.output_config as { effort: string }).effort === "low", "low effort for quick commands");

// Refusal and errors come back as plain, safe messages
next = { status: 200, body: message("", "refusal") };
const refused = await claudePlanBook("x", "en").catch((e: Error) => e.message);
ok(/declined/.test(String(refused)), `refusal → friendly message (${refused})`);
next = { status: 401, body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key sk-ant-SECRET" } } };
const denied = await claudePlanBook("x", "en").catch((e: Error) => e.message);
ok(/ANTHROPIC_API_KEY/.test(String(denied)) && !String(denied).includes("SECRET"), `bad key → hint, no provider text leaked (${denied})`);

// Provider choice
ok(textProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }) === "anthropic", "Claude preferred when both keys exist");
ok(textProvider({ OPENAI_API_KEY: "o" }) === "openai" && textProvider({}) === null, "falls back to OpenAI; none without keys");
ok(textProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", AI_TEXT_PROVIDER: "openai" }) === "openai", "AI_TEXT_PROVIDER forces a provider");

server.close();
console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
