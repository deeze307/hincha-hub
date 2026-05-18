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
      .select('competition_id, competitions(external_id, season_year)')
      .not('competition_id', 'is', null)

    if (!tournaments?.length) {
      return new Response(JSON.stringify({ message: 'No active tournaments' }), { status: 200 })
    }

    // Deduplicate por competition_id
    const seen = new Set<string>()
    const competitions = tournaments
      .filter(t => {
        if (!t.competition_id || seen.has(t.competition_id)) return false
        seen.add(t.competition_id)
        return true
      })
      .map(t => ({
        competitionId: t.competition_id as string,
        externalId:    (t.competitions as any)?.external_id as number,
        seasonYear:    (t.competitions as any)?.season_year as number,
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

      // 4. Resolver team_ids en Supabase
      const teamExternalIds: number[] = []
      for (const f of fixtures) {
        if (f.teams?.home?.id) teamExternalIds.push(f.teams.home.id)
        if (f.teams?.away?.id) teamExternalIds.push(f.teams.away.id)
      }

      const { data: dbTeams } = await supabase
        .from('teams')
        .select('id, external_id')
        .in('external_id', [...new Set(teamExternalIds)])

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
