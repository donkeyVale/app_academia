create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications select own" on public.notifications;
drop policy if exists "notifications update own" on public.notifications;

create policy "notifications select own" on public.notifications
for select
using (auth.uid() = user_id);

create policy "Users can update their own notifications"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own notifications"
on public.notifications
for delete
using (auth.uid() = user_id);
