-- Book-level print settings for KDP:
--   bleed — interior pages print to the edge (canvas extends 0.125in past the trim)
--   paper — sets the spine width on the cover (white / cream / color)
--   cover — the full wrap-around cover design (back + spine + front), as jsonb
--
-- The app keeps working before this runs (it retries saves without these
-- columns), but bleed/paper/cover won't persist until it does.
-- Run once in Supabase > SQL Editor. Safe to re-run.

alter table public.books add column if not exists bleed boolean not null default false;
alter table public.books add column if not exists paper text not null default 'white';
alter table public.books add column if not exists cover jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'books_paper_check') then
    alter table public.books add constraint books_paper_check check (paper in ('white', 'cream', 'color'));
  end if;
end
$$;
