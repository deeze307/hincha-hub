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

function normalizeStatus(s: string): string {
  const map: Record<string, string> = {
    'Not Started': 'NS', 'First Half': '1H', 'Halftime': 'HT',
    'Second Half': '2H', 'Extra Time': 'ET', 'Penalty In Progress': 'P',
    'Match Finished': 'FT', 'Match Finished After Extra Time': 'AET',
    'Match Finished Penalties': 'PEN', 'Break Time': 'BT',
    'Suspended': 'SUSP', 'Postponed': 'PST', 'Cancelled': 'CANC',
  }
  return map[s] ?? s
}

// Construye mapa teamExternalId → groupName desde el endpoint /standings
async function buildGroupMap(leagueId: number, season: number): Promise<Map<number, string>> {
  const groupMap = new Map<number, string>()
  try {
    const data = await apiFetch(`/standings?league=${leagueId}&season=${season}`)
    const standings = data?.response?.[0]?.league?.standings ?? []
    // standings es un array de grupos, cada grupo es un array de equipos
    for (const group of standings) {
      for (const entry of group) {
        if (entry.team?.id && entry.group) {
          groupMap.set(entry.team.id, entry.group)
        }
      }
    }
  } catch (e) {
    console.error('standings fetch failed:', e)
  }
  return groupMap
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

    let totalUpserted = 0

    for (const comp of competitions) {
      // 2. Obtener grupos desde /standings (teamId → groupName)
      const groupMap = await buildGroupMap(comp.externalId, comp.seasonYear)
      console.log(`Group map size for league ${comp.externalId}:`, groupMap.size)

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

        // group_name: primero intentar el formato "Group A" directo en el round,
        // sino usar el mapa de standings por equipo local
        let groupName: string | null = null
        if (isGroup) {
          // Solo matchea "Group A", "Group B"... NO "Group Stage"
          // \b asegura que la letra esté sola (no seguida de más letras)
          const directMatch = round.match(/\bGroup\s+([A-Z])\b/)
          if (directMatch) {
            groupName = `Group ${directMatch[1].toUpperCase()}`
          } else {
            // Fallback: buscar por el equipo local en el mapa de standings
            groupName = groupMap.get(f.teams?.home?.id) ?? null
          }
        }

        const roundKey   = Object.keys(ROUND_ORDER).find(k =>
          round.toLowerCase().includes(k.toLowerCase())
        ) ?? round
        const roundOrder = ROUND_ORDER[roundKey] ?? 1

        const homeWon     = f.teams?.home?.winner === true
        const awayWon     = f.teams?.away?.winner === true
        const winnerExtId = homeWon ? f.teams.home.id : awayWon ? f.teams.away.id : null

        return {
          external_id:    f.fixture.id,
          competition_id: comp.competitionId,
          season_year:    comp.seasonYear,
          round:          roundKey,
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
          status:         normalizeStatus(f.fixture?.status?.long ?? ''),
          matchday:       f.league?.round ? parseInt(f.league.round.replace(/\D/g, '')) || null : null,
          updated_at:     new Date().toISOString(),
        }
      })

      const { error } = await supabase
        .from('competition_matches')
        .upsert(rows, { onConflict: 'external_id' })

      if (error) throw error
      totalUpserted += rows.length

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
