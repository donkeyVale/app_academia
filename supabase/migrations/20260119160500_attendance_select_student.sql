-- Allow students to read their own attendance rows

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance'
      and policyname = 'attendance select own student'
  ) then
    create policy "attendance select own student"
    on public.attendance
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.students s
        where s.id = attendance.student_id
          and s.user_id = auth.uid()
      )
    );
  end if;
end $$;
