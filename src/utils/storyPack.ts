// The "story pack": activity pages made from a story book — questions,
// put-the-pictures-in-order cards, a word search with the story's words,
// draw your own ending, a talk-about-it page and a certificate. Every word
// printed on these pages is in the story's language, not the UI's.

import type { BookPage, PageObject, PageSpace } from "@/types/editor";
import { createFrameStamp, createPageFromTemplate, makeId, rule, shape, text } from "@/components/editor/pageTemplates";
import { wordSearchPages } from "@/components/editor/puzzles";
import { seededRandom } from "@/components/editor/worksheets";
import { geometryFromSpace } from "@/utils/pageGeometry";
import type { StoryLanguage, StoryQuestion } from "@/services/storyBook";

export type PackPart = "questions" | "order" | "words" | "ending" | "talk" | "certificate";

export const PACK_PARTS: { value: PackPart; label: string }[] = [
  { value: "questions", label: "Questions about the story" },
  { value: "order", label: "Put the pictures in order" },
  { value: "words", label: "Word search with the story's words" },
  { value: "ending", label: "Draw your own ending" },
  { value: "talk", label: "Let's talk about it" },
  { value: "certificate", label: "Certificate" },
];

type Label = "questions" | "circle" | "order" | "orderHow" | "answers" | "words" | "wordsAnswers" | "ending" | "endingWrite" | "talk" | "moral" | "certificate" | "certifies" | "finished" | "date";

const LABELS: Record<StoryLanguage, Record<Label, string>> = {
  el: {
    questions: "Ερωτήσεις", circle: "Κύκλωσε τη σωστή απάντηση.", order: "Βάλε τη σειρά", orderHow: "Γράψε στο κουτάκι με ποια σειρά έγιναν: 1, 2, 3…", answers: "Απαντήσεις",
    words: "Κρυπτόλεξο", wordsAnswers: "Κρυπτόλεξο — λύσεις", ending: "Ζωγράφισε το δικό σου τέλος", endingWrite: "Γράψε τι έγινε στο τέλος:", talk: "Ας το συζητήσουμε", moral: "Το μήνυμα της ιστορίας",
    certificate: "Δίπλωμα", certifies: "Το δίπλωμα αυτό απονέμεται στον/στην", finished: "που τελείωσε την ιστορία", date: "Ημερομηνία",
  },
  en: {
    questions: "Questions", circle: "Circle the right answer.", order: "Put it in order", orderHow: "Write in each box the order they happened: 1, 2, 3…", answers: "Answers",
    words: "Word search", wordsAnswers: "Word search — answers", ending: "Draw your own ending", endingWrite: "Write what happened at the end:", talk: "Let's talk about it", moral: "The message of the story",
    certificate: "Certificate", certifies: "This certifies that", finished: "finished the story", date: "Date",
  },
  de: {
    questions: "Fragen", circle: "Kreise die richtige Antwort ein.", order: "Bring es in die richtige Reihenfolge", orderHow: "Schreib in jedes Kästchen, in welcher Reihenfolge es passiert ist: 1, 2, 3…", answers: "Lösungen",
    words: "Suchsel", wordsAnswers: "Suchsel — Lösungen", ending: "Mal dein eigenes Ende", endingWrite: "Schreib, was am Ende passiert ist:", talk: "Lass uns darüber sprechen", moral: "Die Botschaft der Geschichte",
    certificate: "Urkunde", certifies: "Diese Urkunde erhält", finished: "für die fertige Geschichte", date: "Datum",
  },
  fr: {
    questions: "Questions", circle: "Entoure la bonne réponse.", order: "Remets dans l'ordre", orderHow: "Écris dans chaque case l'ordre de l'histoire : 1, 2, 3…", answers: "Réponses",
    words: "Mots mêlés", wordsAnswers: "Mots mêlés — solutions", ending: "Dessine ta propre fin", endingWrite: "Écris ce qui s'est passé à la fin :", talk: "Parlons-en", moral: "Le message de l'histoire",
    certificate: "Diplôme", certifies: "Ce diplôme est remis à", finished: "qui a terminé l'histoire", date: "Date",
  },
  es: {
    questions: "Preguntas", circle: "Rodea la respuesta correcta.", order: "Ponlo en orden", orderHow: "Escribe en cada casilla el orden en que pasó: 1, 2, 3…", answers: "Respuestas",
    words: "Sopa de letras", wordsAnswers: "Sopa de letras — soluciones", ending: "Dibuja tu propio final", endingWrite: "Escribe qué pasó al final:", talk: "Hablemos de ello", moral: "El mensaje del cuento",
    certificate: "Diploma", certifies: "Este diploma se otorga a", finished: "por terminar el cuento", date: "Fecha",
  },
  it: {
    questions: "Domande", circle: "Cerchia la risposta giusta.", order: "Metti in ordine", orderHow: "Scrivi in ogni casella l'ordine in cui è successo: 1, 2, 3…", answers: "Risposte",
    words: "Crucipuzzle", wordsAnswers: "Crucipuzzle — soluzioni", ending: "Disegna il tuo finale", endingWrite: "Scrivi cosa è successo alla fine:", talk: "Parliamone", moral: "Il messaggio della storia",
    certificate: "Diploma", certifies: "Questo diploma è assegnato a", finished: "che ha finito la storia", date: "Data",
  },
};

