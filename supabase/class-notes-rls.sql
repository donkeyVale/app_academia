alter table public.class_notes enable row level security;

drop policy if exists "class_notes admin select" on public.class_notes;
drop policy if exists "class_notes admin insert" on public.class_notes;
drop policy if exists "class_notes admin update" on public.class_notes;
drop policy if exists "class_notes coach select" on public.class_notes;
drop policy if exists "class_notes coach insert" on public.class_notes;
drop policy if exists "class_notes coach update" on public.class_notes;
drop policy if exists "class_notes student select" on public.class_notes;

create policy "class_notes admin select" on public.class_notes
for select
using (
  exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role::text = 'admin' or p.role::text = 'super_admin')
  )
);

create policy "class_notes admin insert" on public.class_notes
for insert
with check (
  exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role::text = 'admin' or p.role::text = 'super_admin')
  )
);

create policy "class_notes admin update" on public.class_notes
for update
using (
  exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role::text = 'admin' or p.role::text = 'super_admin')
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role::text = 'admin' or p.role::text = 'super_admin')
  )
);

create policy "class_notes coach select" on public.class_notes
for select
using (
  (
    coach_id is not null
    and coach_id = (select c.id from public.coaches c where c.user_id = auth.uid() limit 1)
  )
  or (
    coach_id is null
    and visible_to_coach = true
  )
);

create policy "class_notes coach insert" on public.class_notes
for insert
with check (
  coach_id is not null
  and coach_id = (select c.id from public.coaches c where c.user_id = auth.uid() limit 1)
);

create policy "class_notes coach update" on public.class_notes
for update
using (
  coach_id is not null
  and coach_id = (select c.id from public.coaches c where c.user_id = auth.uid() limit 1)
)
with check (
  coach_id is not null
  and coach_id = (select c.id from public.coaches c where c.user_id = auth.uid() limit 1)
);

create policy "class_notes student select" on public.class_notes
for select
using (
  student_id = (select s.id from public.students s where s.user_id = auth.uid() limit 1)
  and visible_to_student = true
);
