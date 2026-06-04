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
    headers: { 'x-apisports-key': API_KEY, 'x-apisports-language': 'es' },
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

const ES: Record<string, string> = {
  'France':               'Francia',
  'Germany':              'Alemania',
  'England':              'Inglaterra',
  'Netherlands':          'Países Bajos',
  'Switzerland':          'Suiza',
  'Denmark':              'Dinamarca',
  'Sweden':               'Suecia',
  'Norway':               'Noruega',
  'Poland':               'Polonia',
  'Czech Republic':       'República Checa',
  'Hungary':              'Hungría',
  'Romania':              'Rumanía',
  'Slovakia':             'Eslovaquia',
  'Slovenia':             'Eslovenia',
  'Ukraine':              'Ucrania',
  'Greece':               'Grecia',
  'Turkey':               'Turquía',
  'Croatia':              'Croacia',
  'South Korea':          'Corea del Sur',
  'Japan':                'Japón',
  'Australia':            'Australia',
  'Saudi Arabia':         'Arabia Saudita',
  'Iran':                 'Irán',
  'Morocco':              'Marruecos',
  'Cameroon':             'Camerún',
  'Tunisia':              'Túnez',
  'Algeria':              'Argelia',
  'Ivory Coast':          'Costa de Marfil',
  'Egypt':                'Egipto',
  'South Africa':         'Sudáfrica',
  'Congo DR':             'R.D. del Congo',
  'Mali':                 'Malí',
  'Canada':               'Canadá',
  'USA':                  'Estados Unidos',
  'United States':        'Estados Unidos',
  'Mexico':               'México',
  'Brazil':               'Brasil',
  'Peru':                 'Perú',
  'Panama':               'Panamá',
  'Wales':                'Gales',
  'Scotland':             'Escocia',
  'Qatar':                'Catar',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'North Macedonia':      'Macedonia del Norte',
  'New Zealand':          'Nueva Zelanda',
  'Trinidad and Tobago':  'Trinidad y Tobago',
  'Dominican Republic':   'República Dominicana',
  'Senegal':              'Senegal',
  'Nigeria':              'Nigeria',
  'Ghana':                'Ghana',
  'Ecuador':              'Ecuador',
  'Colombia':             'Colombia',
  'Venezuela':            'Venezuela',
  'Bolivia':              'Bolivia',
  'Paraguay':             'Paraguay',
  'Chile':                'Chile',
  'Uruguay':              'Uruguay',
  'Argentina':            'Argentina',
  'Portugal':             'Portugal',
  'Spain':                'España',
  'Italy':                'Italia',
  'Belgium':              'Bélgica',
  'Serbia':               'Serbia',
  'Austria':              'Austria',
  'Costa Rica':           'Costa Rica',
  'Honduras':             'Honduras',
  'Jamaica':              'Jamaica',
  'El Salvador':          'El Salvador',
  'Jordan':               'Jordania',
  'Cape Verde Islands':   'Cabo Verde',
  'Cape Verde':           'Cabo Verde',
}

function esName(name: string | null): string | null {
  if (!name) return null
  return ES[name] ?? name
}

const POSITION_ES: Record<string, string> = {
  'Goalkeeper': 'Arquero',
  'Defender':   'Defensor',
  'Midfielder': 'Mediocampista',
  'Attacker':   'Delantero',
  'Forward':    'Delantero',
}

