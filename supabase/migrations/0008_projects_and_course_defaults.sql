-- Milestone 6: learned course estimates and atomic project decomposition.

create table public.course_defaults (
  user_id uuid not null references public.users (id) on delete cascade,
  course text not null,
  default_minutes integer not null check (default_minutes > 0),
  sample_count integer not null default 0 check (sample_count >= 0),
  primary key (user_id, course)
);

alter table public.course_defaults enable row level security;

create policy "course defaults select own" on public.course_defaults
  for select using ((select auth.uid()) = user_id);
create policy "course defaults insert own" on public.course_defaults
  for insert with check ((select auth.uid()) = user_id);
create policy "course defaults update own" on public.course_defaults
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "course defaults delete own" on public.course_defaults
  for delete using ((select auth.uid()) = user_id);

create or replace function public.record_block_work(
  block_id uuid,
  work_minutes integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_item_id uuid;
  linked_course text;
begin
  if work_minutes < 1 or work_minutes > 1440 then
    raise exception 'work_minutes must be between 1 and 1440'
      using errcode = '22023';
  end if;

  update public.blocks
  set actual_minutes = coalesce(actual_minutes, 0) + work_minutes
  where id = block_id
    and user_id = (select auth.uid())
  returning item_id into linked_item_id;

  if not found then
    raise exception 'block not found' using errcode = '42501';
  end if;

  if linked_item_id is not null then
    update public.items
    set
      actual_minutes = coalesce(actual_minutes, 0) + work_minutes,
      remaining_minutes = case
        when coalesce(remaining_minutes, est_minutes) is null then null
        else greatest(
          0,
          coalesce(remaining_minutes, est_minutes) - work_minutes
        )
      end
    where id = linked_item_id
      and user_id = (select auth.uid())
    returning course into linked_course;

    if not found then
      raise exception 'linked item not found' using errcode = '42501';
    end if;

    if linked_course is not null and length(trim(linked_course)) > 0 then
      insert into public.course_defaults (
        user_id,
        course,
        default_minutes,
        sample_count
      )
      values ((select auth.uid()), linked_course, work_minutes, 1)
      on conflict (user_id, course) do update
      set
        default_minutes = round(
          (
            public.course_defaults.default_minutes
            * public.course_defaults.sample_count
            + excluded.default_minutes
          )::numeric
          / (public.course_defaults.sample_count + 1)
        )::integer,
        sample_count = public.course_defaults.sample_count + 1;
    end if;
  end if;
end;
$$;

create function public.replace_ai_project_steps(
  target_user_id uuid,
  target_project_id uuid,
  replaceable_step_ids uuid[],
  new_steps jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
begin
  if not exists (
    select 1
    from public.items
    where id = target_project_id
      and user_id = target_user_id
      and is_project = true
      and status = 'open'
  ) then
    raise exception 'project not found' using errcode = '22023';
  end if;

  delete from public.items
  where id = any(replaceable_step_ids)
    and user_id = target_user_id
    and parent_id = target_project_id
    and origin = 'ai'
    and coalesce(actual_minutes, 0) = 0;

  insert into public.items (
    user_id,
    parent_id,
    title,
    due_at,
    est_minutes,
    remaining_minutes,
    step_order,
    origin,
    status
  )
  select
    target_user_id,
    target_project_id,
    value->>'title',
    (value->>'suggested_due')::timestamptz,
    (value->>'est_minutes')::integer,
    (value->>'est_minutes')::integer,
    (value->>'step_order')::integer,
    'ai',
    'open'
  from jsonb_array_elements(new_steps);

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke execute on function public.replace_ai_project_steps(
  uuid, uuid, uuid[], jsonb
) from public, anon, authenticated;
grant execute on function public.replace_ai_project_steps(
  uuid, uuid, uuid[], jsonb
) to service_role;

create function public.reorder_project_steps(
  project_id_arg uuid,
  ordered_step_ids uuid[]
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
  from public.items
  where parent_id = project_id_arg
    and user_id = (select auth.uid());

  if owned_count <> coalesce(array_length(ordered_step_ids, 1), 0)
    or owned_count <> (
      select count(distinct requested.id)
      from unnest(ordered_step_ids) as requested(id)
    )
    or exists (
      select 1
      from unnest(ordered_step_ids) as requested(id)
      where not exists (
        select 1
        from public.items
        where items.id = requested.id
          and items.parent_id = project_id_arg
          and items.user_id = (select auth.uid())
      )
    ) then
    raise exception 'step list does not match project' using errcode = '22023';
  end if;

  update public.items
  set
    step_order = ordered.position - 1,
    origin = 'manual'
  from unnest(ordered_step_ids) with ordinality as ordered(id, position)
  where items.id = ordered.id
    and items.user_id = (select auth.uid());
end;
$$;

revoke execute on function public.reorder_project_steps(uuid, uuid[])
  from public, anon;
grant execute on function public.reorder_project_steps(uuid, uuid[])
  to authenticated;
