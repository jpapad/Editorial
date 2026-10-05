// AI Line-Art Assistant — Sprint 5.
//
// Server-only (reads FAL_KEY / OPENAI_API_KEY from process.env; both
// providers are called via plain `fetch`, no SDK — this app has otherwise
// avoided pulling in dependencies it can do without, see pdfExporter.ts's
// hand-written svg-to-pdfkit types). Do NOT import this from a `"use
// client"` component — call it from a Route Handler or server action, the
// same Node-only boundary pdfExporter.ts documents.
//
// Honest limitation worth stating up front: Fal.ai and OpenAI's image
// endpoints return RASTER images (PNG), not vector paths. There is no API
// that outputs genuine SVG line art from a text prompt. This module does
// NOT pretend otherwise — `generateLineArtImage` returns a raster image
// (as a data: URI), wrapped in a minimal `<svg><image .../></svg>` shell
// only so the result is a drop-in string for the existing `svgMarkup`
// fields (SvgMainArtElement, SvgMiniItem, etc). That wrapper does not make
// it vector art: SvgNormalizer/pdfExporter's stroke-normalization has
// nothing to act on inside an `<image>`, and the preflight checker's
// THIN_STROKE rule can't see raster line weight at all. If a book needs to
// go through the same print-safety pipeline as hand-drawn SVG assets, a
// raster→vector trace step (e.g. potrace) would need to run on the
// generated PNG first — out of scope here; this module's job is prompting
// and generation only.

export interface LineArtRequest {
  /** What to draw, e.g. "a friendly jellyfish". Kept separate from theme/style so callers can log/reuse it. */
  subject: string;
  /** e.g. "ocean", "space" — folded into the prompt for stylistic consistency across a book. */
  theme?: string;
  /** Physical aspect ratio hint — most providers only accept a coarse enum, not exact inches. */
  aspectRatio?: "square" | "portrait" | "landscape";
  /** The book's recurring character, described in detail — repeated in every prompt so they look the same on each page. */
  character?: string;
}

export interface LineArtResult {
  provider: "fal" | "openai";
  /** `data:image/png;base64,...` wrapped in a minimal `<svg><image/></svg>` shell — see the module header for why this is raster, not vector. */
  svgMarkup: string;
  /** The exact prompt sent to the provider, for logging/debugging/regeneration. */
  promptUsed: string;
}

export interface RhymeRequest {
  letter: string; // e.g. "J" or "Β"
  vocabWord: string; // e.g. "Jellyfish"
  theme?: string;
}

export interface RhymeResult {
  /** Exactly two lines, no trailing punctuation guarantees beyond what the model produces. */
  lines: [string, string];
  promptUsed: string;
}

const FAL_MODEL_ENDPOINT = "https://fal.run/fal-ai/fast-sdxl"; // adjust to whatever text-to-image model your Fal.ai account has access to
const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
export const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The actual prompt-engineering: every clause here exists to push the
 * model away from its default behavior (filled color illustration) toward
 * something usable as a coloring-book page (pure outline, no shading, no
 * fill, thick clean lines that survive small print sizes).
 */
