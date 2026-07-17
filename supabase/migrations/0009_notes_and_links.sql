-- Milestone 8: owner-scoped notes and saved links.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  body_md text not null default '',
  pinned boolean not null default false,
  daily_date date,
  updated_at timestamptz not null default now(),
  unique (user_id, daily_date)
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  url text not null,
  tag text not null default 'Other',
  favicon_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index links_user_tag_position_idx on public.links (user_id, tag, position);

alter table public.notes enable row level security;
alter table public.links enable row level security;

create policy "notes select own" on public.notes
  for select using ((select auth.uid()) = user_id);
create policy "notes insert own" on public.notes
  for insert with check ((select auth.uid()) = user_id);
create policy "notes update own" on public.notes
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notes delete own" on public.notes
  for delete using ((select auth.uid()) = user_id);

create policy "links select own" on public.links
  for select using ((select auth.uid()) = user_id);
create policy "links insert own" on public.links
  for insert with check ((select auth.uid()) = user_id);
create policy "links update own" on public.links
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "links delete own" on public.links
  for delete using ((select auth.uid()) = user_id);

create function public.reorder_links(
  tag_arg text,
  ordered_link_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owned_count integer;
begin
  select count(*) into owned_count
  from public.links
  where user_id = (select auth.uid())
    and tag = tag_arg;

  if owned_count <> coalesce(array_length(ordered_link_ids, 1), 0)
    or owned_count <> (
      select count(distinct requested.id)
      from unnest(ordered_link_ids) as requested(id)
    )
    or exists (
      select 1
      from unnest(ordered_link_ids) as requested(id)
      where not exists (
        select 1
        from public.links
        where links.id = requested.id
          and links.user_id = (select auth.uid())
          and links.tag = tag_arg
      )
    ) then
    raise exception 'link list does not match tag' using errcode = '22023';
  end if;

  update public.links
  set position = ordered.position - 1
  from unnest(ordered_link_ids) with ordinality as ordered(id, position)
  where links.id = ordered.id
    and links.user_id = (select auth.uid());
end;
$$;

revoke execute on function public.reorder_links(text, uuid[]) from public, anon;
grant execute on function public.reorder_links(text, uuid[]) to authenticated;
