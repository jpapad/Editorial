import type { WizardLetterContent } from "@/types/kdpBook";
import { FISH_SVG, OCTOPUS_SVG, STARFISH_SVG } from "@/lib/oceanArtAssets";

/**
 * The BookWizard's plug point for real content generation. `getLetterContent`
 * returning `null` for a character means "no curated content" — the wizard
 * renders an honest, clearly-labeled placeholder rather than reusing
 * unrelated art or inventing a word. A production system would implement
 * this interface against a real illustration pipeline and/or an LLM word-
 * association call; this module ships one seed provider (Ocean, matching
 * the reference book this whole editor is modeled on) so the wizard has
 * something real to demonstrate end-to-end.
 */
export interface ContentProvider {
  id: string;
  label: string;
  /** Lowercased topic strings this provider has curated content for. */
  topics: string[];
  getLetterContent(topic: string, character: string): WizardLetterContent | null;
}

const OCEAN_VOCAB: Record<string, string> = {
  A: "Anemone", B: "Blowfish", C: "Crab", D: "Dolphin", E: "Eel", F: "Fish",
  G: "Grouper", H: "Hermit Crab", I: "Isopod", J: "Jellyfish", K: "Krill",
  L: "Lobster", M: "Manatee", N: "Narwhal", O: "Octopus", P: "Puffer",
  Q: "Queen Angelfish", R: "Ray", S: "Starfish", T: "Turtle", U: "Urchin",
  V: "Viperfish", W: "Walrus", X: "X-ray Tetra", Y: "Yellowtail", Z: "Zebra Shark",
};

// Real, hand-matched art only exists for these three letters (see
// oceanArtAssets.ts) — every other letter is an honest placeholder.
const OCEAN_ART: Partial<Record<string, string>> = { O: OCTOPUS_SVG, F: FISH_SVG, S: STARFISH_SVG };

export const oceanContentProvider: ContentProvider = {
  id: "ocean",
  label: "Ocean (seed data — 26 real words, 3 matching illustrations)",
  topics: ["ocean", "the ocean", "sea", "sea life", "sea creatures"],
  getLetterContent(_topic, character) {
    const upper = character.toUpperCase();
    const word = OCEAN_VOCAB[upper];
    if (!word) return null;
    return { character, vocabWord: word, svgMarkup: OCEAN_ART[upper] ?? null };
  },
};

const KNOWN_PROVIDERS: ContentProvider[] = [oceanContentProvider];

function genericPlaceholderProvider(topic: string): ContentProvider {
  return {
    id: "placeholder",
    label: `No curated content for "${topic}" — generic placeholder`,
    topics: [topic.toLowerCase()],
    getLetterContent(_topic, character) {
      return { character, vocabWord: `${character}-word`, svgMarkup: null };
    },
  };
}

export function resolveContentProvider(topic: string): ContentProvider {
  const normalized = topic.trim().toLowerCase();
  return KNOWN_PROVIDERS.find((p) => p.topics.includes(normalized)) ?? genericPlaceholderProvider(topic);
}