export function packLabel(lang: StoryLanguage, key: Label): string {
  return LABELS[lang]?.[key] ?? LABELS.en[key];
}

const PLAIN = "Arial, Helvetica, sans-serif";

function blankPage(space: PageSpace, objects: PageObject[]): BookPage {
  return { id: makeId("page"), pageNumber: 0, space, lines: [], objects };
}

function title(textValue: string, x: number, y: number, width: number): PageObject {
  return text({ text: textValue, x, y, width, fontSize: 40, outline: true });
}

/** Multiple-choice questions, the choices as circles to mark; the answers small at the bottom for the grown-up. */
export function questionsPage(space: PageSpace, questions: StoryQuestion[], lang: StoryLanguage): BookPage | null {
  if (questions.length === 0) return null;
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const objects: PageObject[] = [title(packLabel(lang, "questions"), safe.left, safe.top, width), text({ text: packLabel(lang, "circle"), x: safe.left, y: safe.top + 66, width, fontSize: 18, fontFamily: PLAIN })];
  const top = safe.top + 110;
  const bottom = safe.bottom - 40;
  const step = (bottom - top) / questions.length;
  questions.forEach((q, i) => {
    const y = top + i * step;
    objects.push(text({ text: `${i + 1}. ${q.question}`, x: safe.left, y, width, height: 52, fontSize: 21, align: "left", fontFamily: PLAIN }));
    const colW = width / q.choices.length;
    q.choices.forEach((choice, c) => {
      const cx = safe.left + c * colW;
      objects.push(shape({ shapeKind: "circle", x: cx + 6, y: y + 60, width: 22, height: 22, fill: "#ffffff", strokeWidth: 2.5 }));
      objects.push(text({ text: choice, x: cx + 36, y: y + 60, width: colW - 44, height: 44, fontSize: 18, align: "left", fontFamily: PLAIN }));
    });
  });
  const key = questions.map((q, i) => `${i + 1}. ${q.choices[q.answer]}`).join(" · ");
  objects.push(text({ text: `${packLabel(lang, "answers")}: ${key}`, x: safe.left, y: safe.bottom - 22, width, height: 18, fontSize: 11, align: "left", fill: "#9ca3af", fontFamily: PLAIN }));
  return blankPage(space, objects);
}

/**
 * Up to six of the story's pictures in a shuffled grid, each with a box
 * for its number in the story; the right order small at the bottom.
 * `pictures` are in story order.
 */
