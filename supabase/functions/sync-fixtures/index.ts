// @ts-nocheck  — Deno globals not available in local TS checker; works fine on Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const API_KEY  = Deno.env.get('API_FOOTBALL_KEY')!
const API_BASE = 'https://v3.football.api-sports.io'

const ROUND_ORDER: Record<string, number> = {
  'Group Stage':       1,
  'Round of 32':       2,
  'Round of 16':       3,
  'Quarter-finals':    4,
  'Semi-finals':       5,
  '3rd Place Final':   6,
  'Final':             7,
}

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY, 'x-apisports-language': 'es' },
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

// "Group Stage" pelado (sin letra) es la tabla general que devuelve API-Football
// junto a las tablas por grupo; no es un grupo real y no debe usarse como group_name.
const isPseudoGroupName = (g: string | null | undefined): boolean =>
  !!g && (g.toLowerCase().includes('ranking') || g.toLowerCase().includes('third'))

const isRealGroupName = (g: string | null | undefined): boolean =>
  !!g && g.trim() !== 'Group Stage' && !isPseudoGroupName(g)

// Trae /standings: deriva el mapa teamExternalId → groupName Y guarda la tabla de
// posiciones real en competition_standings (reemplazando la anterior).
async function syncStandings(
  leagueId: number, season: number, competitionId: string,
): Promise<Map<number, string>> {
  const groupMap = new Map<number, string>()
  try {
    const data = await apiFetch(`/standings?league=${leagueId}&season=${season}`)
    const standings = data?.response?.[0]?.league?.standings ?? []

    // Si hay grupos reales (Group A, B…) guardamos por grupo; si no, una sola tabla.
    const hasRealGroups = standings.some((g: any[]) => g.some((e: any) => isRealGroupName(e.group)))

    const rows: object[] = []
    for (const group of standings) {
      for (const entry of group) {
        if (!entry.team?.id) continue
        if (isRealGroupName(entry.group)) groupMap.set(entry.team.id, entry.group)
        if (isPseudoGroupName(entry.group)) continue
        if (hasRealGroups && !isRealGroupName(entry.group)) continue  // saltear tabla general

        rows.push({
          competition_id:   competitionId,
          season_year:      season,
          group_name:       isRealGroupName(entry.group) ? entry.group : null,
          rank:             entry.rank ?? 0,
          team_external_id: entry.team.id,
          team_name:        entry.team.name ?? null,
          team_logo_url:    entry.team.logo ?? null,
          played:           entry.all?.played ?? 0,
          win:              entry.all?.win    ?? 0,
          draw:             entry.all?.draw   ?? 0,
          lose:             entry.all?.lose   ?? 0,
          goals_for:        entry.all?.goals?.for     ?? 0,
          goals_against:    entry.all?.goals?.against ?? 0,
          points:           entry.points ?? 0,
          updated_at:       new Date().toISOString(),
        })
      }
    }

    await supabase.from('competition_standings')
      .delete().eq('competition_id', competitionId).eq('season_year', season)
    if (rows.length) {
      const { error } = await supabase.from('competition_standings').insert(rows)
      if (error) console.error('standings insert error:', error)
    }
  } catch (e) {
    console.error('standings sync failed:', e)
  }
  return groupMap
}

// Guarda el top 10 de goles / asistencias / amarillas / rojas en competition_player_stats.
async function syncPlayerStats(
  leagueId: number, season: number, competitionId: string,
): Promise<void> {
  const endpoints = [
    { type: 'goals',        path: 'topscorers',     pick: (s: any) => s?.goals?.total },
    { type: 'assists',      path: 'topassists',     pick: (s: any) => s?.goals?.assists },
    { type: 'yellow_cards', path: 'topyellowcards', pick: (s: any) => s?.cards?.yellow },
    { type: 'red_cards',    path: 'topredcards',    pick: (s: any) => s?.cards?.red },
  ]

  const rows: object[] = []
  for (const ep of endpoints) {
    try {
      const data = await apiFetch(`/players/${ep.path}?league=${leagueId}&season=${season}`)
      const list = (data?.response ?? []).slice(0, 10)
      list.forEach((item: any, i: number) => {
        const st = item.statistics?.[0] ?? {}
        rows.push({
          competition_id:     competitionId,
          season_year:        season,
          stat_type:          ep.type,
          rank:               i + 1,
          player_external_id: item.player?.id ?? null,
          player_name:        item.player?.name ?? null,
          player_photo_url:   item.player?.photo ?? null,
          team_name:          st.team?.name ?? null,
          team_logo_url:      st.team?.logo ?? null,
          value:              ep.pick(st) ?? 0,
          updated_at:         new Date().toISOString(),
        })
      })
    } catch (e) {
      console.error(`stats ${ep.type} sync failed:`, e)
    }
  }

  await supabase.from('competition_player_stats')
    .delete().eq('competition_id', competitionId).eq('season_year', season)
  if (rows.length) {
    const { error } = await supabase.from('competition_player_stats').insert(rows)
    if (error) console.error('player_stats insert error:', error)
  }
}

