-- Milestone 2: record a work session atomically so block and item totals
-- cannot drift apart when one update fails.

create function public.record_block_work(block_id uuid, work_minutes integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_item_id uuid;
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
      and user_id = (select auth.uid());

    if not found then
      raise exception 'linked item not found' using errcode = '42501';
    end if;
  end if;
end;
$$;

revoke execute on function public.record_block_work(uuid, integer)
  from public, anon;
grant execute on function public.record_block_work(uuid, integer)
  to authenticated;
