-- Annual Leave Tracker schema. Paste into Supabase > SQL Editor and run once.
-- Every row belongs to the signed-in user; Row Level Security hides everyone else's rows.

create table if not exists public.leave_years (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  year             int  not null,
  base_entitlement numeric(4,1) not null default 25,
  carried_in       numeric(4,1) not null default 0,   -- days brought forward from the previous year
  adjustment       numeric(4,1) not null default 0,   -- e.g. days borrowed from / lent to another year
  adjustment_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, year)
);

create table if not exists public.leave_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  year          int  not null,                         -- leave year the entry counts against
  reason        text not null,
  from_date     date,                                  -- null for undated ideas
  to_date       date,
  part_of_day   text not null default 'All' check (part_of_day in ('All', 'AM', 'PM')),
  days_override numeric(4,1),                          -- null = work it out from the dates
  requested     boolean not null default false,
  approved      boolean not null default false,
  cancelled     boolean not null default false,
  cancelled_on  date,
  notes         text,
  needs_review  boolean not null default false,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (to_date is null or from_date is null or to_date >= from_date)
);

create index if not exists leave_entries_user_year on public.leave_entries (user_id, year);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists leave_years_touch on public.leave_years;
create trigger leave_years_touch before update on public.leave_years
  for each row execute function public.touch_updated_at();
drop trigger if exists leave_entries_touch on public.leave_entries;
create trigger leave_entries_touch before update on public.leave_entries
  for each row execute function public.touch_updated_at();

alter table public.leave_years   enable row level security;
alter table public.leave_entries enable row level security;

drop policy if exists "own years" on public.leave_years;
create policy "own years" on public.leave_years for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own entries" on public.leave_entries;
create policy "own entries" on public.leave_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Restore from a backup file in a single transaction, so a failed import never leaves you with no data.
-- Runs as the caller, so the policies above still apply.
create or replace function public.replace_all(backup jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from leave_entries where user_id = auth.uid();
  delete from leave_years where user_id = auth.uid();

  insert into leave_years (year, base_entitlement, carried_in, adjustment, adjustment_note)
  select year, coalesce(base_entitlement, 25), coalesce(carried_in, 0), coalesce(adjustment, 0), adjustment_note
  from jsonb_populate_recordset(null::leave_years, backup->'years');

  insert into leave_entries (year, reason, from_date, to_date, part_of_day, days_override, requested, approved,
                             cancelled, cancelled_on, notes, needs_review, review_note)
  select year, reason, from_date, to_date, coalesce(part_of_day, 'All'), days_override, coalesce(requested, false),
         coalesce(approved, false), coalesce(cancelled, false), cancelled_on, notes, coalesce(needs_review, false),
         review_note
  from jsonb_populate_recordset(null::leave_entries, backup->'entries');
end $$;

revoke execute on function public.replace_all(jsonb) from public, anon;
grant execute on function public.replace_all(jsonb) to authenticated;
