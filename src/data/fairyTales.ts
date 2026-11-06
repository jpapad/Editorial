// The fairy-tale library: classic tales that are free to use (public
// domain), each as our own short summary — never a copied translation or
// illustration. The story is written fresh from the summary, for the
// chosen age and language (StoryBookDialog → /api/plan-story), and the
// user reads and edits it before any picture is made.

export type TaleTheme = "animals" | "friendship" | "patience" | "honesty" | "kindness" | "hard work" | "cleverness" | "pride";

export interface FairyTale {
  id: string;
  source: "Aesop";
  title: { el: string; en: string };
  /** What happens, in our own words (English, for the model). */
  summary: string;
  /** How the main character looks — the same on every page. */
  character: string;
  moral: { el: string; en: string };
  themes: TaleTheme[];
  /** The youngest age it suits. */
  minAge: 3 | 6;
}

export const TALE_THEMES: { value: TaleTheme; label: string }[] = [
  { value: "animals", label: "Animals" },
  { value: "friendship", label: "Friendship" },
  { value: "patience", label: "Patience" },
  { value: "honesty", label: "Honesty" },
  { value: "kindness", label: "Kindness" },
  { value: "hard work", label: "Hard work" },
  { value: "cleverness", label: "Cleverness" },
  { value: "pride", label: "Pride" },
];

