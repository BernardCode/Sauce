-- Milestone 4: planner idempotency and the minimal habit storage required by
-- the narrow log_habit MCP tool. The habit UI arrives in Milestone 7.

create table public.planner_runs (
  user_id uuid not null references public.users (id) on delete cascade,
  plan_date date not null,
  ran_at timestamptz not null default now(),
  blocks_written integer not null default 0 check (blocks_written >= 0),
  rejections_json jsonb not null default '[]'::jsonb,
  primary key (user_id, plan_date)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('daily', 'weekdays', 'custom')),
  days_json jsonb,
  target_per_week integer not null check (target_per_week between 1 and 7),
  color text not null,
  archived boolean not null default false
);

create table public.habit_logs (
  user_id uuid not null references public.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  done boolean not null default true,
  primary key (habit_id, date)
);

create index planner_runs_plan_date_idx on public.planner_runs (plan_date);
create index habits_user_id_idx on public.habits (user_id);
create index habit_logs_user_date_idx on public.habit_logs (user_id, date);

alter table public.planner_runs enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

create policy "planner runs select own" on public.planner_runs
  for select using ((select auth.uid()) = user_id);
create policy "planner runs insert own" on public.planner_runs
  for insert with check ((select auth.uid()) = user_id);
create policy "planner runs update own" on public.planner_runs
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "planner runs delete own" on public.planner_runs
  for delete using ((select auth.uid()) = user_id);

create policy "habits select own" on public.habits
  for select using ((select auth.uid()) = user_id);
create policy "habits insert own" on public.habits
  for insert with check ((select auth.uid()) = user_id);
create policy "habits update own" on public.habits
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "habits delete own" on public.habits
  for delete using ((select auth.uid()) = user_id);

create policy "habit logs select own" on public.habit_logs
  for select using ((select auth.uid()) = user_id);
create policy "habit logs insert own" on public.habit_logs
  for insert with check ((select auth.uid()) = user_id);
create policy "habit logs update own" on public.habit_logs
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "habit logs delete own" on public.habit_logs
  for delete using ((select auth.uid()) = user_id);
