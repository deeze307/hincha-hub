// @ts-nocheck
// ─── sync-fixtures-test ───────────────────────────────────────────────────────
// Igual a sync-fixtures pero acepta { competition_id } en el body para sincronizar
// una sola competencia. No dispara score-predictions automáticamente.
// Uso: POST /functions/v1/sync-fixtures-test  { "competition_id": "<uuid>" }
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const API_KEY  = Deno.env.get('API_FOOTBALL_KEY')!
const API_BASE = 'https://v3.football.api-sports.io'

const ROUND_ORDER: Record<string, number> = {
  'Group Stage':     1,
  'Round of 32':     2,
  'Round of 16':     3,
  'Quarter-finals':  4,
  'Semi-finals':     5,
  '3rd Place Final': 6,
  'Final':           7,
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

async function buildGroupMap(leagueId: number, season: number): Promise<Map<number, string>> {
  const groupMap = new Map<number, string>()
  try {
    const data = await apiFetch(`/standings?league=${leagueId}&season=${season}`)
    const standings = data?.response?.[0]?.league?.standings ?? []
    for (const group of standings) {
      for (const entry of group) {
        if (entry.team?.id && entry.group) groupMap.set(entry.team.id, entry.group)
      }
    }
  } catch (e) {
    console.error('standings fetch failed:', e)
  }
  return groupMap
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const { competition_id } = body

    if (!competition_id) {
      return new Response(
        JSON.stringify({ error: 'Falta competition_id en el body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Obtener la competencia solicitada
    const { data: comp, error: compErr } = await supabase
      .from('competitions')
      .select('id, name, external_id, season_year')
      .eq('id', competition_id)
      .single()

    if (compErr || !comp) {
      return new Response(
        JSON.stringify({ error: 'Competencia no encontrada', detail: compErr?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (!comp.external_id || !comp.season_year) {
      return new Response(
        JSON.stringify({ error: 'La competencia no tiene external_id o season_year configurado' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    console.log(`Syncing: ${comp.name} (league=${comp.external_id}, season=${comp.season_year})`)

    const groupMap = await buildGroupMap(comp.external_id, comp.season_year)

    const data = await apiFetch(`/fixtures?league=${comp.external_id}&season=${comp.season_year}`)
    const fixtures = data?.response ?? []

    if (!fixtures.length) {
      return new Response(
        JSON.stringify({ ok: true, upserted: 0, message: 'API no devolvió fixtures' }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Upsert equipos
    const uniqueTeams = new Map<number, object>()
    for (const f of fixtures) {
      for (const side of ['home', 'away']) {
        const t = f.teams?.[side]
        if (t?.id && t?.name && !uniqueTeams.has(t.id)) {
          uniqueTeams.set(t.id, { external_id: t.id, name: t.name, logo_url: t.logo ?? null, type: 'national' })
        }
      }
    }
    if (uniqueTeams.size > 0) {
      await supabase.from('teams').upsert([...uniqueTeams.values()], { onConflict: 'external_id', ignoreDuplicates: true })
    }

    const { data: dbTeams } = await supabase
      .from('teams').select('id, external_id').in('external_id', [...uniqueTeams.keys()])
    const teamMap = new Map((dbTeams ?? []).map(t => [t.external_id, t.id]))

    // Preparar rows
    const rows = fixtures.map((f: any) => {
      const round   = f.league?.round ?? 'Unknown'
      const isGroup = round.toLowerCase().includes('group')
      let groupName: string | null = null
      if (isGroup) {
        const directMatch = round.match(/\bGroup\s+([A-Z])\b/)
        groupName = directMatch
          ? `Group ${directMatch[1].toUpperCase()}`
          : groupMap.get(f.teams?.home?.id) ?? null
      }
      const roundKey   = Object.keys(ROUND_ORDER).find(k => round.toLowerCase().includes(k.toLowerCase())) ?? round
      const roundOrder = ROUND_ORDER[roundKey] ?? 1
      const homeWon    = f.teams?.home?.winner === true
      const awayWon    = f.teams?.away?.winner === true
      const winnerExtId = homeWon ? f.teams.home.id : awayWon ? f.teams.away.id : null

      return {
        external_id:    f.fixture.id,
        competition_id: comp.id,
        season_year:    comp.season_year,
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

    const finished = rows.filter(r => ['FT','AET','PEN'].includes(r.status)).length

    return new Response(
      JSON.stringify({
        ok:        true,
        comp:      comp.name,
        upserted:  rows.length,
        finished,
        note: `Sync completado. Partidos con resultado: ${finished}/${rows.length}. Usá el SQL de unlock para poder predecir.`,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
