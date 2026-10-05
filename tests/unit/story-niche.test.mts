import { buildStoryPrompt, MAX_STORY_PAGES, parseStoryPlan, STORY_SCHEMA } from "../../src/services/storyBook";
import { buildNichePrompt, keywordLinks, NICHE_SCHEMA, parseNicheIdeas } from "../../src/services/nicheIdeas";
import { buildLineArtPrompt, buildReferencePrompt } from "../../src/services/aiGenerator";
import { storyPageFromImage, STORY_TEXT_SHARE } from "../../src/utils/imagePages";
import { interiorSpace, geometryFromSpace } from "../../src/utils/pageGeometry";
let fails = 0; const ok = (c: boolean, m: string, detail = "") => { console.log((c ? "PASS " : "FAIL ") + m + (detail && !c ? ` — ${detail}` : "")); if (!c) fails++; };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

// ---- story
const story = parseStoryPlan({
  title: "  Η Χελωνίτσα  ",
  ageGroup: "7-9",
  theme: "simple bold outlines",
  character: "a small sea turtle with a round shell and a tiny backpack",
  pages: [
    { text: "Η Λίνα ζει στην άμμο.", scene: "a small sea turtle on a sandy beach" },
    { text: "", scene: "missing text is dropped" },
    "not an object",
    ...Array.from({ length: 30 }, (_, i) => ({ text: `Σελίδα ${i}`, scene: `scene ${i}` })),
  ],
});
ok(story.title === "Η Χελωνίτσα" && story.ageGroup === "3-5", "title trimmed; unknown age falls back to 3–5");
ok(story.pages.length === MAX_STORY_PAGES && story.pages[0].text === "Η Λίνα ζει στην άμμο.", "pages without text are dropped and the story is capped", String(story.pages.length));
ok(story.character.includes("tiny backpack"), "the character description is kept");
ok(throws(() => parseStoryPlan({ pages: [] })), "a story without pages is refused");
const sp = buildStoryPrompt("μια χελώνα που θέλει να δει τη θάλασσα", "el");
ok(sp.includes("in Greek") && sp.includes('"character"') && sp.includes("happy ending"), "the story prompt asks for Greek text, a fixed character and a happy ending");
ok(JSON.stringify(STORY_SCHEMA.required) === JSON.stringify(["title", "ageGroup", "theme", "character", "pages"]), "the structured-output schema requires every field");

// ---- character in picture prompts
const plain = buildLineArtPrompt({ subject: "a turtle swimming" });
const withCharacter = buildLineArtPrompt({ subject: "a turtle swimming", character: "a turtle with a tiny backpack" });
ok(!plain.includes("main character") && withCharacter.includes("a turtle with a tiny backpack") && /Same face, body shape/.test(withCharacter), "the character is described in every prompt, and only when there is one");
ok(!/  /.test(plain), "no empty clause left behind in the prompt");
const ref = buildReferencePrompt({ subject: "the turtle meets a crab", character: "tiny backpack", theme: "bold" });
ok(ref.includes("attached image") && ref.includes("the turtle meets a crab") && ref.includes("tiny backpack") && ref.includes("Style: bold"), "the reference prompt draws the attached character into the new scene");

// ---- story page layout
const space = interiorSpace("8.5x11", false);
const geo = geometryFromSpace(space);
const page = storyPageFromImage("data:pic", { width: 1024, height: 1536 }, space, "Η Λίνα κολυμπάει με τον φίλο της τον κάβουρα και γελάνε πολύ μαζί στη ζεστή θάλασσα.");
const [pic, text] = page.objects as unknown as [{ y: number; height: number }, { kind: string; y: number; height: number; fontSize: number; text: string }];
const textTop = geo.safe.bottom - Math.round((geo.safe.bottom - geo.safe.top) * STORY_TEXT_SHARE);
ok(pic.y + pic.height <= textTop + 0.5, "the picture stays above the story text");
ok(text.kind === "text" && text.y >= textTop && text.y + text.height <= geo.safe.bottom + 0.5 && text.fontSize === 28, "the text sits in its band inside the safe area, sized to its length", JSON.stringify({ y: text.y, h: text.height, f: text.fontSize }));

// ---- niche ideas
const ideas = parseNicheIdeas({ ideas: [
  { title: "Dino ABC", audience: "4–6", angle: "letters + dinosaurs", keywords: ["dinosaur alphabet coloring book", "dinosaur alphabet coloring book", "abc dino coloring for kids"], pageIdeas: ["T-Rex for T"], competition: "extreme", why: "classroom use" },
  { title: "", keywords: ["x"] },
  { title: "No keywords", keywords: [] },
] });
ok(ideas.length === 1 && ideas[0].keywords.length === 2 && ideas[0].competition === "medium", "ideas need a title and keywords; duplicates dropped; unknown competition → medium", JSON.stringify(ideas[0]));
ok(throws(() => parseNicheIdeas({ ideas: [] })), "no usable ideas is an error");
ok(buildNichePrompt({ topic: "dinosaurs", audience: "", market: "de", lang: "el" }).includes("in German") && buildNichePrompt({ topic: "x", audience: "", market: "us", lang: "el" }).includes("trademarked"), "keywords in the market's language; no trademarked characters");
const links = keywordLinks("dinosaur coloring book", "uk");
ok(links.amazon === "https://www.amazon.co.uk/s?k=dinosaur%20coloring%20book&i=stripbooks" && links.trends.endsWith("&geo=GB"), "keyword links go to the market's Amazon book search and Google Trends");
ok((NICHE_SCHEMA.properties.ideas.items.required as string[]).includes("competition"), "the niche schema requires a competition estimate");

console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
