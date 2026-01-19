-- Add metadata and uniqueness to attendance to support upsert + traceability

alter table public.attendance
  add column if not exists marked_by_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_marked_by_user_id_fkey'
  ) then
    alter table public.attendance
      add constraint attendance_marked_by_user_id_fkey
      foreign key (marked_by_user_id)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists attendance_unique_class_student
  on public.attendance (class_id, student_id);
