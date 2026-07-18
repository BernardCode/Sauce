alter table public.habits
  add column if not exists scheduled_time time;

comment on column public.habits.scheduled_time is
  'Optional local wall-clock time used to place the habit on the calendar.';
