-- Supervisor / admin role.
--
-- Admins can READ and DELETE every user's books and list all accounts
-- (the /studio/admin page). They deliberately can't UPDATE other users'
-- books: saveBook() upserts with the *current* user's id, so an admin
-- editing someone else's book would silently take ownership of it.
--
-- Run once in Supabase > SQL Editor. Safe to re-run.

-- Who is an admin. RLS on with no policies: the table is invisible to the
-- client; only the SECURITY DEFINER functions below read it.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Additive to the existing "own rows only" policies on books.
drop policy if exists "Admins can read all books" on public.books;
create policy "Admins can read all books" on public.books
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can delete any book" on public.books;
create policy "Admins can delete any book" on public.books
  for delete to authenticated
  using ((select public.is_admin()));

-- auth.users isn't exposed through the API, so the user list goes through
-- this function, which refuses anyone who isn't an admin.
-- (sql/05_usage_and_templates.sql redefines it with AI-usage
-- columns — run that one again after re-running this file.)
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  is_admin boolean,
  book_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
    select
      u.id,
      u.email::text,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at,
      exists (select 1 from public.app_admins a where a.user_id = u.id),
      (select count(*) from public.books b where b.user_id = u.id)
    from auth.users u
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Promote/demote another account from the admin page. A supervisor can't
-- demote themselves, so the app can never end up with nobody able to
-- manage it.
create or replace function public.admin_set_supervisor(target_user uuid, make_supervisor boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if target_user = auth.uid() and not make_supervisor then
    raise exception 'You can''t remove your own supervisor access.' using errcode = '42501';
  end if;

  if make_supervisor then
    insert into public.app_admins (user_id) values (target_user) on conflict do nothing;
  else
    delete from public.app_admins where user_id = target_user;
  end if;
end;
$$;
revoke all on function public.admin_set_supervisor(uuid, boolean) from public, anon;
grant execute on function public.admin_set_supervisor(uuid, boolean) to authenticated;

-- Make the FIRST supervisor (create the account under Authentication > Users);
-- after that, supervisors can promote others from /studio/admin:
--   insert into public.app_admins (user_id)
--   select id from auth.users where email = 'supervisor@example.com'
--   on conflict do nothing;
