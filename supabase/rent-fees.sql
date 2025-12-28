create table if not exists public.location_rent_fees (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  fee_per_class numeric(12,2) not null,
  currency text not null default 'PYG',
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint location_rent_fees_fee_nonnegative check (fee_per_class >= 0),
  constraint location_rent_fees_valid_range check (valid_to is null or valid_to > valid_from)
);

create table if not exists public.court_rent_fees (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  fee_per_class numeric(12,2) not null,
  currency text not null default 'PYG',
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint court_rent_fees_fee_nonnegative check (fee_per_class >= 0),
  constraint court_rent_fees_valid_range check (valid_to is null or valid_to > valid_from)
);

create index if not exists idx_location_rent_fees_academy_location on public.location_rent_fees (academy_id, location_id);
create index if not exists idx_location_rent_fees_valid_from on public.location_rent_fees (valid_from);
create index if not exists idx_court_rent_fees_academy_court on public.court_rent_fees (academy_id, court_id);
create index if not exists idx_court_rent_fees_valid_from on public.court_rent_fees (valid_from);

-- Asegura como máximo 1 tarifa activa (valid_to IS NULL) por academia+sede/cancha
create unique index if not exists uq_location_rent_fees_active
  on public.location_rent_fees (academy_id, location_id)
  where valid_to is null;

create unique index if not exists uq_court_rent_fees_active
  on public.court_rent_fees (academy_id, court_id)
  where valid_to is null;
