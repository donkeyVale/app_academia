alter table public.notification_events
  add column if not exists class_id uuid;

-- Para eventos que no son de planes (p.ej. recordatorios de clase)
alter table public.notification_events
  alter column student_plan_id drop not null;

-- Permite deduplicar recordatorios de clases por alumno+clase+tipo
drop index if exists public.notification_events_student_class_event_uidx;

create unique index if not exists notification_events_student_class_event_uidx
  on public.notification_events (student_id, class_id, event_type);