export function buildLineArtPrompt(request: LineArtRequest): string {
  const themeClause = request.theme ? ` in a ${request.theme}-themed scene` : "";
  return [
    `A simple black-and-white line art coloring book illustration of ${request.subject}${themeClause}.`,
    request.character ? `The main character is always drawn exactly like this, on every page of the book: ${request.character}. Same face, body shape, proportions, clothes and accessories — only the pose and expression may change.` : "",
    "Bold, thick, uniform black outlines only.",
    "Pure white background, no fill, no shading, no gradients, no color, no gray, no cross-hatching.",
    "Flat 2D vector-style illustration, clean closed outlines suitable for a child to color inside.",
    "No text, no watermark, no signature, no background scenery clutter — the subject only, centered.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** For a picture drawn with a reference image of the book's character (the image edit endpoint). */
export function buildReferencePrompt(request: LineArtRequest): string {
  return [
    "The attached image shows the main character of a children's coloring book.",
    `Draw a NEW coloring page with that very same character — identical face, body, proportions, clothes and accessories — in this scene: ${request.subject}.`,
    request.character ? `Character notes: ${request.character}.` : "",
    request.theme ? `Style: ${request.theme}.` : "",
    "Bold, thick, uniform black outlines only. Pure white background, no fill, no shading, no gradients, no color, no gray.",
    "Clean closed outlines a child can color inside. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * A page drawn from a reference picture of the character (OpenAI image
 * edit, gpt-image-1): the strongest way to keep a character looking the
 * same across a book. Returns the same shape as generateLineArtImage.
 */
export async function generateLineArtFromReference(request: LineArtRequest, reference: { data: Buffer; mimeType: string }): Promise<LineArtResult> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const prompt = buildReferencePrompt(request);
  const size = request.aspectRatio === "landscape" ? "1536x1024" : request.aspectRatio === "square" ? "1024x1024" : "1024x1536";
  const [w, h] = size.split("x").map(Number);
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("image", new Blob([new Uint8Array(reference.data)], { type: reference.mimeType }), "character.png");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_IMAGE_EDIT_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal });
    if (!response.ok) throw await providerError("OpenAI", "image edit", response);
    const body = (await response.json()) as OpenAiImageResponse;
    const first = body.data?.[0];
    if (!first) throw new Error("OpenAI response contained no image data");
    const dataUri = first.b64_json ? `data:image/png;base64,${first.b64_json}` : await fetchAsDataUri(first.url ?? "", controller.signal);
    return { provider: "openai", svgMarkup: wrapRasterAsSvg(dataUri, w, h), promptUsed: prompt };
  } finally {
    clearTimeout(timeout);
  }
}

function aspectRatioToFalSize(aspectRatio: LineArtRequest["aspectRatio"]): string {
  switch (aspectRatio) {
    case "portrait":
      return "portrait_4_3";
    case "landscape":
      return "landscape_4_3";
    default:
      return "square_hd";
  }
}

/**
 * A provider error safe to show a user: status + a plain hint. The raw
 * body goes to the server log only — providers echo request details back
 * (OpenAI's 401 even quotes part of the API key).
 */
export async function providerError(provider: string, what: string, response: Response): Promise<Error> {
  console.error(`[aiGenerator] ${provider} ${what} failed: HTTP ${response.status}`, await response.text().catch(() => ""));
  const hint =
    response.status === 401 || response.status === 403
      ? "the API key was rejected — check it in .env.local"
      : response.status === 429
        ? "rate limit or quota reached — try again later"
        : response.status >= 500
          ? "the provider had a problem — try again"
          : "the request was refused";
  return new Error(`${provider} ${what} failed (HTTP ${response.status}): ${hint}.`);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — see .env.local.example`);
  return value;
}

async function fetchAsDataUri(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Failed to download generated image (HTTP ${response.status})`);
  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function wrapRasterAsSvg(dataUri: string, widthPx: number, heightPx: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}"><image href="${dataUri}" x="0" y="0" width="${widthPx}" height="${heightPx}" preserveAspectRatio="xMidYMid meet" /></svg>`;
}

interface FalImageResponse {
  images?: { url: string; width?: number; height?: number }[];
}

async function generateViaFal(prompt: string, aspectRatio: LineArtRequest["aspectRatio"]): Promise<LineArtResult> {
  const apiKey = requireEnv("FAL_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FAL_MODEL_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: aspectRatioToFalSize(aspectRatio), num_images: 1 }),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError("Fal.ai", "request", response);

    const body = (await response.json()) as FalImageResponse;
    const image = body.images?.[0];
    if (!image?.url) throw new Error("Fal.ai response contained no image URL");

    const dataUri = await fetchAsDataUri(image.url, controller.signal);
    return { provider: "fal", svgMarkup: wrapRasterAsSvg(dataUri, image.width ?? 1024, image.height ?? 1024), promptUsed: prompt };
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenAiImageResponse {
  data?: { b64_json?: string; url?: string }[];
}

async function generateViaOpenAi(prompt: string, aspectRatio: LineArtRequest["aspectRatio"]): Promise<LineArtResult> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const size = aspectRatio === "portrait" ? "1024x1536" : aspectRatio === "landscape" ? "1536x1024" : "1024x1024";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size, n: 1 }),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError("OpenAI", "image request", response);

    const body = (await response.json()) as OpenAiImageResponse;
    const first = body.data?.[0];
    if (!first) throw new Error("OpenAI response contained no image data");

    const dataUri = first.b64_json ? `data:image/png;base64,${first.b64_json}` : await fetchAsDataUri(first.url ?? "", controller.signal);
    const [w, h] = size.split("x").map(Number);
    return { provider: "openai", svgMarkup: wrapRasterAsSvg(dataUri, w, h), promptUsed: prompt };
  } finally {
    clearTimeout(timeout);
  }
}

