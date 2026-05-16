-- ============================================================
-- HinchaHub — Schema completo
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. PERFILES (extiende auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Trigger: crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. TORNEOS
create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  description text,
  entry_fee   integer default 0,   -- en pesos argentinos
  prize_pool  integer default 0,
  status      text default 'upcoming' check (status in ('upcoming','active','finished')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz default now()
);

-- Torneo inicial: Mundial 2026
insert into public.tournaments (name, slug, description, entry_fee, status, starts_at, ends_at)
values (
  'Mundial 2026',
  'mundial-2026',
  'Copa del Mundo FIFA 2026 — USA, Canadá y México',
  2000,
  'upcoming',
  '2026-06-11 00:00:00+00',
  '2026-07-19 23:59:59+00'
);


-- 3. PARTIDOS
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  home_team     text not null,
  home_flag     text,
  away_team     text not null,
  away_flag     text,
  match_date    timestamptz not null,
  group_name    text,
  round         text default 'group' check (round in ('group','round_of_32','round_of_16','quarter','semi','final')),
  status        text default 'pending' check (status in ('pending','live','finished')),
  home_score    integer,
  away_score    integer,
  lock_at       timestamptz not null,  -- cierre de predicciones (= inicio del partido)
  created_at    timestamptz default now()
);


-- 4. PREDICCIONES
create table public.predictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  match_id      uuid references public.matches(id) on delete cascade,
  prediction    text not null check (prediction in ('1','X','2')),
  points_earned integer,              -- null = partido no jugado aún
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(user_id, match_id)
);

-- Trigger: actualizar updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger predictions_updated_at
  before update on public.predictions
  for each row execute procedure public.set_updated_at();


-- 5. INSCRIPCIONES A TORNEOS
create table public.tournament_registrations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  paid          boolean default false,
  payment_id    text,                 -- referencia de MercadoPago
  registered_at timestamptz default now(),
  unique(user_id, tournament_id)
);


-- 6. VISTA: STANDINGS (posiciones por torneo)
create or replace view public.standings as
select
  p.user_id,
  m.tournament_id,
  pr.full_name,
  pr.username,
  coalesce(sum(p.points_earned), 0)                                     as total_points,
  count(*) filter (where p.points_earned > 0)                           as correct_predictions,
  count(*)                                                               as total_predictions
from public.predictions p
join public.matches m on m.id = p.match_id
join public.profiles pr on pr.id = p.user_id
where p.points_earned is not null
group by p.user_id, m.tournament_id, pr.full_name, pr.username;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles                  enable row level security;
alter table public.tournaments               enable row level security;
alter table public.matches                   enable row level security;
alter table public.predictions               enable row level security;
alter table public.tournament_registrations  enable row level security;

-- Profiles: todos leen, cada uno edita el suyo
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Torneos y partidos: lectura pública
create policy "tournaments_select" on public.tournaments for select using (true);
create policy "matches_select"     on public.matches     for select using (true);

-- Predicciones:
--   · Insertar/actualizar solo si el partido no está cerrado (lock_at en el futuro)
--   · Leer las propias siempre; leer las ajenas solo si el partido ya cerró
create policy "predictions_insert" on public.predictions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches where id = match_id and lock_at > now()
    )
  );

create policy "predictions_update" on public.predictions for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches where id = match_id and lock_at > now()
    )
  );

create policy "predictions_select_own"   on public.predictions for select
  using (auth.uid() = user_id);

create policy "predictions_select_after_lock" on public.predictions for select
  using (
    exists (
      select 1 from public.matches where id = match_id and lock_at <= now()
    )
  );

-- Inscripciones: solo ver/insertar las propias
create policy "registrations_select" on public.tournament_registrations for select
  using (auth.uid() = user_id);
create policy "registrations_insert" on public.tournament_registrations for insert
  with check (auth.uid() = user_id);
