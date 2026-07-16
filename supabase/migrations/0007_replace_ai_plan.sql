-- Milestone 4: replace future AI blocks and record planner runs in one
-- transaction. Only the server-side service role may call this function.

create function public.replace_ai_plan(
  target_user_id uuid,
  replaceable_block_ids uuid[],
  new_blocks jsonb,
  run_rows jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  written integer;
begin
  if jsonb_typeof(new_blocks) <> 'array' or jsonb_typeof(run_rows) <> 'array' then
    raise exception 'plan payloads must be arrays' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(new_blocks) as proposed(
      item_id uuid,
      title text,
      start_at timestamptz,
      end_at timestamptz,
      reason text
    )
    left join public.items item
      on item.id = proposed.item_id
      and item.user_id = target_user_id
    where item.id is null
      or item.status <> 'open'
      or item.is_project
      or proposed.end_at <= proposed.start_at
      or proposed.end_at - proposed.start_at > interval '3 hours'
      or length(trim(proposed.title)) = 0
      or length(trim(proposed.reason)) < 10
  ) then
    raise exception 'plan payload failed database validation' using errcode = '22023';
  end if;

  delete from public.blocks
  where user_id = target_user_id
    and id = any(replaceable_block_ids)
    and origin = 'ai'
    and not locked
    and not done;

  insert into public.blocks (
    user_id,
    item_id,
    title,
    start_at,
    end_at,
    origin,
    locked,
    done,
    reason
  )
  select
    target_user_id,
    proposed.item_id,
    proposed.title,
    proposed.start_at,
    proposed.end_at,
    'ai',
    false,
    false,
    proposed.reason
  from jsonb_to_recordset(new_blocks) as proposed(
    item_id uuid,
    title text,
    start_at timestamptz,
    end_at timestamptz,
    reason text
  );

  get diagnostics written = row_count;

  insert into public.planner_runs (
    user_id,
    plan_date,
    ran_at,
    blocks_written,
    rejections_json
  )
  select
    target_user_id,
    run.plan_date,
    now(),
    run.blocks_written,
    run.rejections_json
  from jsonb_to_recordset(run_rows) as run(
    plan_date date,
    blocks_written integer,
    rejections_json jsonb
  )
  on conflict (user_id, plan_date) do update set
    ran_at = excluded.ran_at,
    blocks_written = excluded.blocks_written,
    rejections_json = excluded.rejections_json;

  return written;
end;
$$;

revoke execute on function public.replace_ai_plan(uuid, uuid[], jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_ai_plan(uuid, uuid[], jsonb, jsonb)
  to service_role;
