// @ts-nocheck  — Deno globals not available in local TS checker; works fine on Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const API_KEY  = Deno.env.get('API_FOOTBALL_KEY')!
const API_BASE = 'https://v3.football.api-sports.io'

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

function flagUrl(nationality: string | null): string | null {
  if (!nationality) return null
  const iso: Record<string, string> = {
    'Argentina': 'ar', 'Brazil': 'br', 'France': 'fr', 'Germany': 'de',
    'Spain': 'es', 'England': 'gb-eng', 'Italy': 'it', 'Portugal': 'pt',
    'Netherlands': 'nl', 'Belgium': 'be', 'Uruguay': 'uy', 'Colombia': 'co',
    'Mexico': 'mx', 'USA': 'us', 'Canada': 'ca', 'Morocco': 'ma',
    'Senegal': 'sn', 'Japan': 'jp', 'South Korea': 'kr', 'Australia': 'au',
    'Croatia': 'hr', 'Poland': 'pl', 'Switzerland': 'ch', 'Denmark': 'dk',
    'Ecuador': 'ec', 'Serbia': 'rs', 'Ghana': 'gh', 'Cameroon': 'cm',
    'Tunisia': 'tn', 'Saudi Arabia': 'sa', 'Iran': 'ir', 'Qatar': 'qa',
    'Wales': 'gb-wls', 'Scotland': 'gb-sct', 'Turkey': 'tr', 'Austria': 'at',
    'Czech Republic': 'cz', 'Hungary': 'hu', 'Romania': 'ro', 'Slovakia': 'sk',
    'Slovenia': 'si', 'Ukraine': 'ua', 'Greece': 'gr', 'Chile': 'cl',
    'Peru': 'pe', 'Venezuela': 've', 'Bolivia': 'bo', 'Paraguay': 'py',
    'Costa Rica': 'cr', 'Panama': 'pa', 'Honduras': 'hn', 'Jamaica': 'jm',
    'Nigeria': 'ng', 'Egypt': 'eg', 'Algeria': 'dz', 'Ivory Coast': 'ci',
    'Mali': 'ml', 'South Africa': 'za', 'Congo': 'cd',
  }
  const code = iso[nationality]
  return code ? `https://flagcdn.com/w40/${code}.png` : null
}

Deno.serve(async (req) => {
  try {
    // Body esperado: { league_id, season, team_type }
    let leagueId: number | null            = null
    let season:   number | null            = null
    let teamType: 'national' | 'club'      = 'club'

    try {
      const body = await req.json()
      leagueId = body.league_id ?? null
      season   = body.season   ?? null
      teamType = body.team_type ?? 'club'
    } catch { /* body vacío */ }

    if (!leagueId || !season) {
      return new Response(
        JSON.stringify({ error: 'Requerido: { league_id, season, team_type }' }),
        { status: 400 }
      )
    }

    // ─── 1. Resolver competition_id en Supabase ───────────────
    const { data: comp, error: compErr } = await supabase
      .from('competitions')
      .select('id')
      .eq('external_id', leagueId)
      .eq('season_year', season)
      .single()

    if (compErr || !comp) {
      return new Response(
        JSON.stringify({ error: `Competencia no encontrada (league_id=${leagueId}, season=${season}). Ejecutá sync-competitions primero.` }),
        { status: 404 }
      )
    }

    const competitionId = comp.id

    // ─── 2. Sync teams ────────────────────────────────────────
    const teamsData = await apiFetch(`/teams?league=${leagueId}&season=${season}`)
    const teamsRaw  = teamsData?.response ?? []

    if (!teamsRaw.length) {
      return new Response(JSON.stringify({ ok: true, teams: 0, players: 0 }), { status: 200 })
    }

    const teamRows = teamsRaw.map((t: any) => ({
      external_id: t.team.id,
      name:        t.team.name,
      logo_url:    t.team.logo,
      country:     t.team.country,
      type:        teamType,
    }))

    const { error: teamsErr } = await supabase
      .from('teams')
      .upsert(teamRows, { onConflict: 'external_id' })
    if (teamsErr) throw teamsErr

    // Mapa external_id → UUID interno
    const externalIds = teamRows.map((t: any) => t.external_id)
    const { data: dbTeams } = await supabase
      .from('teams')
      .select('id, external_id')
      .in('external_id', externalIds)

    const teamMap = new Map((dbTeams ?? []).map(t => [t.external_id, t.id]))

    // ─── 3. Sync players (squad por equipo) ───────────────────
    let totalPlayers = 0

    for (const t of teamsRaw) {
      const squadData = await apiFetch(`/players/squads?team=${t.team.id}`)
      const squad     = squadData?.response?.[0]?.players ?? []

      const playerRows = squad.map((p: any) => ({
        external_id:    p.id,
        competition_id: competitionId,   // clave para diferenciar por competencia
        name:           p.name,
        photo_url:      p.photo,
        nationality:    p.nationality ?? null,
        flag_url:       flagUrl(p.nationality ?? null),
        team_id:        teamMap.get(t.team.id) ?? null,
        position:       p.position ?? null,
        updated_at:     new Date().toISOString(),
      }))

      if (playerRows.length) {
        const { error } = await supabase
          .from('players')
          .upsert(playerRows, { onConflict: 'external_id,competition_id' })
        if (error) console.error(`Players upsert error (team ${t.team.id}):`, error)
        else totalPlayers += playerRows.length
      }

      // Pausa mínima entre requests
      await new Promise(r => setTimeout(r, 200))
    }

    return new Response(
      JSON.stringify({ ok: true, competition_id: competitionId, teams: teamRows.length, players: totalPlayers }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
