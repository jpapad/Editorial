-- Usage limits (AI credits per month), usage events for admin statistics,
-- and community book templates.
--
-- Requires 20260928120000_admin_role.sql (public.is_admin()).
-- Run once in Supabase > SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Usage events: one row per AI image or export. AI rows count against the
-- monthly limit unless refunded (a failed generation gives its credit back).
-- ---------------------------------------------------------------------------

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ai_image', 'ai_photo', 'export_pdf', 'export_cover')),
  units int not null default 1 check (units > 0),
  refunded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_month_idx on public.usage_events (user_id, created_at);
alter table public.usage_events enable row level security;
-- No direct client access: everything goes through the functions below.
revoke all on public.usage_events from anon, authenticated;

-- Per-user monthly AI limit; users without a row get the default.
create table if not exists public.user_quotas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ai_monthly_limit int not null check (ai_monthly_limit >= 0),
  updated_at timestamptz not null default now()
);
alter table public.user_quotas enable row level security;
revoke all on public.user_quotas from anon, authenticated;

create or replace function public.default_ai_limit() returns int language sql immutable as $$ select 20 $$;

create or replace function public.ai_used_this_month(target uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(units), 0)::int
  from public.usage_events
  where user_id = target
    and kind in ('ai_image', 'ai_photo')
    and not refunded
    and created_at >= date_trunc('month', now());
$$;
revoke all on function public.ai_used_this_month(uuid) from public, anon, authenticated;

create or replace function public.ai_limit_for(target uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select q.ai_monthly_limit from public.user_quotas q where q.user_id = target), public.default_ai_limit());
$$;
revoke all on function public.ai_limit_for(uuid) from public, anon, authenticated;

-- What the signed-in user has used / may use this month (supervisors: unlimited = null limit).
create or replace function public.my_ai_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'used', public.ai_used_this_month(auth.uid()),
    'limit', case when public.is_admin() then null else public.ai_limit_for(auth.uid()) end
  );
$$;
revoke all on function public.my_ai_usage() from public, anon;
grant execute on function public.my_ai_usage() to authenticated;

-- Called by the AI API routes BEFORE contacting a provider. Atomically
-- checks the limit and records the use; returns the event id so a failure
-- can be refunded. Serialized per user so parallel requests can't overshoot.
create or replace function public.consume_ai_credit(credit_kind text, credit_units int default 1)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  used int;
  cap int;
  event_id bigint;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if credit_kind not in ('ai_image', 'ai_photo') or credit_units < 1 or credit_units > 10 then
    raise exception 'bad credit request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
  used := public.ai_used_this_month(me);
  cap := case when public.is_admin() then null else public.ai_limit_for(me) end;
  if cap is not null and used + credit_units > cap then
    return jsonb_build_object('allowed', false, 'used', used, 'limit', cap);
  end if;
  insert into public.usage_events (user_id, kind, units) values (me, credit_kind, credit_units) returning id into event_id;
  return jsonb_build_object('allowed', true, 'used', used + credit_units, 'limit', cap, 'event_id', event_id);
end;
$$;
revoke all on function public.consume_ai_credit(text, int) from public, anon;
grant execute on function public.consume_ai_credit(text, int) to authenticated;

-- Give back some (or all) units of a consumed credit — only your own event.
create or replace function public.refund_ai_credit(credit_event bigint, refund_units int default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ev public.usage_events%rowtype;
begin
  select * into ev from public.usage_events where id = credit_event and user_id = auth.uid() and not refunded for update;
  if not found then
    return;
  end if;
  if refund_units is null or refund_units >= ev.units then
    update public.usage_events set refunded = true where id = ev.id;
  elsif refund_units > 0 then
    update public.usage_events set units = ev.units - refund_units where id = ev.id;
  end if;
end;
$$;
revoke all on function public.refund_ai_credit(bigint, int) from public, anon;
grant execute on function public.refund_ai_credit(bigint, int) to authenticated;

-- Exports are logged for statistics only (no limit).
create or replace function public.log_export(export_kind text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or export_kind not in ('export_pdf', 'export_cover') then
    return;
  end if;
  insert into public.usage_events (user_id, kind) values (auth.uid(), export_kind);
end;
$$;
revoke all on function public.log_export(text) from public, anon;
grant execute on function public.log_export(text) to authenticated;

create or replace function public.admin_set_ai_limit(target_user uuid, new_limit int)
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
  if new_limit is null or new_limit < 0 or new_limit > 100000 then
    raise exception 'limit must be between 0 and 100000' using errcode = '22023';
  end if;
  insert into public.user_quotas (user_id, ai_monthly_limit) values (target_user, new_limit)
  on conflict (user_id) do update set ai_monthly_limit = excluded.ai_monthly_limit, updated_at = now();
end;
$$;
revoke all on function public.admin_set_ai_limit(uuid, int) from public, anon;
grant execute on function public.admin_set_ai_limit(uuid, int) to authenticated;

-- admin_list_users gains this month's AI use and each user's limit. The
-- return type changes, so drop and recreate.
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  is_admin boolean,
  book_count bigint,
  ai_used int,
  ai_limit int
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
      (select count(*) from public.books b where b.user_id = u.id),
      public.ai_used_this_month(u.id),
      public.ai_limit_for(u.id)
    from auth.users u
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Aggregates for the admin dashboard.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'active_30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'books', (select count(*) from public.books),
    'published', (select count(*) from public.books where status = 'published'),
    'pages', (select coalesce(sum(jsonb_array_length(pages)), 0) from public.books),
    'ai_month', (select coalesce(sum(units), 0) from public.usage_events where kind in ('ai_image', 'ai_photo') and not refunded and created_at >= date_trunc('month', now())),
    'exports_month', (select count(*) from public.usage_events where kind in ('export_pdf', 'export_cover') and created_at >= date_trunc('month', now())),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'ai', coalesce(a.ai, 0), 'exports', coalesce(a.exports, 0)) order by d), '[]'::jsonb)
      from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      left join (
        select date_trunc('day', created_at) as day,
               sum(units) filter (where kind in ('ai_image', 'ai_photo') and not refunded) as ai,
               count(*) filter (where kind in ('export_pdf', 'export_cover')) as exports
        from public.usage_events
        where created_at >= date_trunc('day', now()) - interval '29 days'
        group by 1
      ) a on a.day = d
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Community templates: a book's pages published for others to start from.
-- ---------------------------------------------------------------------------

create table if not exists public.book_templates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  trim_size text,
  bleed boolean not null default false,
  pages jsonb not null,
  page_count int not null default 0,
  thumbnail text,
  created_at timestamptz not null default now()
);
create index if not exists book_templates_created_idx on public.book_templates (created_at desc);
alter table public.book_templates enable row level security;

drop policy if exists "Signed-in users browse templates" on public.book_templates;
create policy "Signed-in users browse templates" on public.book_templates
  for select to authenticated using (true);

drop policy if exists "Authors publish templates" on public.book_templates;
create policy "Authors publish templates" on public.book_templates
  for insert to authenticated with check (author_id = auth.uid());

-- Authors take down their own; supervisors moderate any.
drop policy if exists "Authors and supervisors remove templates" on public.book_templates;
create policy "Authors and supervisors remove templates" on public.book_templates
  for delete to authenticated using (author_id = auth.uid() or (select public.is_admin()));

revoke all on public.book_templates from anon;
revoke update on public.book_templates from authenticated;
grant select, insert, delete on public.book_templates to authenticated;
