alter table public.sat_profiles
  add column test_dates date[] not null default '{}'::date[];

update public.sat_profiles
set test_dates = array[test_date]
where test_date is not null
  and cardinality(test_dates) = 0;

alter table public.sat_profiles
  add constraint sat_profiles_test_dates_limit
  check (cardinality(test_dates) <= 12);

alter table public.sat_mistakes
  drop constraint if exists sat_mistakes_section_check;

alter table public.sat_mistakes
  alter column section drop not null,
  alter column skill drop not null;
