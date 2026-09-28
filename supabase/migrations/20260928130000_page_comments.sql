-- Page comments: supervisors (and the book's owner) leave notes on
-- specific pages; the owner sees them in the editor and resolves them.
--
-- Requires 20260928120000_admin_role.sql (public.is_admin()).
-- Run once in Supabase > SQL Editor. Safe to re-run.

-- books.id's type isn't pinned down in this repo (the editor writes its
-- own "book-…" ids, onboarding lets the database pick one), so the
-- foreign key column copies whatever type books.id actually has.
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.books'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.page_comments (
      id uuid primary key default gen_random_uuid(),
      book_id %s not null references public.books (id) on delete cascade,
      page_id text not null,
      author_id uuid not null references auth.users (id) on delete cascade,
      author_email text not null,
      body text not null check (char_length(body) between 1 and 2000),
      resolved boolean not null default false,
      created_at timestamptz not null default now()
    )
  $f$, id_type);
end
$$;

create index if not exists page_comments_book_idx on public.page_comments (book_id, created_at);

alter table public.page_comments enable row level security;

-- Author fields always come from the session, never from the client.
create or replace function public.page_comments_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_id := auth.uid();
  new.author_email := coalesce((select u.email from auth.users u where u.id = auth.uid()), 'unknown');
  new.resolved := false;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists page_comments_set_author on public.page_comments;
create trigger page_comments_set_author
  before insert on public.page_comments
  for each row execute function public.page_comments_set_author();

-- Who may see / write comments on a book: its owner and supervisors.
create or replace function public.can_review_book(target_book text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (select 1 from public.books b where b.id::text = target_book and b.user_id = auth.uid());
$$;
revoke all on function public.can_review_book(text) from public, anon;
grant execute on function public.can_review_book(text) to authenticated;

drop policy if exists "Owner and supervisors read comments" on public.page_comments;
create policy "Owner and supervisors read comments" on public.page_comments
  for select to authenticated
  using ((select public.can_review_book(book_id::text)));

drop policy if exists "Owner and supervisors add comments" on public.page_comments;
create policy "Owner and supervisors add comments" on public.page_comments
  for insert to authenticated
  with check ((select public.can_review_book(book_id::text)));

-- Resolving: only the `resolved` column is updatable (column grant below).
drop policy if exists "Owner and supervisors resolve comments" on public.page_comments;
create policy "Owner and supervisors resolve comments" on public.page_comments
  for update to authenticated
  using ((select public.can_review_book(book_id::text)))
  with check ((select public.can_review_book(book_id::text)));

drop policy if exists "Authors and supervisors delete comments" on public.page_comments;
create policy "Authors and supervisors delete comments" on public.page_comments
  for delete to authenticated
  using (author_id = auth.uid() or (select public.is_admin()));

revoke all on public.page_comments from anon;
revoke update on public.page_comments from authenticated;
grant select, insert, delete on public.page_comments to authenticated;
grant update (resolved) on public.page_comments to authenticated;
