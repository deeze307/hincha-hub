create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  type       text not null check (type in ('prediction', 'league', 'system')),
  text       text not null,
  read       boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "select own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "update own" on public.notifications
  for update using (auth.uid() = user_id);

-- Notificación de prueba (reemplazá el UUID por el tuyo)
-- insert into notifications (user_id, type, text)
-- values ('TU-USER-ID', 'system', 'Bienvenido a HinchaHub 🎉');
