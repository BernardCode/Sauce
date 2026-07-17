-- Student workflow expansion: energy-aware assignments and SAT preparation.

alter table public.items
  add column energy text not null default 'medium'
  check (energy in ('low', 'medium', 'high'));

create table public.sat_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  test_date date,
  target_score integer not null default 1400 check (target_score between 400 and 1600),
  current_score integer check (current_score between 400 and 1600),
  weekly_minutes integer not null default 240 check (weekly_minutes between 30 and 2100),
  updated_at timestamptz not null default now()
);

create table public.sat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  section text not null check (section in ('math', 'reading_writing')),
  skill text not null,
  mode text not null default 'untimed' check (mode in ('timed', 'untimed', 'review')),
  minutes integer not null check (minutes between 1 and 600),
  questions integer not null check (questions between 1 and 200),
  correct integer not null check (correct >= 0 and correct <= questions),
  completed_at timestamptz not null default now()
);

create table public.sat_mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  section text not null check (section in ('math', 'reading_writing')),
  skill text not null,
  reason text not null,
  takeaway text not null default '',
  confidence integer not null default 2 check (confidence between 1 and 5),
  source_url text,
  next_review_at date not null default (current_date + 3),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index sat_sessions_user_completed_idx
  on public.sat_sessions (user_id, completed_at desc);
create index sat_mistakes_user_review_idx
  on public.sat_mistakes (user_id, resolved, next_review_at);
create index items_user_energy_idx
  on public.items (user_id, status, energy);

alter table public.sat_profiles enable row level security;
alter table public.sat_sessions enable row level security;
alter table public.sat_mistakes enable row level security;

create policy "sat profiles select own" on public.sat_profiles
  for select using ((select auth.uid()) = user_id);
create policy "sat profiles insert own" on public.sat_profiles
  for insert with check ((select auth.uid()) = user_id);
create policy "sat profiles update own" on public.sat_profiles
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sat profiles delete own" on public.sat_profiles
  for delete using ((select auth.uid()) = user_id);

create policy "sat sessions select own" on public.sat_sessions
  for select using ((select auth.uid()) = user_id);
create policy "sat sessions insert own" on public.sat_sessions
  for insert with check ((select auth.uid()) = user_id);
create policy "sat sessions update own" on public.sat_sessions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sat sessions delete own" on public.sat_sessions
  for delete using ((select auth.uid()) = user_id);

create policy "sat mistakes select own" on public.sat_mistakes
  for select using ((select auth.uid()) = user_id);
create policy "sat mistakes insert own" on public.sat_mistakes
  for insert with check ((select auth.uid()) = user_id);
create policy "sat mistakes update own" on public.sat_mistakes
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sat mistakes delete own" on public.sat_mistakes
  for delete using ((select auth.uid()) = user_id);

create function public.record_item_progress(
  item_id_arg uuid,
  work_minutes integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if work_minutes < 1 or work_minutes > 1440 then
    raise exception 'invalid work minutes' using errcode = '22023';
  end if;

  update public.items
  set actual_minutes = coalesce(actual_minutes, 0) + work_minutes,
      remaining_minutes = greatest(0, coalesce(remaining_minutes, est_minutes, work_minutes) - work_minutes)
  where id = item_id_arg
    and user_id = (select auth.uid())
    and status = 'open'
    and is_project = false;

  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.record_item_progress(uuid, integer) from public, anon;
grant execute on function public.record_item_progress(uuid, integer) to authenticated;