export function orderPage(space: PageSpace, pictures: { src: string; width: number; height: number }[], lang: StoryLanguage, seed: number): BookPage | null {
  if (pictures.length < 3) return null;
  // Spread the picks across the whole story: beginning, middle and end.
  const count = Math.min(6, pictures.length);
  const picks = Array.from({ length: count }, (_, i) => Math.round((i * (pictures.length - 1)) / (count - 1)));
  const rand = seededRandom(seed);
  // Fisher–Yates; the first card never shows the story's first scene (too easy a start).
  const shuffled = picks.map((storyIndex, order) => ({ storyIndex, order }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled[0].order === 0) shuffled.push(shuffled.shift()!);

  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const objects: PageObject[] = [title(packLabel(lang, "order"), safe.left, safe.top, width), text({ text: packLabel(lang, "orderHow"), x: safe.left, y: safe.top + 66, width, fontSize: 17, fontFamily: PLAIN })];
  const cols = 2;
  const rows = Math.ceil(count / cols);
  const top = safe.top + 110;
  const gap = 18;
  const cellW = (width - gap) / cols;
  const cellH = (safe.bottom - 40 - top - gap * (rows - 1)) / rows;
  shuffled.forEach((s, i) => {
    const x = safe.left + (i % cols) * (cellW + gap);
    const y = top + Math.floor(i / cols) * (cellH + gap);
    const pic = pictures[s.storyIndex];
    objects.push(shape({ shapeKind: "rectangle", x, y, width: cellW, height: cellH, fill: "#ffffff", strokeWidth: 2 }));
    const room = { w: cellW - 20, h: cellH - 56 };
    const k = Math.min(room.w / pic.width, room.h / pic.height);
    objects.push({ kind: "stamp", id: makeId("stamp"), src: pic.src, x: x + (cellW - pic.width * k) / 2, y: y + 10, width: pic.width * k, height: pic.height * k, rotation: 0, scaleX: 1, scaleY: 1, filter: "none" });
    objects.push(shape({ shapeKind: "rectangle", x: x + cellW / 2 - 18, y: y + cellH - 42, width: 36, height: 36, fill: "#ffffff", strokeWidth: 2.5 }));
  });
  const key = shuffled.map((s) => s.order + 1).join(" · ");
  objects.push(text({ text: `${packLabel(lang, "answers")}: ${key}`, x: safe.left, y: safe.bottom - 22, width, height: 18, fontSize: 11, align: "left", fill: "#9ca3af", fontFamily: PLAIN }));
  return blankPage(space, objects);
}

/** A big framed space to draw an ending, and lines to write it. */
export function endingPage(space: PageSpace, lang: StoryLanguage): BookPage {
  const geo = geometryFromSpace(space);
  const { safe } = geo;
  const width = safe.right - safe.left;
  const frame = createFrameStamp("stars", geo);
  const inner = { left: safe.left + 30, right: safe.right - 30 };
  const innerW = inner.right - inner.left;
  const top = safe.top + 40;
  const drawH = (safe.bottom - top) * 0.62;
  const objects: PageObject[] = [
    ...(frame ? [frame] : []),
    title(packLabel(lang, "ending"), safe.left, top, width),
    shape({ shapeKind: "rectangle", x: inner.left, y: top + 70, width: innerW, height: drawH, fill: "#ffffff", strokeWidth: 2.5 }),
    text({ text: packLabel(lang, "endingWrite"), x: inner.left, y: top + 90 + drawH, width: innerW, fontSize: 18, align: "left", fontFamily: PLAIN }),
  ];
  const linesTop = top + 150 + drawH;
  const gap = 38;
  for (let y = linesTop; y < safe.bottom - 40; y += gap) objects.push(rule(inner.left, y, innerW));
  return blankPage(space, objects);
}

/** The story's message and a few open questions, each with lines for an answer. */
export function talkPage(space: PageSpace, moral: string, discussion: string[], lang: StoryLanguage): BookPage | null {
  if (!moral && discussion.length === 0) return null;
  const { safe } = geometryFromSpace(space);
  const width = safe.right - safe.left;
  const objects: PageObject[] = [title(packLabel(lang, "talk"), safe.left, safe.top, width)];
  let y = safe.top + 80;
  if (moral) {
    objects.push(shape({ shapeKind: "rectangle", x: safe.left, y, width, height: 96, fill: "#ffffff", strokeWidth: 2 }));
    objects.push(text({ text: packLabel(lang, "moral"), x: safe.left + 16, y: y + 12, width: width - 32, fontSize: 15, align: "left", fontFamily: PLAIN, fill: "#6b7280" }));
    objects.push(text({ text: moral, x: safe.left + 16, y: y + 36, width: width - 32, height: 52, fontSize: 21, align: "left" }));
    y += 126;
  }
  const step = discussion.length ? (safe.bottom - y) / discussion.length : 0;
  discussion.forEach((q, i) => {
    const qy = y + i * step;
    objects.push(text({ text: `${i + 1}. ${q}`, x: safe.left, y: qy, width, height: 50, fontSize: 20, align: "left", fontFamily: PLAIN }));
    for (let ly = qy + 76; ly < qy + step - 8; ly += 36) objects.push(rule(safe.left, ly, width));
  });
  return blankPage(space, objects);
}

/** Every pack page asked for, in order, ready to append after the story pages. */
export function buildStoryPack(
  space: PageSpace,
  story: { title: string; questions: StoryQuestion[]; words: string[]; moral: string; discussion: string[] },
  pictures: { src: string; width: number; height: number }[],
  parts: PackPart[],
  lang: StoryLanguage,
  seed = Date.now()
): BookPage[] {
  const want = new Set(parts);
  const tx = (key: string) => ({ "Word search": packLabel(lang, "words"), "Word search — answers": packLabel(lang, "wordsAnswers"), Certificate: packLabel(lang, "certificate"), "This certifies that": packLabel(lang, "certifies"), "colored every page of this book!": `${packLabel(lang, "finished")} «${story.title}»`, Date: packLabel(lang, "date") })[key] ?? key;
  const pages: (BookPage | null)[] = [];
  if (want.has("questions")) pages.push(questionsPage(space, story.questions, lang));
  if (want.has("order")) pages.push(orderPage(space, pictures, lang, seed));
  if (want.has("words")) {
    const search = wordSearchPages(space, story.words, seed, tx);
    if (search) pages.push(search.puzzle, search.answers);
  }
  if (want.has("ending")) pages.push(endingPage(space, lang));
  if (want.has("talk")) pages.push(talkPage(space, story.moral, story.discussion, lang));
  if (want.has("certificate")) pages.push(createPageFromTemplate(0, space, "certificate", tx));
  return pages.filter((p): p is BookPage => p !== null);
}
