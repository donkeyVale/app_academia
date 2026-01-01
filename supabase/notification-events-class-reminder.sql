alter table public.notification_events
  add column if not exists class_id uuid;

-- Permite deduplicar recordatorios de clases por alumno+clase+tipo
create unique index if not exists notification_events_student_class_event_uidx
  on public.notification_events (student_id, class_id, event_type)
  where class_id is not null;