export const FAIRY_TALES: FairyTale[] = [
  {
    id: "hare-tortoise",
    source: "Aesop",
    title: { el: "Ο λαγός και η χελώνα", en: "The Hare and the Tortoise" },
    summary: "A boastful hare laughs at a slow tortoise, who calmly challenges him to a race. The hare dashes far ahead, then lies down under a tree for a nap, sure he will win. The tortoise keeps walking, step by step, never stopping. The hare wakes up too late and sees the tortoise crossing the finish line while the other animals cheer.",
    character: "a small, kind tortoise with a round patterned shell and a gentle smile",
    moral: { el: "Σιγά σιγά και σταθερά φτάνεις μακριά.", en: "Slow and steady wins the race." },
    themes: ["animals", "patience", "pride"],
    minAge: 3,
  },
  {
    id: "lion-mouse",
    source: "Aesop",
    title: { el: "Το λιοντάρι και το ποντίκι", en: "The Lion and the Mouse" },
    summary: "A tiny mouse wakes a sleeping lion, who catches it in his paw. The mouse begs to be let go and promises to help the lion one day; the lion laughs but lets it go. Later the lion is caught in a hunter's net and roars for help. The mouse hears him, gnaws through the ropes and sets him free, and the two become friends.",
    character: "a tiny mouse with big round ears, a long thin tail and bright eyes",
    moral: { el: "Κανείς δεν είναι πολύ μικρός για να βοηθήσει.", en: "No one is too small to help." },
    themes: ["animals", "kindness", "friendship"],
    minAge: 3,
  },
  {
    id: "ant-grasshopper",
    source: "Aesop",
    title: { el: "Ο τζίτζικας και ο μέρμηγκας", en: "The Ant and the Grasshopper" },
    summary: "All summer a busy ant carries grain to her nest, while a grasshopper sings and plays and teases her for working. When winter comes and snow covers the fields, the grasshopper is cold and hungry and knocks on the ant's door. The ant shares some food, and the grasshopper learns to prepare for the days ahead.",
    character: "a cheerful grasshopper with long legs, big eyes and a little violin",
    moral: { el: "Να προετοιμάζεσαι για τις δύσκολες μέρες.", en: "Prepare today for the needs of tomorrow." },
    themes: ["animals", "hard work"],
    minAge: 3,
  },
  {
    id: "fox-grapes",
    source: "Aesop",
    title: { el: "Η αλεπού και τα σταφύλια", en: "The Fox and the Grapes" },
    summary: "A hungry fox sees juicy grapes hanging high on a vine. She jumps and jumps but cannot reach them. At last she walks away, saying the grapes were probably sour anyway.",
    character: "a slender fox with a bushy tail, pointed ears and a small neck scarf",
    moral: { el: "Είναι εύκολο να λες πως δεν θέλεις κάτι που δεν μπορείς να έχεις.", en: "It is easy to scorn what you cannot have." },
    themes: ["animals", "pride"],
    minAge: 3,
  },
  {
    id: "boy-wolf",
    source: "Aesop",
    title: { el: "Ο βοσκός που φώναζε «λύκος»", en: "The Boy Who Cried Wolf" },
    summary: "A bored shepherd boy watching sheep on a hill shouts 'Wolf!' as a joke, and the villagers run up to help, only to find no wolf. He tricks them again. Then a real wolf comes, and when the boy shouts, nobody believes him; the sheep scatter, and the boy learns that people trust those who tell the truth. Nobody gets hurt.",
    character: "a young shepherd boy with curly hair, a woolly vest and a wooden crook",
    moral: { el: "Όποιος λέει ψέματα, δεν τον πιστεύουν ούτε όταν λέει την αλήθεια.", en: "Nobody believes a liar, even when he tells the truth." },
    themes: ["honesty"],
    minAge: 6,
  },
  {
    id: "fox-crow",
    source: "Aesop",
    title: { el: "Η αλεπού και ο κόρακας", en: "The Fox and the Crow" },
    summary: "A crow sits in a tree with a piece of cheese in her beak. A clever fox below praises her shiny feathers and asks to hear her beautiful voice. The flattered crow opens her beak to sing, the cheese falls, and the fox runs off with it.",
    character: "a glossy black crow with neat feathers and a small round eye",
    moral: { el: "Μην εμπιστεύεσαι όσους σε κολακεύουν.", en: "Beware of those who flatter you." },
    themes: ["animals", "cleverness", "pride"],
    minAge: 3,
  },
  {
    id: "golden-eggs",
    source: "Aesop",
    title: { el: "Η κότα με τα χρυσά αυγά", en: "The Goose That Laid the Golden Eggs" },
    summary: "A farmer and his wife find that their goose lays one golden egg every day. They grow impatient and think there must be a lot of gold inside her, so they want all of it at once. In the end they learn that by being greedy they would lose the egg they get every day, and they decide to be thankful for what they have.",
    character: "a plump, friendly goose with a long neck and soft round wings",
    moral: { el: "Η απληστία μπορεί να σε κάνει να χάσεις ό,τι έχεις.", en: "Greed can make you lose what you have." },
    themes: ["patience"],
    minAge: 6,
  },
  {
    id: "wind-sun",
    source: "Aesop",
    title: { el: "Ο βοριάς και ο ήλιος", en: "The North Wind and the Sun" },
    summary: "The North Wind and the Sun argue about who is stronger and agree on a test: whoever makes a traveller take off his coat wins. The Wind blows harder and harder, but the traveller only wraps his coat tighter. Then the Sun shines gently and warmly, and the traveller happily takes his coat off.",
    character: "a smiling round sun with a friendly face and soft rays",
    moral: { el: "Η καλοσύνη πετυχαίνει εκεί που η βία αποτυγχάνει.", en: "Kindness succeeds where force fails." },
    themes: ["kindness"],
    minAge: 3,
  },
  {
    id: "fox-stork",
    source: "Aesop",
    title: { el: "Η αλεπού και ο πελαργός", en: "The Fox and the Stork" },
    summary: "A fox invites a stork to dinner and serves soup in a flat plate; the stork, with her long beak, cannot drink a drop, while the fox laps it all up. The stork invites the fox back and serves food in a tall narrow jar that only her beak can reach. The fox understands how it feels and both laugh and learn to share fairly.",
    character: "a tall stork with long thin legs, a long beak and a little apron",
    moral: { el: "Φέρσου στους άλλους όπως θέλεις να σου φέρονται.", en: "Treat others as you want to be treated." },
    themes: ["animals", "friendship", "kindness"],
    minAge: 3,
  },
  {
    id: "crow-pitcher",
    source: "Aesop",
    title: { el: "Το διψασμένο κοράκι", en: "The Crow and the Pitcher" },
    summary: "On a hot day a thirsty crow finds a pitcher with a little water at the bottom, too low for her beak to reach. Instead of giving up, she drops pebbles into the pitcher one by one. The water rises higher and higher until she can drink.",
    character: "a clever black crow with bright eyes and tidy feathers",
    moral: { el: "Με υπομονή και εξυπνάδα λύνεις τα προβλήματα.", en: "Patience and cleverness solve problems." },
    themes: ["animals", "cleverness", "patience"],
    minAge: 3,
  },
];

export const AGE_OPTIONS = [
  { value: "3-5", label: "Ages 3–5", request: "for children aged 3 to 5: one very short, simple sentence per page" },
  { value: "6-8", label: "Ages 6–8", request: "for children aged 6 to 8: one or two simple sentences per page" },
  { value: "9+", label: "Ages 9+ / adults", request: "for children aged 9 and up: two richer sentences per page" },
] as const;
export type StoryAge = (typeof AGE_OPTIONS)[number]["value"];

/** What is sent to the story writer for a library tale: retell it, in our own words, for this age. */
export function taleRequest(tale: FairyTale, age: StoryAge, pages: number): string {
  const level = AGE_OPTIONS.find((a) => a.value === age)?.request ?? AGE_OPTIONS[0].request;
  return [
    `Retell the classic Aesop fable "${tale.title.en}" in your own fresh words, ${level}, in ${pages} pages.`,
    `What happens: ${tale.summary}`,
    `Main character: ${tale.character}.`,
    `Its message: ${tale.moral.en}`,
    "Keep the events and their order; end gently and happily.",
  ].join("\n");
}
