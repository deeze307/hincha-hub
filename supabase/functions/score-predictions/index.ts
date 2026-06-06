// @ts-nocheck  — Deno globals not available in local TS checker; works fine on Supabase
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
  isEarly:  boolean,
  cfg:      ScoringCfg,
): number {
  const exactHome  = homePred === homeReal
  const exactAway  = awayPred === awayReal

  if (exactHome && exactAway)
    return isEarly ? cfg.early_exact : cfg.late_exact

  const predWinner  = Math.sign(homePred - awayPred)
  const realWinner  = Math.sign(homeReal - awayReal)
  const winnerMatch = predWinner === realWinner

  if (winnerMatch && (exactHome || exactAway))
    return isEarly ? cfg.early_winner_goals : cfg.late_winner_goals

  if (winnerMatch)
    return isEarly ? cfg.early_winner : cfg.late_winner

  if (exactHome || exactAway)
    return isEarly ? cfg.early_goals : cfg.late_goals

  return 0
}

Deno.serve(async () => {
  try {
    // 1. Cargar configuración de puntuación
    const { data: cfgRow } = await supabase
      .from('scoring_config')
      .select('*')
      .limit(1)
      .single()

    const cfg: ScoringCfg = cfgRow ?? DEFAULT_CFG
    const earlyCutoffMs   = (cfg.early_cutoff_hours ?? 24) * 3_600_000

    // 2. Predicciones completadas (paginadas — evita el límite implícito de 1000 filas
    //    de PostgREST, que antes truncaba la lista de partidos y dejaba sin puntuar
    //    los más recientes una vez superados los 1000 partidos finalizados en la BD).
    const preds: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error: pErr } = await supabase
        .from('match_predictions')
        .select('id, user_id, tournament_id, match_id, home_prediction, away_prediction, predicted_at, push_notified')
        .not('home_prediction', 'is', null)
        .not('away_prediction', 'is', null)
        .range(from, from + 999)
      if (pErr) throw pErr
      if (!data?.length) break
      preds.push(...data)
      if (data.length < 1000) break
    }

    if (!preds.length) {
      return new Response(JSON.stringify({ ok: true, updated: 0, message: 'No predictions to score' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Resultados de los partidos efectivamente predichos (en lotes para acotar la
    //    query a lo que realmente se necesita, sin depender del total global de partidos).
    const predictedMatchIds = [...new Set(preds.map((p: any) => p.match_id))]
    const matchMap = new Map<string, any>()
    for (let i = 0; i < predictedMatchIds.length; i += 300) {
      const chunk = predictedMatchIds.slice(i, i + 300)
      const { data, error: mErr } = await supabase
        .from('competition_matches')
        .select('id, home_score, away_score, match_date')
        .in('id', chunk)
        .in('status', ['FT', 'AET', 'PEN'])
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
      if (mErr) throw mErr
      for (const m of (data ?? [])) matchMap.set(m.id, m)
    }

    // 4. Solo se puntúan predicciones cuyo partido ya finalizó
    const scorablePreds = preds.filter((p: any) => matchMap.has(p.match_id))
    if (!scorablePreds.length) {
      return new Response(JSON.stringify({ ok: true, updated: 0, message: 'No finished matches to score' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 5. Calcular puntos con lógica early/late
    const rows = scorablePreds.map((p: any) => {
      const match      = matchMap.get(p.match_id)!
      const matchDate  = match.match_date ? new Date(match.match_date).getTime() : null
      const predictedAt = p.predicted_at  ? new Date(p.predicted_at).getTime()  : 0

      // isEarly: la predicción fue hecha con al menos early_cutoff_hours de anticipación
      const isEarly = matchDate != null
        ? (matchDate - predictedAt) >= earlyCutoffMs
        : true  // sin fecha de partido → puntos completos

      return {
        id:              p.id,
        user_id:         p.user_id,
        tournament_id:   p.tournament_id,
        match_id:        p.match_id,
        home_prediction: p.home_prediction,
        away_prediction: p.away_prediction,
        points_earned:   calcPoints(
          p.home_prediction, p.away_prediction,
          match.home_score, match.away_score,
          isEarly, cfg,
        ),
        updated_at: new Date().toISOString(),
        // predicted_at NO se incluye para preservar el tiempo de modificación del usuario
      }
    })

    // 5. Upsert
    const { error: uErr } = await supabase
      .from('match_predictions')
      .upsert(rows, { onConflict: 'id' })

    if (uErr) throw uErr

    const breakdown: Record<string, number> = {}
    rows.forEach((r: any) => {
      const k = `${r.points_earned}pts`
      breakdown[k] = (breakdown[k] ?? 0) + 1
    })

    // ── Bonus predictions scoring ──────────────────────────────────────────
    // Points per rank: rank1=10, rank2=5, rank3=3
    const BONUS_RANK_PTS: Record<number, number> = { 1: 10, 2: 5, 3: 3 }

    const { data: awardResults, error: arErr } = await supabase
      .from('award_results')
      .select('tournament_id, award_type, team_id, player_id')

    if (arErr) throw arErr

    let bonusUpdated = 0

    if (awardResults?.length) {
      // Fetch all bonus_predictions for tournaments that have award results
      const tournamentIds = [...new Set(awardResults.map((a: any) => a.tournament_id))]

      const { data: bonusPreds, error: bpErr } = await supabase
        .from('bonus_predictions')
        .select('id, user_id, tournament_id, type, rank, team_id, player_id')
        .in('tournament_id', tournamentIds)

      if (bpErr) throw bpErr

      if (bonusPreds?.length) {
        // Build a lookup: "tournamentId:awardType" → { team_id, player_id }
        const awardMap = new Map<string, { team_id: string | null; player_id: string | null }>()
        for (const a of awardResults) {
          awardMap.set(`${a.tournament_id}:${a.award_type}`, {
            team_id:   a.team_id,
            player_id: a.player_id,
          })
        }

        const bonusRows = bonusPreds.map((bp: any) => {
          const award = awardMap.get(`${bp.tournament_id}:${bp.type}`)
          let pts = 0
          if (award) {
            const teamMatch   = award.team_id   && bp.team_id   && award.team_id   === bp.team_id
            const playerMatch = award.player_id && bp.player_id && award.player_id === bp.player_id
            if (teamMatch || playerMatch) {
              pts = BONUS_RANK_PTS[bp.rank] ?? 0
            }
          }
          return {
            id:            bp.id,
            user_id:       bp.user_id,
            tournament_id: bp.tournament_id,
            type:          bp.type,
            rank:          bp.rank,
            team_id:       bp.team_id,
            player_id:     bp.player_id,
            points_earned: pts,
            updated_at:    new Date().toISOString(),
          }
        })

        const { error: buErr } = await supabase
          .from('bonus_predictions')
          .upsert(bonusRows, { onConflict: 'id' })

        if (buErr) throw buErr
        bonusUpdated = bonusRows.length
      }
    }

    // ── Push notifications por puntos ──────────────────────────────────────
    // Solo predicciones que aún no fueron notificadas y que ganaron puntos
    const toNotify = rows.filter((r: any) => r.points_earned > 0 && !preds.find((p: any) => p.id === r.id)?.push_notified)

    if (toNotify.length > 0) {
      // Enriquecer con nombres de equipos
      const notifyMatchIds = [...new Set(toNotify.map((r: any) => r.match_id))]
      const { data: matchDetails } = await supabase
        .from('competition_matches')
        .select('id, home_team:home_team_id(name), away_team:away_team_id(name)')
        .in('id', notifyMatchIds)

      const matchDetailMap = new Map((matchDetails ?? []).map((m: any) => [m.id, m]))

      // Agrupar puntos por usuario
      const byUser = new Map<string, { pts: number; matches: string[] }>()
      for (const r of toNotify) {
        const entry = byUser.get(r.user_id) ?? { pts: 0, matches: [] }
        entry.pts += r.points_earned
        const md = matchDetailMap.get(r.match_id)
        const homeName = md?.home_team?.name
        const awayName = md?.away_team?.name
        if (homeName && awayName) {
          entry.matches.push(`${homeName} vs ${awayName}`)
        }
        byUser.set(r.user_id, entry)
      }

      // Obtener usuarios con push_enabled = true
      const notifyUserIds = [...byUser.keys()]
      const { data: enabledProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('push_enabled', true)
        .in('id', notifyUserIds)
      const enabledIds = (enabledProfiles ?? []).map((p: any) => p.id)

      const { data: pushSubs } = enabledIds.length
        ? await supabase
            .from('push_subscriptions')
            .select('user_id, endpoint, p256dh, auth')
            .in('user_id', enabledIds)
        : { data: [] }

      if (pushSubs?.length) {
        // Importar web-push dinámicamente
        const webpush = (await import('https://esm.sh/web-push@3.6.7')).default
        webpush.setVapidDetails(
          `mailto:${Deno.env.get('VAPID_EMAIL')}`,
          Deno.env.get('VAPID_PUBLIC_KEY')!,
          Deno.env.get('VAPID_PRIVATE_KEY')!,
        )

        await Promise.allSettled(
          pushSubs.map((sub: any) => {
            const { pts, matches } = byUser.get(sub.user_id)!
            const matchText = matches.length === 1
              ? `tu predicción de ${matches[0]}`
              : `${matches.length} predicciones`
            return webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({
                title: `¡Sumaste ${pts} punto${pts !== 1 ? 's' : ''}!`,
                body:  `Por ${matchText}`,
                url:   '/partidos',
              }),
            )
          })
        )
      }

      // Marcar predicciones como notificadas
      const notifyIds = toNotify.map((r: any) => r.id)
      await supabase
        .from('match_predictions')
        .update({ push_notified: true })
        .in('id', notifyIds)
    }

    return new Response(
      JSON.stringify({ ok: true, updated: rows.length, bonusUpdated, breakdown }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
