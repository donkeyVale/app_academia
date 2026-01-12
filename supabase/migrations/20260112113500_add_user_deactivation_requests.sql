create extension if not exists pgcrypto;

create table if not exists public.user_deactivation_requests (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id),
  target_user_id uuid not null,
  requested_by_user_id uuid not null,
  reason text null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by_user_id uuid null
);

create index if not exists user_deactivation_requests_target_idx
  on public.user_deactivation_requests(target_user_id);

create index if not exists user_deactivation_requests_academy_idx
  on public.user_deactivation_requests(academy_id);

create unique index if not exists user_deactivation_requests_unique_pending
  on public.user_deactivation_requests(academy_id, target_user_id)
  where status = 'pending';