Deno.serve(async (_req) => {
  try {
    // 1. Obtener todas las competencias con torneos activos
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('competition_id, team_type, competitions(external_id, season_year, is_test)')
      .not('competition_id', 'is', null)

    if (!tournaments?.length) {
      return new Response(JSON.stringify({ message: 'No active tournaments' }), { status: 200 })
    }

    // Deduplicate por competition_id
    const seen = new Set<string>()
    const competitions = tournaments
      .filter(t => {
        if (!t.competition_id || seen.has(t.competition_id)) return false
        if ((t.competitions as any)?.is_test) return false
        seen.add(t.competition_id)
        return true
      })
      .map(t => ({
        competitionId: t.competition_id as string,
        externalId:    (t.competitions as any)?.external_id as number,
        seasonYear:    (t.competitions as any)?.season_year as number,
        teamType:      (t as any).team_type ?? 'club',
      }))
      .filter(c => c.externalId && c.seasonYear)

    // Agregar competiciones featured que no estén ya cubiertas por torneos
    const { data: featuredComps } = await supabase
      .from('competitions')
      .select('id, external_id, season_year')
      .eq('featured', true)
      .not('is_test', 'is', true)

    for (const fc of (featuredComps ?? [])) {
      if (!fc.id || seen.has(fc.id)) continue
      seen.add(fc.id)
      competitions.push({
        competitionId: fc.id,
        externalId:    fc.external_id,
        seasonYear:    fc.season_year,
        teamType:      'national',
      })
    }

    let totalUpserted = 0

    for (const comp of competitions) {
      // 2. Posiciones reales (deriva grupos y guarda la tabla) + estadísticas de jugadores
      const groupMap = await syncStandings(comp.externalId, comp.seasonYear, comp.competitionId)
      console.log(`Group map size for league ${comp.externalId}:`, groupMap.size)
      await syncPlayerStats(comp.externalId, comp.seasonYear, comp.competitionId)

      // 3. Obtener fixture de API-Football
      const data = await apiFetch(
        `/fixtures?league=${comp.externalId}&season=${comp.seasonYear}`
      )

      const fixtures = data?.response ?? []
      if (!fixtures.length) continue

      // 4a. Upsert equipos desde el fixture (ignoreDuplicates para no pisar datos de sync-squads)
      const uniqueTeams = new Map<number, object>()
      for (const f of fixtures) {
        for (const side of ['home', 'away'] as const) {
          const t = f.teams?.[side]
          if (t?.id && t?.name && !uniqueTeams.has(t.id)) {
            uniqueTeams.set(t.id, {
              external_id: t.id,
              name:        t.name,
              logo_url:    t.logo ?? null,
              type:        comp.teamType,
            })
          }
        }
      }
      if (uniqueTeams.size > 0) {
        const { error: teamsErr } = await supabase
          .from('teams')
          .upsert([...uniqueTeams.values()], { onConflict: 'external_id', ignoreDuplicates: true })
        if (teamsErr) console.error('Teams upsert error:', teamsErr)
      }

      // 4b. Resolver team_ids en Supabase
      const teamExternalIds = [...uniqueTeams.keys()]

      const { data: dbTeams } = await supabase
        .from('teams')
        .select('id, external_id')
        .in('external_id', teamExternalIds)

      const teamMap = new Map((dbTeams ?? []).map(t => [t.external_id, t.id]))

      // 5. Preparar upsert
      const rows = fixtures.map((f: any) => {
        const round    = f.league?.round ?? 'Unknown'
        const isGroup  = round.toLowerCase().includes('group')

        // Detecta si un group_name es un "pseudo-grupo" de la API (no un grupo real)
        const isPseudoGroup = (g: string) =>
          g.toLowerCase().includes('ranking') || g.toLowerCase().includes('third')

        // group_name: primero intentar el formato "Group A" directo en el round,
        // sino usar el mapa de standings por equipo local
        let groupName: string | null = null
        if (isGroup) {
          const directMatch = round.match(/\bGroup\s+([A-Z])\b/)
          if (directMatch) {
            groupName = `Group ${directMatch[1].toUpperCase()}`
          } else {
            const mapped = groupMap.get(f.teams?.home?.id) ?? null
            if (mapped && !isPseudoGroup(mapped)) groupName = mapped
          }
        }

        // Fallback: si ambos equipos comparten el mismo grupo real en standings,
        // asignarlo aunque el round diga otra cosa (ej: "Ranking of third-placed teams")
        if (groupName === null) {
          const homeGroup = groupMap.get(f.teams?.home?.id)
          const awayGroup = groupMap.get(f.teams?.away?.id)
          if (homeGroup && homeGroup === awayGroup && !isPseudoGroup(homeGroup)) {
            groupName = homeGroup
          }
        }

        // Si el round es un "ranking de terceros" y no encontramos grupo real,
        // marcar como grupo provisional para no perder el partido de la vista
        const isRankingRound = isPseudoGroup(round)
        if (groupName === null && isRankingRound) {
          groupName = 'Ranking of third-placed teams'
        }

        // Si detectamos grupo por fallback, tratar el partido como fase de grupos
        const effectiveRound = groupName !== null
          ? 'Group Stage'
          : (Object.keys(ROUND_ORDER).find(k =>
              round.toLowerCase().includes(k.toLowerCase())
            ) ?? round)
        const roundOrder = ROUND_ORDER[effectiveRound] ?? 1

        const homeWon     = f.teams?.home?.winner === true
        const awayWon     = f.teams?.away?.winner === true
        const winnerExtId = homeWon ? f.teams.home.id : awayWon ? f.teams.away.id : null

        return {
          external_id:    f.fixture.id,
          competition_id: comp.competitionId,
          season_year:    comp.seasonYear,
          round:          effectiveRound,
          round_order:    roundOrder,
          group_name:     groupName,
          match_date:     f.fixture.date,
          home_team_id:   teamMap.get(f.teams?.home?.id) ?? null,
          away_team_id:   teamMap.get(f.teams?.away?.id) ?? null,
          home_score:     f.goals?.home ?? null,
          away_score:     f.goals?.away ?? null,
          home_penalties: f.score?.penalty?.home ?? null,
          away_penalties: f.score?.penalty?.away ?? null,
          winner_team_id: winnerExtId ? (teamMap.get(winnerExtId) ?? null) : null,
          status:         f.fixture?.status?.short ?? 'NS',
          matchday:       f.league?.round ? parseInt(f.league.round.replace(/\D/g, '')) || null : null,
          updated_at:     new Date().toISOString(),
        }
      })

      const { error } = await supabase
        .from('competition_matches')
        .upsert(rows, { onConflict: 'external_id' })

      if (error) throw error
      totalUpserted += rows.length

      // ── Post-proceso: reasignar el grupo correcto a partidos de fase de grupos
      // mal etiquetados (group_name NULL, "Group Stage" sin letra, o pseudo-grupo).
      // Cada equipo juega en un único grupo, así que derivamos su grupo real de los
      // partidos que SÍ tienen un grupo válido y corregimos el resto. Se auto-corrige
      // a medida que la tabla de posiciones se va completando.
      const { data: groupStageMatches } = await supabase
        .from('competition_matches')
        .select('id, home_team_id, away_team_id, group_name')
        .eq('competition_id', comp.competitionId)
        .eq('round', 'Group Stage')

      const teamToGroup = new Map<string, string>()
      for (const m of groupStageMatches ?? []) {
        if (isRealGroupName(m.group_name)) {
          if (m.home_team_id) teamToGroup.set(m.home_team_id, m.group_name)
          if (m.away_team_id) teamToGroup.set(m.away_team_id, m.group_name)
        }
      }

      for (const m of groupStageMatches ?? []) {
        if (isRealGroupName(m.group_name)) continue
        const grp = teamToGroup.get(m.home_team_id) ?? teamToGroup.get(m.away_team_id)
        if (grp && grp !== m.group_name) {
          await supabase
            .from('competition_matches')
            .update({ group_name: grp })
            .eq('id', m.id)
        }
      }

      // ── Auto-sync de award_results para bonus automáticos ──────────────
      // Solo para torneos de esta competencia que tengan esos bonus activos.
      const { data: compTournaments } = await supabase
        .from('tournaments')
        .select('id, prode_config')
        .eq('competition_id', comp.competitionId)

      for (const tournament of compTournaments ?? []) {
        const bonusTypes: string[] = tournament.prode_config?.bonus_types ?? []
        const awardRows: object[]  = []

        // Campeón: equipo que ganó la Final
        if (bonusTypes.includes('champion')) {
          const { data: finalMatch } = await supabase
            .from('competition_matches')
            .select('winner_team_id')
            .eq('competition_id', comp.competitionId)
            .eq('round', 'Final')
            .in('status', ['FT', 'AET', 'PEN'])
            .not('winner_team_id', 'is', null)
            .limit(1)
            .maybeSingle()

          if (finalMatch?.winner_team_id) {
            const { data: winTeam } = await supabase
              .from('teams')
              .select('id, name, logo_url')
              .eq('id', finalMatch.winner_team_id)
              .maybeSingle()

            if (winTeam) {
              awardRows.push({
                tournament_id: tournament.id,
                award_type:    'champion',
                team_id:       winTeam.id,
                team_name:     winTeam.name,
                team_logo_url: winTeam.logo_url,
                player_id:     null,
                player_name:   null,
                resolved_at:   new Date().toISOString(),
              })
            }
          }
        }

        // Goleador: primer resultado de /players/topscorers
        if (bonusTypes.includes('top_scorer')) {
          try {
            const tsData = await apiFetch(
              `/players/topscorers?league=${comp.externalId}&season=${comp.seasonYear}`
            )
            const topScorer = tsData?.response?.[0]
            if (topScorer?.player?.id) {
              const { data: dbPlayer } = await supabase
                .from('players')
                .select('id, name')
                .eq('external_id', topScorer.player.id)
                .eq('competition_id', comp.competitionId)
                .maybeSingle()

              awardRows.push({
                tournament_id: tournament.id,
                award_type:    'top_scorer',
                team_id:       null,
                team_name:     null,
                team_logo_url: null,
                player_id:     dbPlayer?.id ?? null,
                player_name:   topScorer.player.name ?? dbPlayer?.name ?? null,
                resolved_at:   new Date().toISOString(),
              })
            }
          } catch (e) {
            console.error('top_scorer sync failed:', e)
          }
        }

        // Asistidor: primer resultado de /players/topassists
        if (bonusTypes.includes('top_assists')) {
          try {
            const taData = await apiFetch(
              `/players/topassists?league=${comp.externalId}&season=${comp.seasonYear}`
            )
            const topAssist = taData?.response?.[0]
            if (topAssist?.player?.id) {
              const { data: dbPlayer } = await supabase
                .from('players')
                .select('id, name')
                .eq('external_id', topAssist.player.id)
                .eq('competition_id', comp.competitionId)
                .maybeSingle()

              awardRows.push({
                tournament_id: tournament.id,
                award_type:    'top_assists',
                team_id:       null,
                team_name:     null,
                team_logo_url: null,
                player_id:     dbPlayer?.id ?? null,
                player_name:   topAssist.player.name ?? dbPlayer?.name ?? null,
                resolved_at:   new Date().toISOString(),
              })
            }
          } catch (e) {
            console.error('top_assists sync failed:', e)
          }
        }

        if (awardRows.length > 0) {
          await supabase
            .from('award_results')
            .upsert(awardRows, { onConflict: 'tournament_id,award_type' })
        }
      }
    }

    // Disparar score-predictions en background para actualizar puntos
    const scoreUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/score-predictions`
    fetch(scoreUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
    }).catch(e => console.error('score-predictions invoke failed:', e))

    return new Response(
      JSON.stringify({ ok: true, upserted: totalUpserted }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
