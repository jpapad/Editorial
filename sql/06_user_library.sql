-- A user's own library, kept with the account instead of on one device:
-- "My stamps" (saved pieces to reuse in any book) and book version history.
--
-- Requires sql/00_books.sql. Run once in Supabase > SQL Editor. Safe to re-run.
-- Until it runs, the app keeps both on the device only (as before).

-- ---------------------------------------------------------------------------
-- My stamps
-- ---------------------------------------------------------------------------

create table if not exists public.user_stamps (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  name text not null default '' check (char_length(name) <= 120),
  preview text not null,
  objects jsonb not null,
  width real not null,
  height real not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.user_stamps enable row level security;

drop policy if exists "Users manage their own stamps" on public.user_stamps;
create policy "Users manage their own stamps" on public.user_stamps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.user_stamps from anon;
grant select, insert, update, delete on public.user_stamps to authenticated;

-- ---------------------------------------------------------------------------
-- Book versions: snapshots of a book's pages to go back to.
-- ---------------------------------------------------------------------------

create table if not exists public.book_versions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 80),
  book_id uuid not null references public.books (id) on delete cascade,
  at timestamptz not null default now(),
  title text not null default '',
  page_count int not null default 0,
  signature text not null default '',
  manual boolean not null default false,
  pages jsonb not null,
  primary key (user_id, id)
);
create index if not exists book_versions_book_idx on public.book_versions (book_id, at desc);
alter table public.book_versions enable row level security;

-- Only for books the user owns: a version can't be attached to someone else's book.
drop policy if exists "Users manage versions of their own books" on public.book_versions;
create policy "Users manage versions of their own books" on public.book_versions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));

revoke all on public.book_versions from anon;
grant select, insert, update, delete on public.book_versions to authenticated;
