alter table public.notification_events
  add column if not exists user_id uuid;

alter table public.notification_events
  add column if not exists event_date date;

-- Para eventos que no aplican a planes/alumnos específicos (p.ej. avisos a admins por academia)
alter table public.notification_events
  alter column student_id drop not null;

-- Dedupe: notificación al cumpleañero (1 por usuario por día)
drop index if exists public.notification_events_user_event_date_uidx;
create unique index if not exists notification_events_user_event_date_uidx
  on public.notification_events (user_id, event_type, event_date);

-- Dedupe: aviso a admins por academia (1 por academia por día)
drop index if exists public.notification_events_academy_event_date_uidx;
create unique index if not exists notification_events_academy_event_date_uidx
  on public.notification_events (academy_id, event_type, event_date);
