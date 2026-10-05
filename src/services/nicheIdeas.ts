// Book ideas before a book exists: a few coloring-book niches around a
// topic, each with search keywords, an angle that sets it apart and a
// rough competition guess. These are the model's estimates, not sales
// data — the UI says so and links every keyword to a real Amazon search
// and Google Trends to check. Untrusted JSON: parseNicheIdeas() bounds it.

export interface NicheIdea {
  title: string;
  audience: string;
  angle: string;
  keywords: string[];
  pageIdeas: string[];
  competition: "low" | "medium" | "high";
  why: string;
}

export interface NicheRequest {
  topic: string;
  audience: string;
  /** Where it will sell: decides the keyword language. */
  market: "us" | "uk" | "de" | "gr";
  lang: "el" | "en";
}

const MARKET_LANGUAGE: Record<NicheRequest["market"], string> = { us: "English (US)", uk: "English (UK)", de: "German", gr: "Greek" };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, max: number, len: number) => [...new Set((Array.isArray(v) ? v : []).map((x) => text(x, len)).filter(Boolean))].slice(0, max);

export function parseNicheIdeas(raw: unknown): NicheIdea[] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ideas: NicheIdea[] = [];
  for (const item of Array.isArray(o.ideas) ? o.ideas : []) {
    const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const title = text(it.title, 90);
    const keywords = list(it.keywords, 7, 50);
    if (!title || keywords.length === 0) continue;
    const competition = it.competition === "low" || it.competition === "high" ? it.competition : "medium";
    ideas.push({ title, audience: text(it.audience, 60), angle: text(it.angle, 200), keywords, pageIdeas: list(it.pageIdeas, 5, 60), competition, why: text(it.why, 240) });
    if (ideas.length === 6) break;
  }
  if (ideas.length === 0) throw new Error("No ideas came back.");
  return ideas;
}

export function buildNichePrompt(req: NicheRequest): string {
  const ui = req.lang === "el" ? "Greek" : "English";
  return [
    "You help self-publishers find coloring-book niches for Amazon KDP. Suggest 5 distinct, specific book ideas around the topic.",
    `Reply with a JSON object {"ideas": [...]}; each idea has exactly these keys:`,
    `- "title": a working title in ${ui}.`,
    `- "audience": who it's for, in ${ui} (e.g. ages 4–8, adults who like mandalas, teachers).`,
    `- "angle": in ${ui}, what makes this book different from the many generic ones.`,
    `- "keywords": 7 search phrases buyers would type on Amazon, in ${MARKET_LANGUAGE[req.market]} — specific long-tail phrases, not single words.`,
    `- "pageIdeas": 3–5 example page subjects, in ${ui}.`,
    '- "competition": "low", "medium" or "high" — your rough estimate of how crowded this niche is.',
    `- "why": one sentence in ${ui} on why it could sell (season, gift, classroom use, an underserved age…).`,
    "Prefer specific, underserved niches over broad crowded ones. Nothing trademarked (no brand characters or franchises). G-rated. Reply with the JSON object only.",
    "",
    `Topic: ${JSON.stringify(req.topic)}`,
    req.audience ? `Audience hint: ${JSON.stringify(req.audience)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const NICHE_SCHEMA = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          audience: { type: "string" },
          angle: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          pageIdeas: { type: "array", items: { type: "string" } },
          competition: { type: "string", enum: ["low", "medium", "high"] },
          why: { type: "string" },
        },
        required: ["title", "audience", "angle", "keywords", "pageIdeas", "competition", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
};

const AMAZON_HOST: Record<NicheRequest["market"], string> = { us: "www.amazon.com", uk: "www.amazon.co.uk", de: "www.amazon.de", gr: "www.amazon.de" };
const TRENDS_GEO: Record<NicheRequest["market"], string> = { us: "US", uk: "GB", de: "DE", gr: "GR" };

/** Where to check a keyword for real: Amazon's book search and Google Trends. */
export function keywordLinks(keyword: string, market: NicheRequest["market"]): { amazon: string; trends: string } {
  const q = encodeURIComponent(keyword);
  return {
    amazon: `https://${AMAZON_HOST[market]}/s?k=${q}&i=stripbooks`,
    trends: `https://trends.google.com/trends/explore?q=${q}&geo=${TRENDS_GEO[market]}`,
  };
}
