// Personalised books: any text can carry a name placeholder, and one
// action fills in a child's name everywhere. The original wording is kept
// on the text (`template`), so the same book can be re-made for another
// child without retyping anything.

import type { BookPage, PageObject, TextData } from "@/types/editor";

/** Written in a text where the name should go. Greek and English spellings both work. */
export const NAME_TOKENS = ["{name}", "{όνομα}", "{ονομα}"];
const TOKEN_RE = /\{(name|όνομα|ονομα)\}/giu;

const hasToken = (s: string) => TOKEN_RE.test(s) || ((TOKEN_RE.lastIndex = 0), false);

function fill(obj: PageObject, name: string): PageObject {
  if (obj.kind !== "text") return obj;
  const template = obj.template ?? (hasToken(obj.text) ? obj.text : undefined);
  TOKEN_RE.lastIndex = 0;
  if (!template) return obj;
  const text = name ? template.replace(TOKEN_RE, name) : template;
  return text === obj.text && obj.template === template ? obj : ({ ...obj, template, text } as TextData);
}

/** How many texts in the book take a name. */
export function nameSlots(pages: BookPage[]): number {
  let n = 0;
  for (const page of pages) for (const o of page.objects) if (o.kind === "text" && (o.template || hasToken(o.text))) n++;
  TOKEN_RE.lastIndex = 0;
  return n;
}

/** Fills the name into every placeholder; an empty name puts the placeholders back. */
export function applyName(pages: BookPage[], name: string): BookPage[] {
  const clean = name.trim();
  return pages.map((page) => {
    let changed = false;
    const objects = page.objects.map((o) => {
      const next = fill(o, clean);
      if (next !== o) changed = true;
      return next;
    });
    return changed ? { ...page, objects } : page;
  });
}
