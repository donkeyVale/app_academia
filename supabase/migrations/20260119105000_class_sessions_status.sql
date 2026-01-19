do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'class_sessions'
      and column_name = 'status'
  ) then
    alter table public.class_sessions
      add column status text not null default 'active';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_sessions_status_check'
  ) then
    alter table public.class_sessions
      add constraint class_sessions_status_check
      check (status in ('active', 'cancelled'));
  end if;
end $$;
