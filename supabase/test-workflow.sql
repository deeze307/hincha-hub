-- ═══════════════════════════════════════════════════════════════════════════
-- WORKFLOW DE PRUEBA — Mundial 2022 (o cualquier torneo histórico)
-- Ejecutar los pasos en orden desde el SQL Editor de Supabase
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── PASO 0: Ver competencias existentes ────────────────────────────────────
SELECT id, name, external_id, season_year, country
FROM competitions
ORDER BY season_year DESC, name;
-- Si no existe el Mundial 2022, ejecutar PASO 0b. Si ya existe, saltar al PASO 1.


-- ─── PASO 0b: Insertar la competencia Mundial 2022 ──────────────────────────
-- external_id = 1 es FIFA World Cup en API-Football
-- Solo ejecutar si NO existe todavía
INSERT INTO competitions (name, external_id, season_year, country, logo_url, start_date, end_date)
VALUES ('FIFA World Cup', 1, 2022, 'World', 'https://media.api-sports.io/football/leagues/1.png', '2022-11-20', '2022-12-18')
ON CONFLICT DO NOTHING;

-- Anotar el id generado para usar en los siguientes pasos:
SELECT id, name, external_id, season_year FROM competitions WHERE external_id = 1 AND season_year = 2022;


-- ─── PASO 1: Después de correr sync-fixtures-test ───────────────────────────
-- Verificar que los partidos se sincronizaron correctamente
-- Reemplazar <competition_id> con el UUID del paso anterior

SELECT round, count(*) as total,
       count(*) FILTER (WHERE status IN ('FT','AET','PEN')) as finalizados,
       count(*) FILTER (WHERE home_score IS NULL) as sin_resultado
FROM competition_matches
WHERE competition_id = '6477cb02-7d5b-490d-95cc-096569ca92b5'
GROUP BY round
ORDER BY min(round_order);


-- ─── PASO 2: Unlock — limpiar scores para poder predecir ────────────────────
-- Guarda los scores reales antes de limpiarlos (para restaurar después)
CREATE TEMP TABLE IF NOT EXISTS match_scores_backup AS
SELECT id, external_id, home_score, away_score, home_penalties, away_penalties,
       winner_team_id, status
FROM competition_matches
WHERE competition_id = '<competition_id>'
  AND status IN ('FT', 'AET', 'PEN');

-- Opcionalmente: solo desbloquear una ronda específica para una prueba más acotada
-- Ej: desbloquear solo la Final o los partidos de grupo
UPDATE competition_matches
SET    home_score     = NULL,
       away_score     = NULL,
       home_penalties = NULL,
       away_penalties = NULL,
       winner_team_id = NULL,
       status         = 'NS'
WHERE  competition_id = '<competition_id>'
  AND  status IN ('FT', 'AET', 'PEN');
-- AND round = 'Final'   -- ← Descomentar para solo desbloquear la Final

-- Confirmar
SELECT count(*) as partidos_desbloqueados
FROM competition_matches
WHERE competition_id = '<competition_id>' AND status = 'NS';


-- ─── PASO 3: Hacer las predicciones desde la UI ─────────────────────────────
-- (Ambos usuarios entran a la app y cargan sus predicciones normalmente)
-- Verificar que se guardaron:
SELECT p.display_name, count(*) as predicciones
FROM match_predictions mp
JOIN profiles p ON p.id = mp.user_id
WHERE mp.tournament_id = '<tournament_id>'
GROUP BY p.display_name;


-- ─── PASO 4: Restaurar scores reales ────────────────────────────────────────
-- Opción A (recomendada): Volver a llamar sync-fixtures-test → restaura todo desde la API
-- Opción B: Restaurar desde el backup local (si no quieres hacer otra llamada a la API)
UPDATE competition_matches cm
SET home_score     = b.home_score,
    away_score     = b.away_score,
    home_penalties = b.home_penalties,
    away_penalties = b.away_penalties,
    winner_team_id = b.winner_team_id,
    status         = b.status
FROM match_scores_backup b
WHERE cm.id = b.id;

-- Confirmar restauración
SELECT count(*) as partidos_con_resultado
FROM competition_matches
WHERE competition_id = '<competition_id>'
  AND status IN ('FT','AET','PEN');


-- ─── PASO 5: Después de correr score-predictions-test ───────────────────────
-- La function devuelve el JSON con el detalle. Además verificar en DB:

SELECT
  p.display_name,
  SUM(mp.points_earned)                                                AS total_pts,
  COUNT(*)                                                             AS predicciones,
  COUNT(*) FILTER (WHERE mp.points_earned = 12)                       AS exactos_early,
  COUNT(*) FILTER (WHERE mp.points_earned = 6)                        AS exactos_late,
  COUNT(*) FILTER (WHERE mp.points_earned IN (8,4))                   AS ganador_gol,
  COUNT(*) FILTER (WHERE mp.points_earned IN (6,3))                   AS ganador,
  COUNT(*) FILTER (WHERE mp.points_earned IN (2,1))                   AS un_gol,
  COUNT(*) FILTER (WHERE mp.points_earned = 0)                        AS cero
FROM match_predictions mp
JOIN profiles p ON p.id = mp.user_id
WHERE mp.tournament_id = '<tournament_id>'
GROUP BY p.display_name
ORDER BY total_pts DESC;


-- ─── PASO 5b: Ver detalle por partido ───────────────────────────────────────
SELECT
  p.display_name,
  m.round,
  ht.name AS home_team,
  at.name AS away_team,
  mp.home_prediction || '-' || mp.away_prediction AS prediccion,
  m.home_score || '-' || m.away_score             AS resultado,
  mp.points_earned                                AS pts,
  mp.predicted_at
FROM match_predictions mp
JOIN profiles p              ON p.id  = mp.user_id
JOIN competition_matches m   ON m.id  = mp.match_id
JOIN teams ht                ON ht.id = m.home_team_id
JOIN teams at                ON at.id = m.away_team_id
WHERE mp.tournament_id = '<tournament_id>'
ORDER BY p.display_name, m.round_order, m.match_date;


-- ─── LIMPIEZA OPCIONAL: Borrar predicciones del torneo de prueba ─────────────
-- Solo si querés resetear y volver a probar desde cero
-- DELETE FROM match_predictions WHERE tournament_id = '<tournament_id>';
-- DELETE FROM bonus_predictions   WHERE tournament_id = '<tournament_id>';
