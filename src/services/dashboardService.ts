// @ts-nocheck
import { supabase } from '../lib/supabase'
import type { CompetitionMatch } from './matchesService'
import { FRIENDLIES_EXTERNAL_ID, isRelevantFriendly } from '../utils/matchFilters'

export interface FeaturedCompetitionGroup {
  competitionId:            string
  competitionName:          string
  competitionLogo:          string | null
  competitionCountry:       string
  isEnrolled:               boolean
  tournamentId:             string | null
  tournamentName:           string | null
  joinableTournamentId:     string | null
  joinableTournamentName:   string | null
  joinableTournamentAccess: 'open' | 'request' | null
  matches:                  CompetitionMatch[]
}

export interface TournamentTodayMatches {
  tournamentId:       string
  tournamentName:     string
  competitionLogo:    string | null
  competitionCountry: string
  matches:            CompetitionMatch[]
}

// Reutilizable: devuelve los partidos de una fecha dada agrupados por torneo del usuario
export async function fetchMatchesForDate(date: Date): Promise<TournamentTodayMatches[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // 1. Torneos del usuario con info de competencia
  const { data: regs } = await supabase
    .from('tournament_registrations')
    .select(`
      tournament_id,
      tournaments (
        id, name, competition_id,
        competition:competitions ( name, logo_url, season_year, country, external_id )
      )
    `)
    .eq('user_id', user.id)

  if (!regs?.length) return []

  // Mapear competition_id → info del torneo (uno por competencia, sin duplicar)
  const byCompetition = new Map<string, {
    tournamentId:    string
    tournamentName:  string
    competitionLogo: string | null
    seasonYear:      number
  }>()

  for (const reg of regs) {
    const t = reg.tournaments as any
    if (!t?.competition_id || !t?.competition) continue
    if (byCompetition.has(t.competition_id)) continue
    byCompetition.set(t.competition_id, {
      tournamentId:       t.id,
      tournamentName:     t.name,
      competitionLogo:    t.competition.logo_url ?? null,
      competitionCountry: t.competition.country ?? '',
      seasonYear:         t.competition.season_year ?? new Date().getFullYear(),
      externalId:         t.competition.external_id ?? null,
    })
  }

  if (byCompetition.size === 0) return []

  // 2. Partidos de la fecha solicitada (medianoche local → medianoche local del día siguiente)
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

  const { data: rawMatches } = await supabase
    .from('competition_matches')
    .select(`
      id, competition_id, season_year, match_date, status, round,
      home_score, away_score,
      home_team:home_team_id ( id, name, logo_url, external_id ),
      away_team:away_team_id ( id, name, logo_url, external_id )
    `)
    .in('competition_id', [...byCompetition.keys()])
    .gte('match_date', dayStart.toISOString())
    .lt('match_date',  dayEnd.toISOString())
    .order('match_date', { ascending: true })

  const matches = (rawMatches ?? []) as unknown as (CompetitionMatch & { competition_id: string })[]

  // 3. Agrupar por torneo, preservando el orden de inscripción
  const result: TournamentTodayMatches[] = []
  for (const [compId, info] of byCompetition) {
    let compMatches = matches.filter(
      m => m.competition_id === compId && m.season_year === info.seasonYear,
    )
    // Amistosos internacionales: aplicar filtros de relevancia (fecha, juveniles, ranking)
    if (info.externalId === FRIENDLIES_EXTERNAL_ID) {
      compMatches = compMatches.filter(isRelevantFriendly)
    }
    if (compMatches.length === 0) continue
    result.push({
      tournamentId:       info.tournamentId,
      tournamentName:     info.tournamentName,
      competitionLogo:    info.competitionLogo,
      competitionCountry: info.competitionCountry,
      matches:            compMatches,
    })
  }

  return result
}

const MATCH_SELECT = `
  id, competition_id, season_year, match_date, status, round, round_order, matchday,
  home_score, away_score,
  home_team:home_team_id ( id, name, logo_url, external_id ),
  away_team:away_team_id ( id, name, logo_url, external_id )
`

