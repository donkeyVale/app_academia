-- RPC para obtener cuántas clases le quedan a cada alumno dentro de una academia
-- Multiacademia: solo alumnos cuyo user_id está activo en user_academies para academy_id.

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
