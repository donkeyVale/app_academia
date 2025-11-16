-- Roles
create type app_role as enum ('admin','coach','student');

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role app_role not null default 'student',
  created_at timestamptz default now()
);

-- Alumnos/Coaches
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  level text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  specialty text,
  created_at timestamptz default now()
);

-- Sedes/Cancha
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete cascade,
  name text not null
);

-- Clases y reservas
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  date timestamptz not null,
  type text not null,
  capacity int not null default 1,
  coach_id uuid references public.coaches(id),
  court_id uuid references public.courts(id),
  price_cents int not null default 0,
  currency text not null default 'PYG'
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.class_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  status text not null default 'reserved',
  created_at timestamptz default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.class_sessions(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  present boolean not null default false,
  marked_at timestamptz default now()
);

-- Finanzas básicas
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  classes_included int not null,
  price_cents int not null,
  currency text not null default 'PYG',
  expires_days int
);

create table if not exists public.student_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  plan_id uuid references public.plans(id),
  remaining_classes int not null,
  purchased_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  amount_cents int not null,
  currency text not null default 'PYG',
  method text not null default 'manual',
  reference text,
  created_at timestamptz default now(),
  status text not null default 'paid'
);

-- RLS
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.coaches enable row level security;
alter table public.locations enable row level security;
alter table public.courts enable row level security;
alter table public.class_sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.attendance enable row level security;
alter table public.plans enable row level security;
alter table public.student_plans enable row level security;
alter table public.payments enable row level security;

-- Políticas mínimas
create policy "profiles self" on public.profiles for select using (auth.uid() = id);
create policy "admins read all profiles" on public.profiles for select using (
  exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
