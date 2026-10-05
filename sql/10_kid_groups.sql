-- Classes and families: a grown-up (teacher or parent) makes a group of
-- children, gives it books to color, and sees every child's finished
-- pages — kept with the account, not just on a device.
--
-- Children have no accounts and no email. They join at /kids with the
-- group's code, tap their name, then their two-picture password. That
-- login hands the device a secret token (kid_members.token); every
-- child-side call below takes that token, nothing else. The grown-up can
-- reset it to sign a lost tablet out.
--
-- Anon can't read any table here directly: the only child entry points
-- are the security-definer functions at the bottom.
--
-- Requires sql/00_books.sql. Safe to re-run.

-- Join codes avoid look-alike characters (no 0/O, 1/I/L).
create or replace function public.new_group_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6);
$$;

-- Two pictures out of nine, e.g. {3,7}.
create or replace function public.new_picture_pin() returns int[] language sql volatile as $$
  select array[floor(random() * 9)::int, floor(random() * 9)::int];
$$;

create table if not exists public.kid_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'class' check (kind in ('class', 'family')),
  name text not null check (char_length(name) between 1 and 80),
  code text not null unique default public.new_group_code(),
  created_at timestamptz not null default now()
);
create index if not exists kid_groups_owner_idx on public.kid_groups (owner_id);

create table if not exists public.kid_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.kid_groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar int not null default 0 check (avatar between 0 and 9),
  pin int[] not null default public.new_picture_pin() check (array_length(pin, 1) = 2 and pin[1] between 0 and 8 and pin[2] between 0 and 8),
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index if not exists kid_members_group_idx on public.kid_members (group_id);

create table if not exists public.kid_group_books (
  group_id uuid not null references public.kid_groups (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (group_id, book_id)
);

-- One row per child per page they've colored.
create table if not exists public.kid_work (
  member_id uuid not null references public.kid_members (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  page_id text not null check (char_length(page_id) <= 100),
  fill text check (fill is null or octet_length(fill) <= 4000000),
  thumb text check (thumb is null or octet_length(thumb) <= 400000),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  -- From the grown-up: a sticker (index into the app's sticker set) and a short note.
  sticker int check (sticker is null or sticker between 0 and 9),
  comment text check (comment is null or char_length(comment) <= 300),
  primary key (member_id, book_id, page_id)
);
create index if not exists kid_work_book_idx on public.kid_work (book_id);

alter table public.kid_groups enable row level security;
alter table public.kid_members enable row level security;
alter table public.kid_group_books enable row level security;
alter table public.kid_work enable row level security;
revoke all on public.kid_groups, public.kid_members, public.kid_group_books, public.kid_work from anon;

create or replace function public.owns_kid_group(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.kid_groups g where g.id = target and g.owner_id = auth.uid());
$$;
revoke all on function public.owns_kid_group(uuid) from public, anon;
grant execute on function public.owns_kid_group(uuid) to authenticated;

-- Groups: the owner does everything; the code can't be chosen, only regenerated.
grant select, insert, delete on public.kid_groups to authenticated;
grant update (name, kind, code) on public.kid_groups to authenticated;
drop policy if exists "own groups" on public.kid_groups;
create policy "own groups" on public.kid_groups for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant select, insert, delete on public.kid_members to authenticated;
grant update (name, avatar, pin, token) on public.kid_members to authenticated;
drop policy if exists "own group members" on public.kid_members;
create policy "own group members" on public.kid_members for all to authenticated using (public.owns_kid_group(group_id)) with check (public.owns_kid_group(group_id));

-- Only your own books go to your own groups.
grant select, insert, delete on public.kid_group_books to authenticated;
drop policy if exists "own group books" on public.kid_group_books;
create policy "own group books" on public.kid_group_books for all to authenticated
  using (public.owns_kid_group(group_id))
  with check (public.owns_kid_group(group_id) and exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));

-- The grown-up reads their children's work and can only add a sticker or a note.
grant select on public.kid_work to authenticated;
grant update (sticker, comment) on public.kid_work to authenticated;
drop policy if exists "read own kids work" on public.kid_work;
create policy "read own kids work" on public.kid_work for select to authenticated
  using (exists (select 1 from public.kid_members m where m.id = member_id and public.owns_kid_group(m.group_id)));
drop policy if exists "reward own kids work" on public.kid_work;
create policy "reward own kids work" on public.kid_work for update to authenticated
  using (exists (select 1 from public.kid_members m where m.id = member_id and public.owns_kid_group(m.group_id)));

-- ---------------------------------------------------------------------------
-- Child side (anon). Nothing here returns a pin or a token except kid_login.
-- ---------------------------------------------------------------------------

-- The join screen: the group's name and the children to pick from.
create or replace function public.kid_group_lookup(group_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', g.name,
    'kind', g.kind,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'avatar', m.avatar) order by m.name) from public.kid_members m where m.group_id = g.id), '[]'::jsonb)
  )
  from public.kid_groups g
  where g.code = upper(trim(group_code));
