alter table if exists public.class_sessions
  add column if not exists attendance_pending boolean not null default false;
