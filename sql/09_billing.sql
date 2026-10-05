-- Plans (Free / Pro / Studio) and AI credit packs, paid through Stripe.
--
-- Requires sql/05_usage_and_templates.sql (usage_events, consume_ai_credit).
-- Safe to re-run.
--
-- How the AI limit works after this file:
--   * every plan has a monthly allowance (Free 20, Pro 300, Studio 1500);
--     a supervisor-set limit (user_quotas) still wins over the plan;
--   * credits bought in packs never expire and are only used once the
--     month's allowance has run out (usage_events.from_extra marks those).
--
-- Rows in subscriptions / credit_purchases are written only by the Stripe
-- webhook (/api/billing/webhook) with the service-role key, never by the
-- browser: users can read their own, nothing else.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'studio')),
  status text not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select to authenticated using (user_id = auth.uid());

create table if not exists public.credit_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  credits int not null check (credits > 0),
  -- One row per Stripe Checkout session: a webhook delivered twice adds the credits once.
  stripe_session_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists credit_purchases_user_idx on public.credit_purchases (user_id);
alter table public.credit_purchases enable row level security;
revoke all on public.credit_purchases from anon, authenticated;
grant select on public.credit_purchases to authenticated;
drop policy if exists "read own purchases" on public.credit_purchases;
create policy "read own purchases" on public.credit_purchases for select to authenticated using (user_id = auth.uid());

alter table public.usage_events add column if not exists from_extra boolean not null default false;

create or replace function public.plan_ai_limit(plan_name text) returns int language sql immutable as $$
  select case plan_name when 'pro' then 300 when 'studio' then 1500 else public.default_ai_limit() end
$$;

-- The plan that counts: a paid plan only while Stripe says it's active (or in its grace period).
create or replace function public.plan_for(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan from public.subscriptions s
      where s.user_id = target and s.status in ('active', 'trialing', 'past_due')),
    'free');
$$;
revoke all on function public.plan_for(uuid) from public, anon, authenticated;

create or replace function public.ai_limit_for(target uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select q.ai_monthly_limit from public.user_quotas q where q.user_id = target), public.plan_ai_limit(public.plan_for(target)));
$$;
revoke all on function public.ai_limit_for(uuid) from public, anon, authenticated;

-- This month's use of the allowance — bought credits don't count here.
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
    and not from_extra
    and created_at >= date_trunc('month', now());
$$;
revoke all on function public.ai_used_this_month(uuid) from public, anon, authenticated;

-- Bought credits not yet used (they never expire).
create or replace function public.extra_credits_left(target uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    coalesce((select sum(p.credits) from public.credit_purchases p where p.user_id = target), 0)
    - coalesce((select sum(e.units) from public.usage_events e where e.user_id = target and e.from_extra and not e.refunded), 0)
  )::int;
$$;
revoke all on function public.extra_credits_left(uuid) from public, anon, authenticated;

create or replace function public.my_ai_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'used', public.ai_used_this_month(auth.uid()),
    'limit', case when public.is_admin() then null else public.ai_limit_for(auth.uid()) end,
    'extra', public.extra_credits_left(auth.uid()),
    'plan', public.plan_for(auth.uid())
  );
$$;
revoke all on function public.my_ai_usage() from public, anon;
grant execute on function public.my_ai_usage() to authenticated;

-- Same contract as before (allowed/used/limit/event_id), plus 'extra'.
-- The month's allowance first; when it can't cover the request, bought credits.
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
  extra int;
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
  extra := public.extra_credits_left(me);
  if cap is null or used + credit_units <= cap then
    insert into public.usage_events (user_id, kind, units) values (me, credit_kind, credit_units) returning id into event_id;
    return jsonb_build_object('allowed', true, 'used', used + credit_units, 'limit', cap, 'extra', extra, 'event_id', event_id);
  end if;
  if extra >= credit_units then
    insert into public.usage_events (user_id, kind, units, from_extra) values (me, credit_kind, credit_units, true) returning id into event_id;
    return jsonb_build_object('allowed', true, 'used', used, 'limit', cap, 'extra', extra - credit_units, 'event_id', event_id);
  end if;
  return jsonb_build_object('allowed', false, 'used', used, 'limit', cap, 'extra', extra);
end;
$$;
revoke all on function public.consume_ai_credit(text, int) from public, anon;
grant execute on function public.consume_ai_credit(text, int) to authenticated;
