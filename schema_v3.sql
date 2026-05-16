-- ============================================================
-- schema_v3.sql  — Prode completo: equipos, jugadores, partidos,
--                  predicciones y bonus
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. TEAMS
-- ─────────────────────────────────────────
create table if not exists teams (
  id           uuid primary key default gen_random_uuid(),
  external_id  int  not null,
  name         text not null,
  logo_url     text,
  country      text,
  type         text not null default 'club'
               check (type in ('national', 'club')),
  created_at   timestamptz default now()
);
create unique index if not exists teams_external_id_idx on teams (external_id);

-- RLS
alter table teams enable row level security;
create policy "teams_public_read" on teams for select using (true);
create policy "teams_service_write" on teams for all using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- 2. PLAYERS
-- ─────────────────────────────────────────
create table if not exists players (
  id             uuid primary key default gen_random_uuid(),
  external_id    int  not null,
  competition_id uuid not null references competitions (id) on delete cascade,
  name           text not null,
  photo_url      text,
  nationality    text,
  flag_url       text,
  team_id        uuid references teams (id) on delete set null,
  position       text,
  updated_at     timestamptz default now(),
  unique (external_id, competition_id)   -- mismo jugador puede aparecer en distintas competencias
);

alter table players enable row level security;
create policy "players_public_read" on players for select using (true);
create policy "players_service_write" on players for all using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- 3. COMPETITION_MATCHES
-- ─────────────────────────────────────────
create table if not exists competition_matches (
  id             uuid primary key default gen_random_uuid(),
  external_id    int  not null unique,
  competition_id uuid not null references competitions (id) on delete cascade,
  season_year    int  not null,

  -- Clasificación del partido
  round          text not null,          -- 'Group Stage', 'Round of 32', 'Round of 16', etc.
  round_order    int  not null default 1, -- 1=grupos, 2=R32, 3=R16, 4=QF, 5=SF, 6=3er puesto, 7=Final
  group_name     text,                   -- 'Group A' … NULL en eliminatoria

  -- Equipos
  home_team_id   uuid references teams (id),
  away_team_id   uuid references teams (id),

  -- Resultado real (NULL = no jugado)
  home_score     int,
  away_score     int,
  home_penalties int,
  away_penalties int,
  winner_team_id uuid references teams (id),

  -- Meta
  match_date     timestamptz,
  status         text default 'NS',      -- NS, 1H, HT, 2H, ET, P, FT, AET, PEN
  matchday       int,
  bracket_slot   int,                    -- orden dentro del bracket eliminatorio

  updated_at     timestamptz default now()
);

create index if not exists matches_competition_idx on competition_matches (competition_id, season_year);
create index if not exists matches_group_idx        on competition_matches (competition_id, group_name);
create index if not exists matches_round_idx        on competition_matches (competition_id, round_order);

alter table competition_matches enable row level security;
create policy "matches_public_read"   on competition_matches for select using (true);
create policy "matches_service_write" on competition_matches for all using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- 4. MATCH_PREDICTIONS
-- ─────────────────────────────────────────
create table if not exists match_predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  tournament_id    uuid not null references tournaments (id) on delete cascade,
  match_id         uuid not null references competition_matches (id) on delete cascade,

  home_prediction  int,
  away_prediction  int,
  points_earned    int,   -- NULL hasta que el partido finalice

  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),

  unique (user_id, tournament_id, match_id)
);

create index if not exists mp_user_tournament_idx on match_predictions (user_id, tournament_id);

alter table match_predictions enable row level security;
-- Usuario solo ve/edita sus propias predicciones
create policy "mp_own_read"   on match_predictions for select using (auth.uid() = user_id);
create policy "mp_own_insert" on match_predictions for insert with check (auth.uid() = user_id);
create policy "mp_own_update" on match_predictions for update using (auth.uid() = user_id);
create policy "mp_service"    on match_predictions for all using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- 5. BONUS_PREDICTIONS
-- ─────────────────────────────────────────
create table if not exists bonus_predictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  tournament_id uuid not null references tournaments (id) on delete cascade,

  type          text not null check (type in ('champion', 'top_scorer')),
  rank          int  not null check (rank in (1, 2, 3)),

  -- Para champion: team_id; para top_scorer: player_id
  team_id       uuid references teams   (id) on delete set null,
  player_id     uuid references players (id) on delete set null,

  -- Texto libre como fallback / display
  team_name     text,
  player_name   text,

  points_earned int,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  unique (user_id, tournament_id, type, rank)
);

alter table bonus_predictions enable row level security;
create policy "bp_own_read"   on bonus_predictions for select using (auth.uid() = user_id);
create policy "bp_own_insert" on bonus_predictions for insert with check (auth.uid() = user_id);
create policy "bp_own_update" on bonus_predictions for update using (auth.uid() = user_id);
create policy "bp_service"    on bonus_predictions for all using (auth.role() = 'service_role');

-- ─────────────────────────────────────────
-- 6. EXTEND TOURNAMENTS
-- ─────────────────────────────────────────
alter table tournaments
  add column if not exists team_type          text default 'club'
    check (team_type in ('national', 'club')),
  add column if not exists prediction_deadline timestamptz,
  add column if not exists prode_config        jsonb default '{}'::jsonb;

-- prode_config shape:
-- {
--   "direct_qualifiers": 2,      -- top N de cada grupo clasifican directo
--   "best_third_count":  8,      -- mejores 3eros que también clasifican (0 = ninguno)
--   "has_knockout":      true,
--   "has_bonus":         true,
--   "tiebreakers":       ["points","gd","gf","h2h"]
-- }

-- ─────────────────────────────────────────
-- 7. FUNCIÓN: calcular puntos de predicción de partido
-- ─────────────────────────────────────────
create or replace function calculate_match_prediction_points(
  p_home_pred int, p_away_pred int,
  p_home_real int, p_away_real int
) returns int language plpgsql immutable as $$
begin
  if p_home_pred is null or p_away_pred is null
  or p_home_real is null or p_away_real is null then
    return null;
  end if;

  -- Resultado exacto → 3 pts
  if p_home_pred = p_home_real and p_away_pred = p_away_real then
    return 3;
  end if;

  -- Resultado correcto (local gana / empate / visitante gana) → 1 pt
  if sign(p_home_pred - p_away_pred) = sign(p_home_real - p_away_real) then
    return 1;
  end if;

  return 0;
end;
$$;

-- ─────────────────────────────────────────
-- 8. FUNCIÓN: calcular puntos bonus
-- ─────────────────────────────────────────
create or replace function bonus_points_for_rank(p_rank int) returns int
language sql immutable as $$
  select case p_rank when 1 then 10 when 2 then 5 when 3 then 3 else 0 end;
$$;
