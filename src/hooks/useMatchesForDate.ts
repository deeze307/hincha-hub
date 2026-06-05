import { useEffect, useState } from 'react'
import { fetchMatchesForDate, fetchFeaturedMatchesForDate } from '../services/dashboardService'
import type { TournamentTodayMatches, FeaturedCompetitionGroup } from '../services/dashboardService'
import type { CompetitionMatch }        from '../services/matchesService'

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])

export function isLive(status: string) {
  return LIVE_STATUSES.has(status)
}

const LIVE_PERIOD: Record<string, string> = {
  '1H':  '1T',
  'HT':  'ET',
  '2H':  '2T',
  'ET':  'TE',
  'BT':  'TE',
  'P':   'P',
}

export function livePeriodLabel(status: string): string {
  const period = LIVE_PERIOD[status]
  return period ? `EN VIVO (${period})` : 'EN VIVO'
}

export function useMatchesForDate(date: Date) {
  const [groups,  setGroups]  = useState<TournamentTodayMatches[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchMatchesForDate(date)
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [date])

  const allMatches = groups.flatMap((g): CompetitionMatch[] => g.matches)
  const liveCount  = allMatches.filter(m => isLive(m.status)).length

  function filteredGroups(filter: 'all' | 'live') {
    if (filter === 'all') return groups
    return groups
      .map(g => ({ ...g, matches: g.matches.filter(m => isLive(m.status)) }))
      .filter(g => g.matches.length > 0)
  }

  return { groups, loading, liveCount, filteredGroups }
}

export function useFeaturedMatchesForDate(date: Date) {
  const [groups,  setGroups]  = useState<FeaturedCompetitionGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchFeaturedMatchesForDate(date)
      .then(setGroups)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [date])

  const allMatches = groups.flatMap((g): CompetitionMatch[] => g.matches)
  const liveCount  = allMatches.filter(m => isLive(m.status)).length

  function filteredGroups(filter: 'all' | 'live') {
    if (filter === 'all') return groups
    return groups
      .map(g => ({ ...g, matches: g.matches.filter(m => isLive(m.status)) }))
      .filter(g => g.matches.length > 0)
  }

  return { groups, loading, liveCount, filteredGroups }
}