export async function fetchFeaturedMatchesForDate(date: Date): Promise<FeaturedCompetitionGroup[]> {
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Featured competitions + user registrations in parallel
  const [featuredRes, regsRes] = await Promise.all([
    supabase
      .from('competitions')
      .select('id, name, logo_url, season_year, display_order, country, external_id')
      .eq('featured', true)
      .order('display_order', { ascending: true }),
    user
      ? supabase
          .from('tournament_registrations')
          .select('tournaments(id, name, competition_id)')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),
  ])

  const featuredComps = featuredRes.data ?? []
  const featuredIds   = new Set(featuredComps.map(c => c.id))

  // enrolled map: competition_id → { tournamentId, tournamentName }
  const enrolledMap = new Map()
  for (const reg of (regsRes.data ?? [])) {
    const t = reg.tournaments
    if (t?.competition_id && !enrolledMap.has(t.competition_id)) {
      enrolledMap.set(t.competition_id, { tournamentId: t.id, tournamentName: t.name })
    }
  }

  // enrolled competitions NOT in featured list (always show user's own tournaments)
  const extraCompIds = [...enrolledMap.keys()].filter(id => !featuredIds.has(id))

  const allCompIds = [...featuredIds, ...extraCompIds]
  if (allCompIds.length === 0) return []

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd   = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

  // 2. Extra comp info + active tournaments + matches in parallel
  const [extraCompsRes, tournamentsRes, matchesRes] = await Promise.all([
    extraCompIds.length > 0
      ? supabase
          .from('competitions')
          .select('id, name, logo_url, season_year, country, external_id')
          .in('id', extraCompIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('tournaments')
      .select('id, name, competition_id, access_type')
      .in('competition_id', allCompIds)
      .in('status', ['upcoming', 'active'])
      .eq('is_hidden', false),
    supabase
      .from('competition_matches')
      .select(MATCH_SELECT)
      .in('competition_id', allCompIds)
      .gte('match_date', dayStart.toISOString())
      .lt('match_date',  dayEnd.toISOString())
      .order('match_date', { ascending: true }),
  ])

  const rawMatches = matchesRes.data ?? []

  // joinable map: competition_id → first active tournament (for non-enrolled)
  const joinableMap = new Map()
  for (const t of (tournamentsRes.data ?? [])) {
    if (t.competition_id && !joinableMap.has(t.competition_id)) {
      joinableMap.set(t.competition_id, { tournamentId: t.id, tournamentName: t.name, accessType: t.access_type })
    }
  }

  function buildGroup(comp) {
    let compMatches = rawMatches.filter(
      m => m.competition_id === comp.id && m.season_year === comp.season_year,
    )
    // Amistosos internacionales: aplicar filtros de relevancia (fecha, juveniles, ranking)
    if (comp.external_id === FRIENDLIES_EXTERNAL_ID) {
      compMatches = compMatches.filter(isRelevantFriendly)
    }
    if (compMatches.length === 0) return null

    const enrolled = enrolledMap.get(comp.id) ?? null
    const joinable = !enrolled ? (joinableMap.get(comp.id) ?? null) : null

    return {
      competitionId:            comp.id,
      competitionName:          comp.name,
      competitionLogo:          comp.logo_url ?? null,
      competitionCountry:       comp.country ?? '',
      isEnrolled:               !!enrolled,
      tournamentId:             enrolled?.tournamentId ?? null,
      tournamentName:           enrolled?.tournamentName ?? null,
      joinableTournamentId:     joinable?.tournamentId ?? null,
      joinableTournamentName:   joinable?.tournamentName ?? null,
      joinableTournamentAccess: joinable?.accessType ?? null,
      matches:                  compMatches,
    }
  }

  const result = []
  for (const comp of featuredComps) {
    const g = buildGroup(comp)
    if (g) result.push(g)
  }
  for (const comp of (extraCompsRes.data ?? [])) {
    const g = buildGroup(comp)
    if (g) result.push(g)
  }

  return result
}
