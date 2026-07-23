-- Keep the Today list limited to work intentionally chosen for one date.

alter table public.items
  add column if not exists planned_date date;

create index if not exists items_user_planned_date_idx
  on public.items (user_id, status, planned_date)
  where planned_date is not null;
