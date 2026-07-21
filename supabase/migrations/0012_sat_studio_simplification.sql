alter table public.sat_mistakes
  add column screenshot_path text;

create table public.sat_practice_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  test_date date not null,
  total_score integer not null check (total_score between 400 and 1600),
  math_score integer not null check (math_score between 200 and 800),
  reading_writing_score integer not null check (reading_writing_score between 200 and 800),
  created_at timestamptz not null default now(),
  check (total_score = math_score + reading_writing_score)
);

create index sat_practice_tests_user_date_idx
  on public.sat_practice_tests (user_id, test_date desc);

alter table public.sat_practice_tests enable row level security;

create policy "sat practice tests select own" on public.sat_practice_tests
  for select using ((select auth.uid()) = user_id);
create policy "sat practice tests insert own" on public.sat_practice_tests
  for insert with check ((select auth.uid()) = user_id);
create policy "sat practice tests update own" on public.sat_practice_tests
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "sat practice tests delete own" on public.sat_practice_tests
  for delete using ((select auth.uid()) = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'sat-mistakes',
  'sat-mistakes',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "sat mistake screenshots select own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sat-mistakes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "sat mistake screenshots insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sat-mistakes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "sat mistake screenshots delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sat-mistakes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
