-- Option A: new plan_usages should start pending; existing data stays confirmed

alter table public.plan_usages
  alter column status set default 'pending';

-- Backfill any unexpected values defensively
update public.plan_usages
set status = 'confirmed'
where status is null
   or status not in ('pending','confirmed','refunded');

update public.plan_usages
set confirmed_at = coalesce(confirmed_at, used_at)
where status = 'confirmed'
  and confirmed_at is null;
