// Mirrors the Supabase Postgres schema — see the SQL in the approved plan
// (a single `books` table; `pages` holds the whole BookPage[] array as
// jsonb, matching how utils/storage.ts already reads/writes a book as one
// atomic unit in memory). Regenerate via `supabase gen types typescript`
// if the schema changes.

import type { BookPage, CoverDesign, PaperType } from "@/types/editor";

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
  // sql/03_book_print_settings.sql — absent until it runs.
  bleed?: boolean;
  paper?: PaperType;
  cover?: CoverDesign | null;
};

/** sql/04_book_shares.sql */
export type BookShareRow = {
  token: string;
  book_id: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
};

/** What get_shared_book() hands an anonymous visitor. */
export type SharedBook = {
  title: string;
  trim_size: string | null;
  bleed: boolean;
  pages: BookPage[];
};

/** sql/02_page_comments.sql */
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
  // sql/05_usage_and_templates.sql — absent until it runs.
  ai_used?: number;
  ai_limit?: number;
};

/** sql/05_usage_and_templates.sql */
export type BookTemplateRow = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  trim_size: string | null;
  bleed: boolean;
  pages: BookPage[];
  page_count: number;
  thumbnail: string | null;
  created_at: string;
};

export type AdminStats = {
  users: number;
  active_30d: number;
  books: number;
  published: number;
  pages: number;
  ai_month: number;
  exports_month: number;
  daily: { day: string; ai: number; exports: number }[];
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
      book_shares: {
        Row: BookShareRow;
        Insert: Pick<BookShareRow, "book_id">;
        Update: Pick<BookShareRow, "revoked_at">;
        Relationships: [];
      };
      book_templates: {
        Row: BookTemplateRow;
        Insert: Omit<BookTemplateRow, "id" | "author_id" | "created_at"> & { author_id?: string };
        Update: never;
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
    // sql/01_admin_role.sql
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      admin_list_users: { Args: Record<string, never>; Returns: AdminUserRow[] };
      admin_set_supervisor: { Args: { target_user: string; make_supervisor: boolean }; Returns: undefined };
      get_shared_book: { Args: { share_token: string }; Returns: SharedBook | null };
      my_ai_usage: { Args: Record<string, never>; Returns: { used: number; limit: number | null } };
      consume_ai_credit: { Args: { credit_kind: string; credit_units: number }; Returns: { allowed: boolean; used: number; limit: number | null; event_id?: number } };
      refund_ai_credit: { Args: { credit_event: number; refund_units: number | null }; Returns: undefined };
      log_export: { Args: { export_kind: string }; Returns: undefined };
      admin_set_ai_limit: { Args: { target_user: string; new_limit: number }; Returns: undefined };
      admin_stats: { Args: Record<string, never>; Returns: AdminStats };
    };
  };
};
