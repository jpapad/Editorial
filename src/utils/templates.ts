import { supabase } from "@/lib/supabase/client";
import { createBook, saveBook, type StoredBook } from "@/utils/storage";
import type { BookTemplateRow } from "@/types/database";
import type { BookPage } from "@/types/editor";

export type BookTemplate = BookTemplateRow;

export function isMissingTemplatesTable(message: string): boolean {
  return /book_templates/.test(message) && /(does not exist|schema cache|Could not find)/i.test(message);
}

/** What others get: the drawing, not anyone's coloring or progress. */
function cleanPages(pages: BookPage[]): BookPage[] {
  return pages.map((p) => {
    const copy = { ...p };
    delete copy.fillDataUrl;
    delete copy.completedAt;
    return copy;
  });
}

/** Newest first. Pages are left out of the listing (they can be large); createBookFromTemplate() fetches them. */
export async function listTemplates(): Promise<Omit<BookTemplate, "pages">[]> {
  const { data, error } = await supabase
    .from("book_templates")
    .select("id, author_id, title, description, trim_size, bleed, page_count, thumbnail, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function publishTemplate(input: { title: string; description: string; trimSize?: string; bleed: boolean; pages: BookPage[] }): Promise<void> {
  const pages = cleanPages(input.pages);
  const { error } = await supabase.from("book_templates").insert({
    title: input.title.trim().slice(0, 120),
    description: input.description.trim().slice(0, 500),
    trim_size: input.trimSize ?? null,
    bleed: input.bleed,
    pages,
    page_count: pages.length,
    thumbnail: input.pages.find((p) => p.thumbnailDataUrl)?.thumbnailDataUrl ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("book_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** A new book of the signed-in user's own, copied from the template. */
export async function createBookFromTemplate(id: string): Promise<StoredBook> {
  const { data, error } = await supabase.from("book_templates").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  const book = await createBook(data.title, structuredClone(data.pages), data.trim_size ?? undefined);
  if (data.bleed) await saveBook({ ...book, bleed: true, updatedAt: new Date().toISOString() });
  return book;
}
