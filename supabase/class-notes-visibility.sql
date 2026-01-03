alter table public.class_notes
  add column if not exists visible_to_student boolean not null default false;

alter table public.class_notes
  add column if not exists visible_to_coach boolean not null default true;

update public.class_notes
set
  visible_to_student = true,
  visible_to_coach = true;
