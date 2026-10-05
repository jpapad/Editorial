-- Error log without a third-party service: server errors (instrumentation.ts)
-- and browser errors (instrumentation-client.ts → /api/log-error) land
-- here, the same error folded into one row with a count, and supervisors
-- read them on /studio/admin.
--
-- Requires sql/01_admin_role.sql (is_admin). Safe to re-run.

create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  source text not null check (source in ('server', 'client')),
  message text not null,
  path text not null default '',
  digest text,
  user_agent text,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  hits int not null default 1,
  unique (source, message, path)
);
create index if not exists app_errors_last_idx on public.app_errors (last_at desc);
alter table public.app_errors enable row level security;
revoke all on public.app_errors from anon, authenticated;

-- The only way in: bounded fields, one row per distinct error (a storm of
-- the same error is one row with a high count, not a full table).
create or replace function public.log_app_error(error_source text, error_message text, error_path text default '', error_digest text default null, error_agent text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if error_source not in ('server', 'client') or coalesce(trim(error_message), '') = '' then
    return;
  end if;
  insert into public.app_errors as e (source, message, path, digest, user_agent)
  values (error_source, left(error_message, 500), left(coalesce(error_path, ''), 300), left(error_digest, 100), left(error_agent, 300))
  on conflict (source, message, path) do update
    set hits = e.hits + 1, last_at = now(), digest = coalesce(excluded.digest, e.digest), user_agent = coalesce(excluded.user_agent, e.user_agent);
end;
$$;
revoke all on function public.log_app_error(text, text, text, text, text) from public;
grant execute on function public.log_app_error(text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_recent_errors(max_rows int default 50)
returns setof public.app_errors
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.app_errors order by last_at desc limit least(greatest(max_rows, 1), 200);
end;
$$;
revoke all on function public.admin_recent_errors(int) from public, anon;
grant execute on function public.admin_recent_errors(int) to authenticated;

-- Supervisors clear an error once it's fixed.
create or replace function public.admin_clear_error(error_id bigint)
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
  delete from public.app_errors where id = error_id;
end;
$$;
revoke all on function public.admin_clear_error(bigint) from public, anon;
grant execute on function public.admin_clear_error(bigint) to authenticated;
