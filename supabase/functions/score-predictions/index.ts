// @ts-nocheck  — Deno globals not available in local TS checker; works fine on Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function calcPoints(
  homePred: number, awayPred: number,
  homeReal: number, awayReal: number,
): number {
  if (homePred === homeReal && awayPred === awayReal) return 3
  return Math.sign(homePred - awayPred) === Math.sign(homeReal - awayReal) ? 1 : 0
}

Deno.serve(async () => {
  try {
    // 1. Todos los partidos finalizados con resultado
    const { data: matches, error: mErr } = await supabase
      .from('competition_matches')
      .select('id, home_score, away_score')
      .in('status', ['FT', 'AET', 'PEN'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    if (mErr) throw mErr
    if (!matches?.length) {
      return new Response(JSON.stringify({ ok: true, updated: 0, message: 'No finished matches' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const matchIds  = matches.map((m: any) => m.id)
    const scoreMap  = new Map(matches.map((m: any) => [m.id, { home: m.home_score as number, away: m.away_score as number }]))

    // 2. Predicciones completadas para esos partidos
    const { data: preds, error: pErr } = await supabase
      .from('match_predictions')
      .select('id, user_id, tournament_id, match_id, home_prediction, away_prediction')
      .in('match_id', matchIds)
      .not('home_prediction', 'is', null)
      .not('away_prediction', 'is', null)

    if (pErr) throw pErr
    if (!preds?.length) {
      return new Response(JSON.stringify({ ok: true, updated: 0, message: 'No predictions to score' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Calcular puntos y preparar upsert
    const rows = preds.map((p: any) => {
      const s = scoreMap.get(p.match_id)!
      return {
        id:              p.id,
        user_id:         p.user_id,
        tournament_id:   p.tournament_id,
        match_id:        p.match_id,
        home_prediction: p.home_prediction,
        away_prediction: p.away_prediction,
        points_earned:   calcPoints(p.home_prediction, p.away_prediction, s.home, s.away),
        updated_at:      new Date().toISOString(),
      }
    })

    // 4. Upsert — actualiza points_earned en las predicciones existentes
    const { error: uErr } = await supabase
      .from('match_predictions')
      .upsert(rows, { onConflict: 'id' })

    if (uErr) throw uErr

    const breakdown = { '3pts': 0, '1pt': 0, '0pts': 0 }
    rows.forEach((r: any) => {
      if (r.points_earned === 3) breakdown['3pts']++
      else if (r.points_earned === 1) breakdown['1pt']++
      else breakdown['0pts']++
    })

    return new Response(
      JSON.stringify({ ok: true, updated: rows.length, breakdown }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
