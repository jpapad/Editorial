-- The base table: one row per book, every page in `pages` (jsonb array).
--
-- This is the schema the app was set up with; on an existing project it
-- changes nothing (same table, same policy names). On a NEW Supabase
-- project it must run first — everything in 01–05 builds on public.books.
-- Run once in Supabase > SQL Editor. Safe to re-run.

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  pages jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  collection text,
  trim_size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists books_user_id_idx on public.books (user_id);

alter table public.books enable row level security;

-- Each user sees and changes only their own books. (Supervisors get extra
-- read/delete access in 01_admin_role.sql.) The update policy has no
-- separate WITH CHECK, so Postgres applies the USING condition to the new
-- row too: nobody can hand a book to another user_id.
drop policy if exists "select own books" on public.books;
create policy "select own books" on public.books for select using (auth.uid() = user_id);

drop policy if exists "insert own books" on public.books;
create policy "insert own books" on public.books for insert with check (auth.uid() = user_id);

drop policy if exists "update own books" on public.books;
create policy "update own books" on public.books for update using (auth.uid() = user_id);

drop policy if exists "delete own books" on public.books;
create policy "delete own books" on public.books for delete using (auth.uid() = user_id);
