-- Milestone 2: blocks, the schedule half of the items/blocks separation.
--
-- Same deliberate addition as items: blocks.user_id, because owner-scoped
-- RLS needs an ownership column and the spec's data model has none.
-- The end_at > start_at check mirrors the spec's Zod refine at the
-- database layer.

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  item_id uuid references public.items (id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  origin text not null default 'manual'
    check (origin in ('ai', 'manual')),
  locked boolean not null default false,
  done boolean not null default false,
  reason text,
  actual_minutes integer check (actual_minutes >= 0),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index blocks_start_at_idx on public.blocks (start_at);

alter table public.blocks enable row level security;

create policy "blocks select own" on public.blocks
  for select using ((select auth.uid()) = user_id);
create policy "blocks insert own" on public.blocks
  for insert with check ((select auth.uid()) = user_id);
create policy "blocks update own" on public.blocks
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "blocks delete own" on public.blocks
  for delete using ((select auth.uid()) = user_id);
