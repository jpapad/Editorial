-- Media library: every picture a user has uploaded or generated, to use
-- again in any book. The files themselves live in the book-images bucket
-- (sql/07_image_storage.sql); this table is the catalogue — name, size,
-- where it came from.
--
-- Requires sql/07_image_storage.sql. Run once in Supabase > SQL Editor. Safe to re-run.

create table if not exists public.user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The file's path inside the bucket ("<user id>/<hash>.png") and its public link.
  path text not null check (char_length(path) between 3 and 300),
  url text not null check (char_length(url) <= 600),
  name text not null default '' check (char_length(name) <= 160),
  mime text not null default '',
  width int not null default 0,
  height int not null default 0,
  source text not null default 'upload' check (source in ('upload', 'ai')),
  created_at timestamptz not null default now(),
  -- The same picture added twice is one entry.
  unique (user_id, path)
);
create index if not exists user_media_user_idx on public.user_media (user_id, created_at desc);
alter table public.user_media enable row level security;

-- A user can only catalogue files in their own folder.
drop policy if exists "Users manage their own media" on public.user_media;
create policy "Users manage their own media" on public.user_media
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and path like auth.uid()::text || '/%');

revoke all on public.user_media from anon;
grant select, insert, update, delete on public.user_media to authenticated;
