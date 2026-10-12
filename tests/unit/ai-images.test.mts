// Picture provider choice and what the OpenAI image request carries, without
// a real key: global fetch is replaced and records each request.
let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };

delete process.env.OPENAI_IMAGE_MODEL;
delete process.env.OPENAI_IMAGE_QUALITY;
delete process.env.AI_IMAGE_PROVIDER;
delete process.env.FAL_KEY;
process.env.OPENAI_API_KEY = "test-key";

const seen: { url: string; body: Record<string, unknown> }[] = [];
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  seen.push({ url: String(url), body: typeof init?.body === "string" ? JSON.parse(init.body) : {} });
  return new Response(JSON.stringify({ data: [{ b64_json: PNG_1PX }] }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const { imageProvider, generateLineArtImage } = await import("../../src/services/aiGenerator");

ok(imageProvider({ OPENAI_API_KEY: "o", FAL_KEY: "f" }) === "openai", "OpenAI preferred when both keys exist");
ok(imageProvider({ FAL_KEY: "f" }) === "fal" && imageProvider({}) === null, "falls back to Fal; none without keys");
ok(imageProvider({ OPENAI_API_KEY: "o", FAL_KEY: "f", AI_IMAGE_PROVIDER: "fal" }) === "fal", "AI_IMAGE_PROVIDER forces a provider");
ok(imageProvider({ FAL_KEY: "f", AI_IMAGE_PROVIDER: "openai" }) === "fal", "a forced provider without its key is ignored");

const result = await generateLineArtImage({ subject: "a friendly crab", aspectRatio: "square" });
const req = seen.at(-1)!;
ok(result.provider === "openai", "only OPENAI_API_KEY set: the picture comes from OpenAI, not Fal");
ok(req.url.endsWith("/v1/images/generations"), "calls the image generation endpoint");
ok(req.body.model === "gpt-image-2.5-flare", "uses gpt-image-2.5-flare by default (gpt-image-1 shuts down 2026-10-23)");
ok(req.body.quality === "medium", "always sends a quality (medium by default)");
ok(req.body.size === "1024x1024", "square pages ask for 1024x1024");
ok(result.svgMarkup.includes(PNG_1PX), "the returned picture is wrapped for the editor");

let threw = "";
try { await generateLineArtImage({ subject: "x" }, null); } catch (e) { threw = (e as Error).message; }
ok(/OPENAI_API_KEY or FAL_KEY/.test(threw), "no image key: a clear error naming both keys");

console.log(fails ? `${fails} FAILED` : "ALL PASSED"); process.exit(fails ? 1 : 0);