$$;
revoke all on function public.kid_group_lookup(text) from public;
grant execute on function public.kid_group_lookup(text) to anon, authenticated;

-- Right pictures → the device's token. Wrong → null.
create or replace function public.kid_login(group_code text, member uuid, picture_pin int[])
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.token
  from public.kid_members m
  join public.kid_groups g on g.id = m.group_id
  where g.code = upper(trim(group_code)) and m.id = member and m.pin = picture_pin;
$$;
revoke all on function public.kid_login(text, uuid, int[]) from public;
grant execute on function public.kid_login(text, uuid, int[]) to anon, authenticated;

-- The child's home: their books with progress, and the stickers they've been given.
create or replace function public.kid_home(kid_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', m.name,
    'avatar', m.avatar,
    'group', g.name,
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'title', b.title,
        'pages', (select count(*) from jsonb_array_elements(b.pages) p where not coalesce((p ->> 'isBlankBack')::boolean, false)),
        'done', (select count(*) from public.kid_work w where w.member_id = m.id and w.book_id = b.id and w.completed_at is not null),
        'cover', (select w.thumb from public.kid_work w where w.member_id = m.id and w.book_id = b.id and w.thumb is not null order by w.updated_at desc limit 1)
      ) order by gb.assigned_at desc)
      from public.kid_group_books gb join public.books b on b.id = gb.book_id
      where gb.group_id = g.id
    ), '[]'::jsonb),
    'stickers', coalesce((select jsonb_agg(w.sticker order by w.updated_at) from public.kid_work w where w.member_id = m.id and w.sticker is not null), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('book_id', w.book_id, 'page_id', w.page_id, 'comment', w.comment) order by w.updated_at desc) from public.kid_work w where w.member_id = m.id and w.comment is not null), '[]'::jsonb)
  )
  from public.kid_members m
  join public.kid_groups g on g.id = m.group_id
  where m.token = kid_token;
$$;
revoke all on function public.kid_home(uuid) from public;
grant execute on function public.kid_home(uuid) to anon, authenticated;

-- One assigned book: clean pages (as for share links) plus this child's own work.
create or replace function public.kid_book(kid_token uuid, book uuid)
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
    'pages', coalesce((
      select jsonb_agg(p - 'fillDataUrl' - 'completedAt' - 'thumbnailDataUrl' order by ord)
      from jsonb_array_elements(b.pages) with ordinality as e(p, ord)
      where not coalesce((p ->> 'isBlankBack')::boolean, false)
    ), '[]'::jsonb),
    'work', coalesce((
      select jsonb_object_agg(w.page_id, jsonb_build_object('fill', w.fill, 'thumb', w.thumb, 'completed_at', w.completed_at, 'sticker', w.sticker, 'comment', w.comment))
      from public.kid_work w where w.member_id = m.id and w.book_id = b.id
    ), '{}'::jsonb)
  )
  from public.kid_members m
  join public.kid_group_books gb on gb.group_id = m.group_id and gb.book_id = book
  join public.books b on b.id = gb.book_id
  where m.token = kid_token;
$$;
revoke all on function public.kid_book(uuid, uuid) from public;
grant execute on function public.kid_book(uuid, uuid) to anon, authenticated;

-- Saves one page of the child's coloring. Only for a book given to their
-- group, and only for a page that's really in it. A finished page stays
-- finished (its first completion time is kept).
create or replace function public.kid_save(kid_token uuid, book uuid, page text, page_fill text, page_thumb text, done boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid;
begin
  select m.id into me
  from public.kid_members m
  join public.kid_group_books gb on gb.group_id = m.group_id and gb.book_id = book
  where m.token = kid_token;
  if me is null then
    return false;
  end if;
  if not exists (select 1 from public.books b, jsonb_array_elements(b.pages) p where b.id = book and p ->> 'id' = page) then
    return false;
  end if;
  insert into public.kid_work as w (member_id, book_id, page_id, fill, thumb, completed_at, updated_at)
  values (me, book, page, page_fill, page_thumb, case when done then now() end, now())
  on conflict (member_id, book_id, page_id) do update
    set fill = coalesce(excluded.fill, w.fill),
        thumb = coalesce(excluded.thumb, w.thumb),
        completed_at = coalesce(w.completed_at, excluded.completed_at),
        updated_at = now();
  return true;
end;
$$;
revoke all on function public.kid_save(uuid, uuid, text, text, text, boolean) from public;
grant execute on function public.kid_save(uuid, uuid, text, text, text, boolean) to anon, authenticated;