const OPENAI_IMAGE_EDIT_ENDPOINT = "https://api.openai.com/v1/images/edits";
const PHOTO_TIMEOUT_MS = 90_000; // edits of a real photo take noticeably longer than text-to-image

/** Same line-art rules as buildLineArtPrompt, but for redrawing a given photo. */
export function buildPhotoToLineArtPrompt(note?: string): string {
  return [
    "Redraw this photo as a simple black-and-white coloring book page.",
    "Keep the main subject recognizable and its pose and proportions, but simplify details into clean, closed shapes a child can color.",
    "Bold, thick, uniform black outlines only. Pure white background, no fill, no shading, no gradients, no color, no gray.",
    "Drop busy background clutter; keep only what helps the picture.",
    note ? `Note from the creator: ${note}` : "",
    "No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Photo → coloring page via OpenAI's image edit endpoint (gpt-image-1),
 * which takes a source image plus instructions. Returns a PNG data URI.
 * UNVERIFIED AGAINST THE LIVE API in this repo (no key configured) — same
 * caveat as the rest of this module.
 */
export async function photoToLineArt(photo: { data: Buffer; mimeType: string }, note?: string): Promise<{ dataUri: string; promptUsed: string }> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const prompt = buildPhotoToLineArtPrompt(note);
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("image", new Blob([new Uint8Array(photo.data)], { type: photo.mimeType }), photo.mimeType === "image/png" ? "photo.png" : "photo.jpg");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PHOTO_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_IMAGE_EDIT_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal });
    if (!response.ok) throw await providerError("OpenAI", "image edit", response);
    const body = (await response.json()) as OpenAiImageResponse;
    const first = body.data?.[0];
    if (!first) throw new Error("OpenAI response contained no image data");
    const dataUri = first.b64_json ? `data:image/png;base64,${first.b64_json}` : await fetchAsDataUri(first.url ?? "", controller.signal);
    return { dataUri, promptUsed: prompt };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generates a coloring-book-style line-art image for one subject. Picks
 * whichever provider is requested (default "fal", cheaper/faster for bulk
 * per-letter generation); throws if that provider's API key isn't set
 * rather than silently falling back, so a missing key fails loudly at the
 * call site instead of producing a confusing downstream error.
 */
export async function generateLineArtImage(request: LineArtRequest, provider: "fal" | "openai" = "fal"): Promise<LineArtResult> {
  const prompt = buildLineArtPrompt(request);
  return provider === "fal" ? generateViaFal(prompt, request.aspectRatio) : generateViaOpenAi(prompt, request.aspectRatio);
}

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Generates a two-line rhyming couplet for a letter page (e.g. "J is for
 * Jellyfish, swimming in the sea, / Floating with its friends so
 * carefree!"). Uses OpenAI's chat completions endpoint — there's no
 * equivalent text endpoint on Fal.ai, which is image-generation-only.
 */
export async function generateRhymingCouplet(request: RhymeRequest): Promise<RhymeResult> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const themeClause = request.theme ? ` The book's theme is ${request.theme}.` : "";
  const prompt = `Write a cheerful, G-rated, two-line rhyming couplet for a children's alphabet coloring book page about the letter "${request.letter}" and the word "${request.vocabWord}".${themeClause} Keep each line short enough for a young child to read aloud. Reply with exactly two lines and nothing else — no numbering, no quotes, no extra commentary.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 60,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw await providerError("OpenAI", "chat request", response);

    const body = (await response.json()) as OpenAiChatResponse;
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI response contained no message content");

    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error(`Expected a two-line couplet, got: ${JSON.stringify(content)}`);

    return { lines: [lines[0], lines[1]], promptUsed: prompt };
  } finally {
    clearTimeout(timeout);
  }
}
