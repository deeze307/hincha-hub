import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTournaments } from '../services/tournamentsService'
import type { Tournament } from '../services/tournamentsService'
import {
  fetchMatchesByCompetition, groupMatchesByGroup, groupMatchesByRound,
} from '../services/matchesService'
import type { CompetitionMatch } from '../services/matchesService'
import { fetchUserPredictions, saveMatchPredictions } from '../services/predictionsService'
import { FLAT_CUTOFF, isRelevantFriendly } from '../utils/matchFilters'
import { isMatchLocked, LOCKOUT_HOURS, type PredMap } from '../utils/prodeScoring'

const emptyCell = () => ({
  home: '', away: '', home_orig: '', away_orig: '',
  pts: null, is_modified: false, exists_in_db: false, predicted_at: null,
})

/**
 * Estado y lógica de predicciones de un torneo: carga de torneo + partidos +
 * predicciones del usuario, edición en memoria, guardado y agrupaciones derivadas.
 */
export function useProdePredictions(
  id:        string | undefined,
  onMissing: () => void,
) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches,    setMatches]    = useState<CompetitionMatch[]>([])
  const [predMap,    setPredMap]    = useState<PredMap>(new Map())
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!id) return
    async function load() {
      setLoading(true)
      try {
        const all = await fetchTournaments()
        const t   = all.find(x => x.id === id)
        if (!t || !t.competition_id) { onMissing(); return }
        setTournament(t)

        const compId     = t.competition_id
        const seasonYear = (t as any).competition?.season_year ?? new Date().getFullYear()
        const config     = t.prode_config as any
        const isFlat     = !config?.has_knockout && !config?.has_bonus

        const [ms, preds] = await Promise.all([
          fetchMatchesByCompetition(compId, seasonYear, isFlat ? FLAT_CUTOFF.toISOString() : undefined),
          fetchUserPredictions(id!),
        ])

        setMatches(ms)

        const map: PredMap = new Map()
        for (const p of preds) {
          const home = p.home_prediction != null ? String(p.home_prediction) : ''
          const away = p.away_prediction != null ? String(p.away_prediction) : ''
          map.set(p.match_id, {
            home, away, home_orig: home, away_orig: away,
            pts:          p.points_earned ?? null,
            is_modified:  p.is_modified ?? false,
            exists_in_db: true,
            predicted_at: p.predicted_at ?? null,
          })
        }
        for (const m of ms) {
          if (!map.has(m.id)) map.set(m.id, emptyCell())
        }
        setPredMap(map)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const refreshMatches = useCallback(async () => {
    if (!tournament?.competition_id) return
    setRefreshing(true)
    try {
      const seasonYear = (tournament as any).competition?.season_year ?? new Date().getFullYear()
      const ms = await fetchMatchesByCompetition(tournament.competition_id, seasonYear)
      setMatches(ms)
      // Preserva predMap — solo agrega celdas para IDs nuevos
      setPredMap(prev => {
        const next = new Map(prev)
        for (const m of ms) if (!next.has(m.id)) next.set(m.id, emptyCell())
        return next
      })
    } finally {
      setRefreshing(false)
    }
  }, [tournament])

  const setPred = useCallback((matchId: string, home: string, away: string) => {
    setPredMap(prev => {
      const next     = new Map(prev)
      const existing = prev.get(matchId)
      next.set(matchId, {
        home, away,
        home_orig:    existing?.home_orig    ?? '',
        away_orig:    existing?.away_orig    ?? '',
        pts:          existing?.pts          ?? null,
        is_modified:  existing?.is_modified  ?? false,
        exists_in_db: existing?.exists_in_db ?? false,
        predicted_at: existing?.predicted_at ?? null,
      })
      return next
    })
  }, [])

  // Guarda las predicciones de partido (grupos + eliminatoria). El bonus se guarda aparte.
  const savePredictions = useCallback(async () => {
    if (!id) return
    const toSave = [...predMap.entries()]
      .filter(([match_id, v]) => {
        if (v.home === '' && v.away === '') return false
        if (v.is_modified) return false
        if (v.exists_in_db && v.home === v.home_orig && v.away === v.away_orig) return false
        const match = matches.find(m => m.id === match_id)
        return match && !isMatchLocked(match)
      })
      .map(([match_id, v]) => ({
        match_id,
        home:   v.home !== '' ? parseInt(v.home) : null,
        away:   v.away !== '' ? parseInt(v.away) : null,
        is_new: !v.exists_in_db,
      }))

    if (!toSave.length) return
    await saveMatchPredictions(id, toSave)
    setPredMap(prev => {
      const next = new Map(prev)
      for (const p of toSave) {
        const existing = prev.get(p.match_id)
        if (!existing) continue
        next.set(p.match_id, {
          ...existing,
          home_orig:    existing.home,
          away_orig:    existing.away,
          exists_in_db: true,
          is_modified:  !p.is_new,
        })
      }
      return next
    })
  }, [id, predMap, matches])

  // ─── Agrupaciones derivadas ──────────────────────────────────────
  const groupMatchesMap   = useMemo(() => groupMatchesByGroup(matches), [matches])
  const knockoutRoundsMap = useMemo(() => groupMatchesByRound(matches), [matches])
  const flatMatches       = useMemo(
    () => matches.filter(m => m.group_name == null && m.round_order <= 1 && isRelevantFriendly(m)),
    [matches],
  )
  const hasGroups = groupMatchesMap.size > 0

  const bonusLocked = useMemo(() => {
    const refMatches = knockoutRoundsMap.get('3rd Place Final') ?? knockoutRoundsMap.get('Final') ?? []
    const refMatch   = refMatches[0]
    if (!refMatch?.match_date) return false
    return Date.now() >= new Date(refMatch.match_date).getTime() - LOCKOUT_HOURS * 3_600_000
  }, [knockoutRoundsMap])

  const anyUnlocked = useMemo(
    () => matches.some(m => !isMatchLocked(m) && !(predMap.get(m.id)?.is_modified)),
    [matches, predMap],
  )

  return {
    tournament, matches, predMap, loading, refreshing,
    setPred, refreshMatches, savePredictions,
    groupMatchesMap, knockoutRoundsMap, flatMatches, hasGroups,
    bonusLocked, anyUnlocked,
  }
}
