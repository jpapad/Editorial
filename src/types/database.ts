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
      // sql/06_user_library.sql
      user_stamps: {
        Row: UserStampRow;
        Insert: Omit<UserStampRow, "user_id" | "created_at"> & { user_id?: string };
        Update: Partial<Omit<UserStampRow, "user_id" | "id">>;
        Relationships: [];
      };
      // sql/09_billing.sql — written only by the Stripe webhook (service role).
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow> & { user_id: string };
        Update: Partial<SubscriptionRow>;
        Relationships: [];
      };
      credit_purchases: {
        Row: CreditPurchaseRow;
        Insert: Omit<CreditPurchaseRow, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
      // sql/11_book_members.sql
      book_members: {
        Row: BookMemberRow;
        Insert: never;
        Update: Pick<BookMemberRow, "role">;
        Relationships: [];
      };
      book_invites: {
        Row: BookInviteRow;
        Insert: Pick<BookInviteRow, "book_id" | "role">;
        Update: Pick<BookInviteRow, "revoked_at">;
        Relationships: [];
      };
      // sql/10_kid_groups.sql
      kid_groups: {
        Row: KidGroupRow;
        Insert: Pick<KidGroupRow, "name"> & Partial<Pick<KidGroupRow, "kind">>;
        Update: Partial<Pick<KidGroupRow, "name" | "kind" | "code">>;
        Relationships: [];
      };
      kid_members: {
        Row: KidMemberRow;
        Insert: Pick<KidMemberRow, "group_id" | "name"> & Partial<Pick<KidMemberRow, "avatar">>;
        Update: Partial<Pick<KidMemberRow, "name" | "avatar" | "pin" | "token">>;
        Relationships: [];
      };
      kid_group_books: {
        Row: { group_id: string; book_id: string; assigned_at: string };
        Insert: { group_id: string; book_id: string };
        Update: never;
        Relationships: [];
      };
      kid_work: {
        Row: KidWorkRow;
        Insert: never;
        Update: Partial<Pick<KidWorkRow, "sticker" | "comment">>;
        Relationships: [];
      };
      // sql/08_user_media.sql
      user_media: {
        Row: UserMediaRow;
        Insert: Omit<UserMediaRow, "id" | "user_id" | "created_at"> & { user_id?: string };
        Update: Partial<Pick<UserMediaRow, "name">>;
        Relationships: [];
      };
      book_versions: {
        Row: BookVersionRow;
        Insert: Omit<BookVersionRow, "user_id"> & { user_id?: string };
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
      my_ai_usage: { Args: Record<string, never>; Returns: { used: number; limit: number | null; extra?: number; plan?: string } };
      consume_ai_credit: { Args: { credit_kind: string; credit_units: number }; Returns: { allowed: boolean; used: number; limit: number | null; extra?: number; event_id?: number } };
      refund_ai_credit: { Args: { credit_event: number; refund_units: number | null }; Returns: undefined };
      log_export: { Args: { export_kind: string }; Returns: undefined };
      admin_set_ai_limit: { Args: { target_user: string; new_limit: number }; Returns: undefined };
      admin_stats: { Args: Record<string, never>; Returns: AdminStats };
      // sql/11_book_members.sql
      book_role: { Args: { target: string }; Returns: "owner" | "editor" | "viewer" | null };
      accept_book_invite: { Args: { invite: string }; Returns: string | null };
      books_shared_with_me: { Args: Record<string, never>; Returns: { book: BookRow; role: "editor" | "viewer" }[] };
      // sql/10_kid_groups.sql — the child side (anon), by group code / device token.
      kid_group_lookup: { Args: { group_code: string }; Returns: Json };
      kid_login: { Args: { group_code: string; member: string; picture_pin: number[] }; Returns: string | null };
      kid_home: { Args: { kid_token: string }; Returns: Json };
      kid_book: { Args: { kid_token: string; book: string }; Returns: Json };
      kid_save: { Args: { kid_token: string; book: string; page: string; page_fill: string | null; page_thumb: string | null; done: boolean }; Returns: boolean };
    };
  };
};

export type BookMemberRow = {
  book_id: string;
  user_id: string;
  role: "editor" | "viewer";
  email: string | null;
  added_at: string;
};

export type BookInviteRow = {
  token: string;
  book_id: string;
  role: "editor" | "viewer";
  created_by: string;
  created_at: string;
  revoked_at: string | null;
};

export type KidGroupRow = {
  id: string;
  owner_id: string;
  kind: "class" | "family";
  name: string;
  code: string;
  created_at: string;
};

export type KidMemberRow = {
  id: string;
  group_id: string;
  name: string;
  avatar: number;
  pin: number[];
  token: string;
  created_at: string;
};

export type KidWorkRow = {
  member_id: string;
  book_id: string;
  page_id: string;
  fill: string | null;
  thumb: string | null;
  completed_at: string | null;
  updated_at: string;
  sticker: number | null;
  comment: string | null;
};

export type SubscriptionRow = {
  user_id: string;
  plan: "free" | "pro" | "studio";
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
};

export type CreditPurchaseRow = {
  id: number;
  user_id: string;
  credits: number;
  stripe_session_id: string;
  created_at: string;
};

export type UserStampRow = {
  user_id: string;
  id: string;
  name: string;
  preview: string;
  objects: import("@/types/editor").PageObject[];
  width: number;
  height: number;
  created_at: string;
};

export type BookVersionRow = {
  user_id: string;
  id: string;
  book_id: string;
  at: string;
  title: string;
  page_count: number;
  signature: string;
  manual: boolean;
  pages: import("@/types/editor").BookPage[];
};

export type UserMediaRow = {
  id: string;
  user_id: string;
  path: string;
  url: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  source: "upload" | "ai";
  created_at: string;
};
