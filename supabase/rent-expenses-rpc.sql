-- RPC: calcular egresos por alquiler de cancha (por sede) para una academia y un rango
-- Reglas:
-- - Solo computa clases con al menos 1 booking
-- - Override por cancha (court_rent_fees) > tarifa base por sede (location_rent_fees)
-- - Respeta vigencia: valid_from <= class_date AND (valid_to IS NULL OR class_date < valid_to)

create or replace function public.get_rent_expenses(
  academy_id uuid,
  from_date date,
  to_date date
)
returns table (
  location_id uuid,
  location_name text,
  classes_count integer,
  rent_total numeric
)
language sql
stable
as $$
  with academy_courts as (
    select c.id as court_id, c.location_id
    from public.academy_locations al
    join public.courts c on c.location_id = al.location_id
    where al.academy_id = get_rent_expenses.academy_id
  ),
  classes_in_range as (
    select cs.id as class_id,
           cs.court_id,
           cs.date::date as class_day
    from public.class_sessions cs
    join academy_courts ac on ac.court_id = cs.court_id
    where cs.date::date >= get_rent_expenses.from_date
      and cs.date::date <= get_rent_expenses.to_date
      and exists (
        select 1 from public.bookings b where b.class_id = cs.id
      )
  ),
  class_costs as (
    select
      cir.class_id,
      ac.location_id,
      cir.class_day,
      coalesce(
        (
          select crf.fee_per_class
          from public.court_rent_fees crf
          where crf.academy_id = get_rent_expenses.academy_id
            and crf.court_id = cir.court_id
            and crf.valid_from <= cir.class_day
            and (crf.valid_to is null or cir.class_day < crf.valid_to)
          order by crf.valid_from desc
          limit 1
        ),
        (
          select lrf.fee_per_class
          from public.location_rent_fees lrf
          where lrf.academy_id = get_rent_expenses.academy_id
            and lrf.location_id = ac.location_id
            and lrf.valid_from <= cir.class_day
            and (lrf.valid_to is null or cir.class_day < lrf.valid_to)
          order by lrf.valid_from desc
          limit 1
        ),
        0
      ) as rent_fee
    from classes_in_range cir
    join academy_courts ac on ac.court_id = cir.court_id
  )
  select
    cc.location_id,
    l.name as location_name,
    count(*)::int as classes_count,
    sum(cc.rent_fee)::numeric as rent_total
  from class_costs cc
  join public.locations l on l.id = cc.location_id
  group by cc.location_id, l.name
  order by rent_total desc;
$$;
