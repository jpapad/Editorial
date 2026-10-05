-- Share links: a teacher shares a book, children open /share/<token> and
-- color it in the browser with no account. Children's coloring is kept on
-- their own device only — nothing they do is written back to the book.
--
-- Security model: the token is an unguessable uuid; anon can't read any
-- table directly. The only anon entry point is get_shared_book(token),
-- which returns just what coloring needs (title, trim, bleed, pages) for
-- a live, unrevoked share.
--
-- Run once in Supabase > SQL Editor. Safe to re-run.

do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.books'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.book_shares (
      token uuid primary key default gen_random_uuid(),
      book_id %s not null references public.books (id) on delete cascade,
      created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
      created_at timestamptz not null default now(),
      revoked_at timestamptz
    )
  $f$, id_type);
end
$$;

create index if not exists book_shares_book_idx on public.book_shares (book_id);
alter table public.book_shares enable row level security;

-- Only the book's owner manages its links.
drop policy if exists "Owners read their shares" on public.book_shares;
create policy "Owners read their shares" on public.book_shares
  for select to authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));

drop policy if exists "Owners create shares" on public.book_shares;
create policy "Owners create shares" on public.book_shares
  for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));

drop policy if exists "Owners revoke shares" on public.book_shares;
create policy "Owners revoke shares" on public.book_shares
  for update to authenticated
  using (exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));

revoke all on public.book_shares from anon;
revoke update on public.book_shares from authenticated;
grant select, insert on public.book_shares to authenticated;
grant update (revoked_at) on public.book_shares to authenticated;

create or replace function public.get_shared_book(share_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', b.title,
    'trim_size', b.trim_size,
    'bleed', coalesce(to_jsonb(b) -> 'bleed', 'false'::jsonb),
    -- Clean pages for the children: no owner's coloring, no thumbnails, no blank backs.
    'pages', coalesce((
      select jsonb_agg(p - 'fillDataUrl' - 'completedAt' - 'thumbnailDataUrl' order by ord)
      from jsonb_array_elements(b.pages) with ordinality as e(p, ord)
      where not coalesce((p ->> 'isBlankBack')::boolean, false)
    ), '[]'::jsonb)
  )
  from public.book_shares s
  join public.books b on b.id = s.book_id
  where s.token = share_token and s.revoked_at is null;
$$;
revoke all on function public.get_shared_book(uuid) from public;
grant execute on function public.get_shared_book(uuid) to anon, authenticated;