function esPosition(pos: string | null): string | null {
  if (!pos) return null
  return POSITION_ES[pos] ?? pos
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

async function syncCompetition(
  leagueId:      number,
  season:        number,
  teamType:      string,
  competitionId: string,
): Promise<{ teams: number; players: number }> {
  // Upsert teams from API-Football league endpoint (may be incomplete for some competitions)
  const teamsData = await apiFetch(`/teams?league=${leagueId}&season=${season}`)
  const teamsRaw  = teamsData?.response ?? []

  if (teamsRaw.length) {
    const teamRows = teamsRaw.map((t: any) => ({
      external_id: t.team.id,
      name:        esName(t.team.name) ?? t.team.name,
      logo_url:    t.team.logo,
      country:     esName(t.team.country) ?? t.team.country,
      type:        teamType,
    }))
    const { error: teamsErr } = await supabase
      .from('teams')
      .upsert(teamRows, { onConflict: 'external_id' })
    if (teamsErr) throw teamsErr
  }

  // Use competition_matches as source of truth for participating teams —
  // covers teams that enter directly in group stage and may not appear in
  // the API /teams endpoint for this league/season
  const { data: matchRows } = await supabase
    .from('competition_matches')
    .select('home_team_id, away_team_id')
    .eq('competition_id', competitionId)

  const matchTeamUuids = [...new Set(
    (matchRows ?? []).flatMap((m: any) =>
      [m.home_team_id, m.away_team_id].filter(Boolean)
    )
  )]

  if (!matchTeamUuids.length) return { teams: 0, players: 0 }

  const { data: dbTeams } = await supabase
    .from('teams')
    .select('id, external_id')
    .in('id', matchTeamUuids)

  if (!dbTeams?.length) return { teams: 0, players: 0 }

  const teamMap = new Map((dbTeams ?? []).map((t: any) => [t.external_id, t.id]))

  console.log(`Teams from competition_matches: ${dbTeams.length}`)
  console.log('Team external_ids:', dbTeams.map((t: any) => t.external_id).join(', '))

  // Sync players for every team that appears in match data
  let totalPlayers = 0
  for (const team of dbTeams) {
    const squadData = await apiFetch(`/players/squads?team=${team.external_id}`)
    const squad     = squadData?.response?.[0]?.players ?? []
    console.log(`Team ext_id=${team.external_id}: ${squad.length} players, errors=${squadData?.errors ? JSON.stringify(squadData.errors) : 'none'}`)

    const seen = new Set<number>()
    const playerRows = squad
      .filter((p: any) => {
        if (seen.has(p.id)) return false
        seen.add(p.id)
        return true
      })
      .map((p: any) => ({
        external_id:    p.id,
        competition_id: competitionId,
        name:           p.name,
        photo_url:      p.photo,
        nationality:    esName(p.nationality ?? null),
        flag_url:       flagUrl(p.nationality ?? null),
        team_id:        teamMap.get(team.external_id) ?? null,
        position:       esPosition(p.position ?? null),
        updated_at:     new Date().toISOString(),
      }))

    if (playerRows.length) {
      const { error } = await supabase
        .from('players')
        .upsert(playerRows, { onConflict: 'external_id,competition_id' })
      if (error) console.error(`Players upsert error (team ${team.external_id}):`, error)
      else totalPlayers += playerRows.length
    }

    await new Promise(r => setTimeout(r, 200))
  }

  return { teams: dbTeams.length, players: totalPlayers }
}

Deno.serve(async (req) => {
  try {
    // Body opcional: { league_id, season, team_type } para forzar una competencia específica
    // Sin body: auto-detecta todas las competencias con torneos activos
    let forcedLeagueId: number | null = null
    let forcedSeason:   number | null = null
    let forcedTeamType: string | null = null

    try {
      const body = await req.json()
      forcedLeagueId = body.league_id ?? null
      forcedSeason   = body.season    ?? null
      forcedTeamType = body.team_type ?? null
    } catch { /* body vacío → auto-detect */ }

    // Obtener todas las competencias vinculadas a torneos
    const { data: tournaments, error: tErr } = await supabase
      .from('tournaments')
      .select('team_type, competition_id, competitions(id, external_id, season_year)')
      .not('competition_id', 'is', null)

    if (tErr) throw tErr
    if (!tournaments?.length) {
      return new Response(JSON.stringify({ message: 'No tournaments found' }), { status: 200 })
    }

    // Deduplicate por competition_id
    const seen = new Set<string>()
    const targets = tournaments
      .filter((t: any) => {
        if (!t.competition_id || seen.has(t.competition_id)) return false
        seen.add(t.competition_id)
        return true
      })
      .map((t: any) => ({
        competitionId: t.competitions?.id      as string,
        externalId:    t.competitions?.external_id as number,
        seasonYear:    t.competitions?.season_year as number,
        teamType:      t.team_type ?? 'club',
      }))
      .filter((c: any) =>
        c.competitionId && c.externalId && c.seasonYear &&
        // Si hay body con league_id específico, solo procesar esa
        (!forcedLeagueId || (c.externalId === forcedLeagueId && c.seasonYear === forcedSeason))
      )

    if (!targets.length) {
      return new Response(JSON.stringify({ error: 'No matching competitions found' }), { status: 404 })
    }

    const results: any[] = []

    for (const comp of targets) {
      console.log(`Syncing squads for league ${comp.externalId} season ${comp.seasonYear}`)
      const { teams, players } = await syncCompetition(
        comp.externalId,
        comp.seasonYear,
        forcedTeamType ?? comp.teamType,
        comp.competitionId,
      )
      results.push({ league_id: comp.externalId, season: comp.seasonYear, teams, players })
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
