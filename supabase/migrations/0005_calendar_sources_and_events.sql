-- Milestone 3: read-only calendar sources and mirrored events.

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind in ('gcal', 'ics', 'manual')),
  label text not null,
  url_secret text,
  last_synced_at timestamptz,
  last_error text,
  enabled boolean not null default true
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  external_id text not null,
  title text not null,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  unique (source_id, external_id),
  check (end_at > start_at)
);

alter table public.items
  add constraint items_source_id_fkey
  foreign key (source_id) references public.sources (id) on delete set null;

create index sources_user_id_idx on public.sources (user_id);
create index events_start_at_idx on public.events (start_at);
create index events_source_id_idx on public.events (source_id);

alter table public.sources enable row level security;
alter table public.events enable row level security;

create policy "sources select own" on public.sources
  for select using ((select auth.uid()) = user_id);
create policy "sources insert own" on public.sources
  for insert with check ((select auth.uid()) = user_id);
create policy "sources update own" on public.sources
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sources delete own" on public.sources
  for delete using ((select auth.uid()) = user_id);

create policy "events select own" on public.events
  for select using ((select auth.uid()) = user_id);
create policy "events insert own" on public.events
  for insert with check ((select auth.uid()) = user_id);
create policy "events update own" on public.events
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "events delete own" on public.events
  for delete using ((select auth.uid()) = user_id);

-- Source credentials are server-only. Authenticated clients can read source
-- status but cannot select the encrypted secret column directly.
revoke select on public.sources from anon, authenticated;
grant select (
  id,
  user_id,
  kind,
  label,
  last_synced_at,
  last_error,
  enabled
) on public.sources to authenticated;
