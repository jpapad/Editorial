// Mirrors the Supabase Postgres schema — see the SQL in the approved plan
// (a single `books` table; `pages` holds the whole BookPage[] array as
// jsonb, matching how utils/storage.ts already reads/writes a book as one
// atomic unit in memory). Regenerate via `supabase gen types typescript`
// if the schema changes.

import type { BookPage } from "@/types/editor";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// `type`, not `interface`: supabase-js/postgrest-js's generics check
// `Database["public"]["Tables"][...] extends Record<string, unknown>` (and
// similar Record-shaped constraints) to resolve query/insert/update types.
// A plain `interface` never satisfies an `extends Record<string, X>` check
// in a conditional type (interfaces support declaration merging, so TS
// won't treat them as sealed the way an object type literal is) — silently
// resolving the whole schema to `never` with no error at the actual cause.
// Found by testing this exact `extends` check in isolation, not by
// inspection. `type` aliases don't have this problem.
export type BookRow = {
  id: string;
  user_id: string;
  title: string;
  pages: BookPage[];
  status: "draft" | "published";
  collection: string | null;
  trim_size: string | null;
  created_at: string;
  updated_at: string;
};

/** supabase/migrations/20260928130000_page_comments.sql */
export type PageCommentRow = {
  id: string;
  book_id: string;
  page_id: string;
  author_id: string;
  author_email: string;
  body: string;
  resolved: boolean;
  created_at: string;
};

/** One row of `admin_list_users()` — admin-only, see the admin_role migration. */
export type AdminUserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
  book_count: number;
};

export type Database = {
  public: {
    Tables: {
      books: {
        Row: BookRow;
        Insert: Omit<BookRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BookRow, "id" | "user_id">>;
        Relationships: [];
      };
      page_comments: {
        Row: PageCommentRow;
        // author_id/author_email/resolved/created_at are set by a trigger.
        Insert: Pick<PageCommentRow, "book_id" | "page_id" | "body"> & Partial<Pick<PageCommentRow, "author_id" | "author_email">>;
        Update: Pick<PageCommentRow, "resolved">;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    // supabase/migrations/20260928120000_admin_role.sql
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      admin_list_users: { Args: Record<string, never>; Returns: AdminUserRow[] };
      admin_set_supervisor: { Args: { target_user: string; make_supervisor: boolean }; Returns: undefined };
    };
  };
};
