// @ts-nocheck
// ─── score-predictions-test ───────────────────────────────────────────────────
// Igual a score-predictions pero filtrado a un solo torneo y con output detallado.
// Uso: POST /functions/v1/score-predictions-test  { "tournament_id": "<uuid>" }
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface ScoringCfg {
  early_cutoff_hours: number
  early_exact:        number
  early_winner_goals: number
  early_winner:       number
  early_goals:        number
  late_exact:         number
  late_winner_goals:  number
  late_winner:        number
  late_goals:         number
}

const DEFAULT_CFG: ScoringCfg = {
  early_cutoff_hours: 24,
  early_exact:        12,
  early_winner_goals: 8,
  early_winner:       6,
  early_goals:        2,
  late_exact:         6,
  late_winner_goals:  4,
  late_winner:        3,
  late_goals:         1,
}

function calcPoints(
  homePred: number, awayPred: number,
  homeReal: number, awayReal: number,
  isEarly: boolean, cfg: ScoringCfg,
): number {
  if (homePred === homeReal && awayPred === awayReal)
    return isEarly ? cfg.early_exact : cfg.late_exact

  const predWinner  = Math.sign(homePred - awayPred)
  const realWinner  = Math.sign(homeReal - awayReal)
  const winnerMatch = predWinner === realWinner

  if (winnerMatch && (homePred === homeReal || awayPred === awayReal))
    return isEarly ? cfg.early_winner_goals : cfg.late_winner_goals

  if (winnerMatch)
    return isEarly ? cfg.early_winner : cfg.late_winner

  if (homePred === homeReal || awayPred === awayReal)
    return isEarly ? cfg.early_goals : cfg.late_goals

  return 0
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const { tournament_id } = body

    if (!tournament_id) {
      return new Response(
        JSON.stringify({ error: 'Falta tournament_id en el body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Verificar que existe el torneo
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, name, competition_id')
      .eq('id', tournament_id)
      .single()

    if (tErr || !tournament) {
      return new Response(
        JSON.stringify({ error: 'Torneo no encontrado' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Configuración de puntuación
    const { data: cfgRow } = await supabase
      .from('scoring_config').select('*').limit(1).single()
    const cfg: ScoringCfg = cfgRow ?? DEFAULT_CFG
    const earlyCutoffMs   = (cfg.early_cutoff_hours ?? 24) * 3_600_000

    // Partidos finalizados de la competencia de este torneo
    const { data: matches, error: mErr } = await supabase
      .from('competition_matches')
      .select('id, home_score, away_score, match_date, round, home_team_id, away_team_id')
      .eq('competition_id', tournament.competition_id)
      .in('status', ['FT', 'AET', 'PEN'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    if (mErr) throw mErr
    if (!matches?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No hay partidos finalizados en esta competencia', tournament: tournament.name }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    const matchIds = matches.map((m: any) => m.id)
    const matchMap = new Map(matches.map((m: any) => [m.id, m]))

    // Predicciones solo de este torneo
    const { data: preds, error: pErr } = await supabase
      .from('match_predictions')
      .select('id, user_id, tournament_id, match_id, home_prediction, away_prediction, predicted_at, points_earned')
      .eq('tournament_id', tournament_id)
      .in('match_id', matchIds)
      .not('home_prediction', 'is', null)
      .not('away_prediction', 'is', null)

    if (pErr) throw pErr
    if (!preds?.length) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No hay predicciones para este torneo', tournament: tournament.name }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Resolver nombres de usuarios para el output
    const userIds = [...new Set(preds.map((p: any) => p.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds)
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.display_name]))

    // Resolver nombres de equipos para el output
    const teamIds = [...new Set(matches.flatMap(m => [m.home_team_id, m.away_team_id]).filter(Boolean))]
    const { data: teams } = await supabase
      .from('teams').select('id, name').in('id', teamIds)
    const teamNameMap = new Map((teams ?? []).map(t => [t.id, t.name]))

    // Calcular y preparar rows
    const rows = preds.map((p: any) => {
      const match      = matchMap.get(p.match_id)!
      const matchDate  = match.match_date ? new Date(match.match_date).getTime() : null
      const predictedAt = p.predicted_at  ? new Date(p.predicted_at).getTime()  : 0
      const isEarly    = matchDate != null ? (matchDate - predictedAt) >= earlyCutoffMs : true
      const pts        = calcPoints(p.home_prediction, p.away_prediction, match.home_score, match.away_score, isEarly, cfg)

      return {
        row: {
          id:              p.id,
          user_id:         p.user_id,
          tournament_id:   p.tournament_id,
          match_id:        p.match_id,
          home_prediction: p.home_prediction,
          away_prediction: p.away_prediction,
          points_earned:   pts,
          updated_at:      new Date().toISOString(),
        },
        // Info para el output (no se graba)
        debug: {
          user:       profileMap.get(p.user_id) ?? p.user_id,
          round:      match.round,
          home_team:  teamNameMap.get(match.home_team_id) ?? '?',
          away_team:  teamNameMap.get(match.away_team_id) ?? '?',
          pred:       `${p.home_prediction}-${p.away_prediction}`,
          real:       `${match.home_score}-${match.away_score}`,
          is_early:   isEarly,
          pts_before: p.points_earned,
          pts_after:  pts,
        },
      }
    })

    // Upsert
    const { error: uErr } = await supabase
      .from('match_predictions')
      .upsert(rows.map(r => r.row), { onConflict: 'id' })

    if (uErr) throw uErr

    // Resumen por usuario
    const userTotals: Record<string, { name: string; total: number; detail: object[] }> = {}
    for (const { row, debug } of rows) {
      const uid = row.user_id
      if (!userTotals[uid]) userTotals[uid] = { name: debug.user, total: 0, detail: [] }
      userTotals[uid].total += row.points_earned
      userTotals[uid].detail.push({
        match:    `${debug.home_team} vs ${debug.away_team} (${debug.round})`,
        pred:     debug.pred,
        real:     debug.real,
        early:    debug.is_early,
        pts:      row.points_earned,
      })
    }

    return new Response(
      JSON.stringify({
        ok:         true,
        tournament: tournament.name,
        scored:     rows.length,
        results:    Object.values(userTotals).sort((a, b) => b.total - a.total),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
