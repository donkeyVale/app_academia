-- Allow admin/coach/super_admin to update attendance rows (required for upsert to persist edits)

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'attendance'
      and policyname = 'attendance update admin/coach'
  ) then
    create policy "attendance update admin/coach"
    on public.attendance
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = any (array['admin'::public.app_role, 'coach'::public.app_role, 'super_admin'::public.app_role])
      )
    )
    with check (
      exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = any (array['admin'::public.app_role, 'coach'::public.app_role, 'super_admin'::public.app_role])
      )
    );
  end if;
end $$;
