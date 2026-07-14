-- Milestone 1: users and items, with RLS scoping every row to its owner.
--
-- One deliberate addition over the spec's data model: items.user_id.
-- The spec's model has no ownership column, but the security model requires
-- RLS that scopes every row to its owner, which is impossible without one.

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  timezone text not null default 'UTC',
  working_hours_json jsonb,
  planner_prefs_json jsonb
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- source_id gets its foreign key when the sources table lands in milestone 3
  source_id uuid,
  external_id text,
  parent_id uuid references public.items (id) on delete cascade,
  title text not null,
  description text,
  course text,
  due_at timestamptz,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high')),
  est_minutes integer check (est_minutes > 0),
  remaining_minutes integer check (remaining_minutes >= 0),
  actual_minutes integer check (actual_minutes >= 0),
  is_project boolean not null default false,
  step_order integer,
  status text not null default 'open'
    check (status in ('open', 'done', 'archived')),
  origin text not null default 'manual'
    check (origin in ('ai', 'manual', 'feed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_seen_at timestamptz,
  unique (source_id, external_id)
);

create index items_parent_id_idx on public.items (parent_id);

alter table public.users enable row level security;
alter table public.items enable row level security;

-- users: read and update your own row only. The row itself is created by the
-- signup trigger below, so the client role gets no insert policy.
create policy "users select own" on public.users
  for select using ((select auth.uid()) = id);
create policy "users update own" on public.users
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "items select own" on public.items
  for select using ((select auth.uid()) = user_id);
create policy "items insert own" on public.items
  for insert with check ((select auth.uid()) = user_id);
create policy "items update own" on public.items
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "items delete own" on public.items
  for delete using ((select auth.uid()) = user_id);

-- Mirror a new auth user into public.users on first sign-in.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
