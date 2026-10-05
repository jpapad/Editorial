-- Working on a book together: the owner invites people with a link, as
-- editors (they change the book) or viewers (they read it and comment).
-- The book stays the owner's: nobody — owner included — can hand it to
-- another user_id (trigger below), and only the owner manages people.
--
-- Requires sql/00_books.sql and sql/02_page_comments.sql (it widens
-- can_review_book to members). Safe to re-run; run again after re-running 02.

create table if not exists public.book_members (
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  email text,
  added_at timestamptz not null default now(),
  primary key (book_id, user_id)
);
create index if not exists book_members_user_idx on public.book_members (user_id);

create table if not exists public.book_invites (
  token uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists book_invites_book_idx on public.book_invites (book_id);

-- 'owner' | 'editor' | 'viewer' | null for the signed-in user.
create or replace function public.book_role(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.books b where b.id = target and b.user_id = auth.uid()) then 'owner'
    else (select m.role from public.book_members m where m.book_id = target and m.user_id = auth.uid())
  end;
$$;
revoke all on function public.book_role(uuid) from public, anon;
grant execute on function public.book_role(uuid) to authenticated;

-- Books: members read, editors change. Additive to the owner's own policies.
drop policy if exists "Members read shared books" on public.books;
create policy "Members read shared books" on public.books
  for select to authenticated
  using ((select public.book_role(id)) in ('editor', 'viewer'));

drop policy if exists "Editors change shared books" on public.books;
create policy "Editors change shared books" on public.books
  for update to authenticated
  using ((select public.book_role(id)) = 'editor')
  with check ((select public.book_role(id)) = 'editor');

-- A book never changes hands — not by an editor, not by mistake.
create or replace function public.books_keep_owner() returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'a book can''t be given to another account' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists books_keep_owner on public.books;
create trigger books_keep_owner before update on public.books for each row execute function public.books_keep_owner();

alter table public.book_members enable row level security;
alter table public.book_invites enable row level security;
revoke all on public.book_members, public.book_invites from anon;

-- Everyone on a book sees who else is on it; the owner changes roles and
-- removes people; anyone can leave a book themselves.
grant select, delete on public.book_members to authenticated;
grant update (role) on public.book_members to authenticated;
drop policy if exists "See who's on the book" on public.book_members;
create policy "See who's on the book" on public.book_members for select to authenticated using ((select public.book_role(book_id)) is not null);
drop policy if exists "Owner changes roles" on public.book_members;
create policy "Owner changes roles" on public.book_members for update to authenticated using ((select public.book_role(book_id)) = 'owner') with check ((select public.book_role(book_id)) = 'owner');
drop policy if exists "Owner removes, members leave" on public.book_members;
create policy "Owner removes, members leave" on public.book_members for delete to authenticated using (user_id = auth.uid() or (select public.book_role(book_id)) = 'owner');

grant select, insert on public.book_invites to authenticated;
grant update (revoked_at) on public.book_invites to authenticated;
drop policy if exists "Owner manages invites" on public.book_invites;
create policy "Owner manages invites" on public.book_invites for all to authenticated
  using ((select public.book_role(book_id)) = 'owner')
  with check (created_by = auth.uid() and (select public.book_role(book_id)) = 'owner');

-- Opening an invite link while signed in: join the book (or change role to
-- the invite's). The invite stays usable for the rest of the team until
-- the owner turns it off. Returns the book id, or null for a dead link.
create or replace function public.accept_book_invite(invite uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv public.book_invites%rowtype;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select * into inv from public.book_invites where token = invite and revoked_at is null;
  if not found then
    return null;
  end if;
  if exists (select 1 from public.books b where b.id = inv.book_id and b.user_id = me) then
    return inv.book_id; -- the owner opening their own link
  end if;
  insert into public.book_members (book_id, user_id, role, email)
  values (inv.book_id, me, inv.role, (select u.email from auth.users u where u.id = me))
  on conflict (book_id, user_id) do update set role = excluded.role;
  return inv.book_id;
end;
$$;
revoke all on function public.accept_book_invite(uuid) from public, anon;
grant execute on function public.accept_book_invite(uuid) to authenticated;

-- "Shared with me" in the library: books I'm a member of, with my role.
create or replace function public.books_shared_with_me()
returns table (book jsonb, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(b), m.role
  from public.book_members m
  join public.books b on b.id = m.book_id
  where m.user_id = auth.uid()
  order by b.updated_at desc;
$$;
revoke all on function public.books_shared_with_me() from public, anon;
grant execute on function public.books_shared_with_me() to authenticated;

-- Comments: members of a book read and write them too (widens sql/02).
create or replace function public.can_review_book(target_book text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or exists (select 1 from public.books b where b.id::text = target_book and b.user_id = auth.uid())
      or exists (select 1 from public.book_members m where m.book_id::text = target_book and m.user_id = auth.uid());
$$;
revoke all on function public.can_review_book(text) from public, anon;
grant execute on function public.can_review_book(text) to authenticated;
