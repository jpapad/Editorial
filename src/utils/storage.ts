import type { BookPage } from "@/types/editor";
import { supabase } from "@/lib/supabase/client";
import type { BookRow } from "@/types/database";
import type { CoverDesign, PaperType } from "@/types/editor";

export type BookStatus = "draft" | "published";

export interface StoredBook {
  id: string;
  title: string;
  pages: BookPage[];
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  collection?: string | null; // free-text, user-assigned (null clears it on save, undefined leaves it alone) — Library's real replacement for the old decorative "Collections" list
  trimSize?: string; // TrimSize id (see utils/trimSizes.ts) — fixed at creation, applied at export time
  ownerId?: string; // the owning user — read-only here; lets the editor spot a supervisor opening someone else's book
  bleed?: boolean; // interior prints to the edge — see utils/pageGeometry.ts
  paper?: PaperType;
  cover?: CoverDesign | null;
}

/** Plain project data — used for JSON export/import (a single book's portable file), independent of which library entry it came from or goes to. */
export interface ProjectData {
  title: string;
  pages: BookPage[];
  updatedAt: string;
}

function isBookPage(value: unknown): value is BookPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Record<string, unknown>;
  return typeof page.id === "string" && typeof page.pageNumber === "number" && Array.isArray(page.lines) && Array.isArray(page.objects);
}

function isProjectData(value: unknown): value is ProjectData {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return typeof project.title === "string" && Array.isArray(project.pages) && project.pages.every(isBookPage);
}

export function fromRow(row: BookRow): StoredBook {
  return {
    id: row.id,
    title: row.title,
    pages: row.pages,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    collection: row.collection ?? undefined,
    trimSize: row.trim_size ?? undefined,
    ownerId: row.user_id,
    bleed: row.bleed ?? false,
    paper: row.paper ?? "white",
    cover: row.cover ?? null,
  };
}

/** All of the signed-in user's books, newest-edited first. Filters on user_id explicitly: RLS alone isn't enough, because admins can read every user's books (admin_role migration) and their library must still show only their own. */
export async function listBooks(): Promise<StoredBook[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data, error } = await supabase.from("books").select("*").eq("user_id", userData.user.id).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getBook(id: string): Promise<StoredBook | null> {
  const { data, error } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

const PRINT_SETTINGS_COLUMNS = ["bleed", "paper", "cover"] as const;

/** Postgres "column does not exist" for one of the print-settings columns — the migration hasn't run yet. */
function isMissingPrintSettings(message: string): boolean {
  return PRINT_SETTINGS_COLUMNS.some((c) => message.includes(`'${c}'`) || message.includes(`"${c}"`) || message.includes(` ${c} `)) && /column|schema cache/i.test(message);
}
let printSettingsAvailable = true;

/** Someone else saved this book after we last loaded or saved it (sql/11 collaborators, or the same user in another tab). */
export class BookConflictError extends Error {
  constructor() {
    super("Someone else saved changes to this book.");
  }
}

export interface SaveOptions {
  /**
   * The updated_at this copy was loaded with (or last saved as). When set,
   * the save only goes through if the book hasn't been saved by anyone
   * else since — otherwise BookConflictError, instead of quietly
   * overwriting their work.
   */
  expectedUpdatedAt?: string | null;
}

/**
 * Used for both the initial create and every autosave. An existing book is
 * updated in place — never its owner (an editor saving a shared book must
 * not take it over); only a book that doesn't exist yet is inserted, as the
 * signed-in user's. Optional fields left undefined are left out of the
 * write entirely, so a save never clears a value the caller simply didn't
 * have (e.g. the coloring view saving a page used to reset the book's trim
 * size to null).
 */
export async function saveBook(book: StoredBook, options: SaveOptions = {}): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const row: Record<string, unknown> = {
    title: book.title,
    pages: book.pages,
    status: book.status,
    updated_at: book.updatedAt,
  };
  if (book.collection !== undefined) row.collection = book.collection ?? null;
  if (book.trimSize !== undefined) row.trim_size = book.trimSize;
  if (printSettingsAvailable) {
    if (book.bleed !== undefined) row.bleed = book.bleed;
    if (book.paper !== undefined) row.paper = book.paper;
    if (book.cover !== undefined) row.cover = book.cover;
  }

  let error = await writeBook(book.id, row, userData.user.id, options.expectedUpdatedAt ?? null);
  if (error && isMissingPrintSettings(error)) {
    // Migration not run yet: keep saving everything else.
    printSettingsAvailable = false;
    for (const c of PRINT_SETTINGS_COLUMNS) delete row[c];
    error = await writeBook(book.id, row, userData.user.id, options.expectedUpdatedAt ?? null);
  }
  if (error) throw new Error(error);
}

/** Update if it's there (and unchanged since `expected`), insert if it's new. Returns an error message, or null. */
async function writeBook(id: string, row: Record<string, unknown>, me: string, expected: string | null): Promise<string | null> {
  let update = supabase.from("books").update(row as never).eq("id", id);
  if (expected) update = update.eq("updated_at", expected);
  const { data, error } = await update.select("id");
  if (error) return error.message;
  if (data && data.length > 0) return null;

  // Nothing updated: a brand-new book, a newer save by someone else, or a book we may only read.
  if (expected) {
    const { data: existing } = await supabase.from("books").select("id").eq("id", id).maybeSingle();
    if (existing) throw new BookConflictError();
  }
  const { error: insertError } = await supabase.from("books").insert({ ...row, id, user_id: me } as never);
  if (!insertError) return null;
  return /duplicate key|already exists|23505/.test(insertError.message) ? "You can look at this book, but not change it." : insertError.message;
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createBook(title: string, pages: BookPage[], trimSize?: string): Promise<StoredBook> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("books")
    .insert({ user_id: userData.user.id, title, pages, status: "draft", trim_size: trimSize ?? null, collection: null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data);
}

/** Clones a book as a new, independent draft — a deep copy (structuredClone), so editing the copy's pages never touches the original's. */
export async function duplicateBook(book: StoredBook): Promise<StoredBook> {
  const copy = await createBook(`${book.title} copy`, structuredClone(book.pages), book.trimSize);
  if (!book.collection) return copy;
  await saveBook({ ...copy, collection: book.collection });
  return { ...copy, collection: book.collection };
}

export function downloadProjectAsJson(project: ProjectData, fileName = "coloring-book-project.json") {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function readProjectFromFile(file: File): Promise<ProjectData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isProjectData(parsed)) {
          reject(new Error("That file doesn't look like a coloring book project."));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error("That file isn't valid JSON."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
