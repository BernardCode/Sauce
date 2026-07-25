do $$
declare
  table_name text;
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach table_name in array array[
      'blocks',
      'course_defaults',
      'events',
      'habit_logs',
      'habits',
      'items',
      'links',
      'notes',
      'planner_runs',
      'sat_mistakes',
      'sat_practice_tests',
      'sat_profiles',
      'sat_sessions',
      'sources',
      'users'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          table_name
        );
      end if;
    end loop;
  end if;
end
$$;
