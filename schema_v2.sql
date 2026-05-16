-- ============================================================
-- HinchaHub — Migraciones v2
-- Ejecutar en Supabase > SQL Editor DESPUÉS del schema.sql original
-- ============================================================

-- 1. Role en profiles
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin', 'superadmin'));

-- Asignar superadmin al usuario principal
update public.profiles
set role = 'superadmin'
from auth.users
where profiles.id = auth.users.id
  and auth.users.email = 'deeze.designs@gmail.com';


-- 2. Competitions (cache de API-Football, solo lectura para clientes)
create table if not exists public.competitions (
  id           uuid    primary key default gen_random_uuid(),
  external_id  integer not null,
  name         text    not null,
  logo_url     text,
  country      text,
  country_flag text,
  season_year  integer not null,
  start_date   date    not null,
  end_date     date,
  synced_at    timestamptz default now(),
  unique(external_id, season_year)
);

alter table public.competitions enable row level security;
create policy "competitions_select" on public.competitions for select using (true);


-- 3. Extender tournaments con los nuevos campos
alter table public.tournaments
  add column if not exists image_url       text,
  add column if not exists access_type     text not null default 'open'
    check (access_type in ('open', 'request')),
  add column if not exists max_participants integer,
  add column if not exists created_by      uuid references auth.users(id),
  add column if not exists competition_id  uuid references public.competitions(id),
  add column if not exists updated_at      timestamptz default now();

-- Solo superadmin puede crear torneos
create policy "tournaments_insert" on public.tournaments for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin')
  );

-- El creador puede actualizar solo nombre, descripción e imagen
create policy "tournaments_update" on public.tournaments for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);


-- 4. Join requests
create table if not exists public.join_requests (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id)  on delete cascade not null,
  user_id       uuid references auth.users(id)          on delete cascade not null,
  status        text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at    timestamptz default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references auth.users(id),
  unique(tournament_id, user_id)
);

alter table public.join_requests enable row level security;

-- El solicitante ve sus propias; el admin del torneo y el superadmin ven todas las del torneo
create policy "requests_select" on public.join_requests for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.tournaments where id = tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles   where id = auth.uid() and role = 'superadmin')
  );

create policy "requests_insert" on public.join_requests for insert
  with check (auth.uid() = user_id);

create policy "requests_update" on public.join_requests for update
  using (
    exists (select 1 from public.tournaments where id = tournament_id and created_by = auth.uid())
    or exists (select 1 from public.profiles   where id = auth.uid() and role = 'superadmin')
  );


-- 5. Agregar score exacto a predictions
alter table public.predictions
  add column if not exists home_score_prediction integer,
  add column if not exists away_score_prediction integer;

-- Función para calcular puntos (3 = exacto, 1 = resultado, 0 = error)
create or replace function public.calculate_prediction_points(
  pred_home    integer,
  pred_away    integer,
  actual_home  integer,
  actual_away  integer
) returns integer language plpgsql as $$
declare
  pred_result   text;
  actual_result text;
begin
  -- Determinar resultado predicho
  if    pred_home > pred_away   then pred_result := '1';
  elsif pred_home < pred_away   then pred_result := '2';
  else                               pred_result := 'X';
  end if;

  -- Determinar resultado real
  if    actual_home > actual_away then actual_result := '1';
  elsif actual_home < actual_away then actual_result := '2';
  else                                 actual_result := 'X';
  end if;

  -- Score exacto
  if pred_home = actual_home and pred_away = actual_away then return 3; end if;
  -- Resultado correcto
  if pred_result = actual_result then return 1; end if;
  return 0;
end;
$$;


-- 6. Storage RLS para tournament-images (el bucket ya fue creado manualmente)
create policy "tournament_images_read" on storage.objects
  for select using (bucket_id = 'tournament-images');

create policy "tournament_images_upload" on storage.objects
  for insert with check (
    bucket_id = 'tournament-images'
    and auth.role() = 'authenticated'
  );

create policy "tournament_images_update" on storage.objects
  for update using (
    bucket_id = 'tournament-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- 7. pg_cron: llamar a la Edge Function cada 15 minutos
-- REEMPLAZÁ PROJECT_REF y SERVICE_ROLE_KEY antes de ejecutar
-- (o usá el scheduler del dashboard de Supabase — más fácil)
/*
select cron.schedule(
  'sync-competitions-15min',
  '* /15 * * * *',
  $$
  select net.http_post(
    url     := 'https://PROJECT_REF.supabase.co/functions/v1/sync-competitions',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
*/
