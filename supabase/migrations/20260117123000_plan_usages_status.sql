-- Add status lifecycle to plan_usages so usage is confirmed by attendance (or explicitly refunded)

alter table public.plan_usages
  add column if not exists status text not null default 'confirmed',
  add column if not exists confirmed_at timestamp with time zone,
  add column if not exists refunded_at timestamp with time zone;

-- Ensure all existing rows are treated as already-confirmed usage
update public.plan_usages
set status = 'confirmed',
    confirmed_at = coalesce(confirmed_at, used_at)
where status is null
   or status not in ('pending','confirmed','refunded');

alter table public.plan_usages
  add constraint plan_usages_status_check
  check (status in ('pending','confirmed','refunded'));

create index if not exists plan_usages_status_idx on public.plan_usages (status);

-- Remaining classes should consider committed usages (pending + confirmed)
create or replace function public.get_students_remaining_classes(p_academy_id uuid)
returns table(student_id uuid, remaining integer)
language sql
stable
security definer
set search_path = public
as $$
  with academy_students as (
    select s.id as student_id
    from public.students s
    join public.user_academies ua on ua.user_id = s.user_id
    where ua.academy_id = p_academy_id
      and ua.is_active = true
  ),
  usage_counts as (
    select pu.student_plan_id, pu.student_id, count(*)::int as used
    from public.plan_usages pu
    where pu.status in ('pending','confirmed')
    group by pu.student_plan_id, pu.student_id
  )
  select
    a.student_id,
    coalesce(
      sum(
        greatest(
          (sp.remaining_classes::int - coalesce(uc.used, 0)),
          0
        )
      )::int,
      0
    ) as remaining
  from academy_students a
  left join public.student_plans sp on sp.student_id = a.student_id
  left join usage_counts uc on uc.student_plan_id = sp.id and uc.student_id = a.student_id
  group by a.student_id;
$$;

revoke all on function public.get_students_remaining_classes(uuid) from public;
grant execute on function public.get_students_remaining_classes(uuid) to authenticated;
