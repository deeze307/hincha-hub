import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import type { Tournament, BonusType } from '../../../services/tournamentsService'
import {
  fetchUserBonusPredictions, saveBonusPredictions,
} from '../../../services/predictionsService'
import type { BonusPrediction } from '../../../services/predictionsService'
import {
  BONUS_META, RANK_META,
  type SelectedTeam, type SelectedPlayer,
} from '../../../utils/prodeScoring'
import { AutocompleteTeam } from '../../molecules/AutocompleteTeam'
import { AutocompletePlayer } from '../../molecules/AutocompletePlayer'

export interface BonusTabHandle { save: () => Promise<void>; isLocked: boolean }

export const BonusTab = forwardRef<BonusTabHandle, { tournament: Tournament; locked: boolean }>(
({ tournament, locked }, ref) => {
  // Bonus types configurados; backwards-compatible con torneos sin bonus_types
  const bonusTypes: BonusType[] = tournament.prode_config?.bonus_types?.length
    ? tournament.prode_config.bonus_types
    : ['champion', 'top_scorer']

  // teamPicks y playerPicks: clave = "type-rank"
  const [teamPicks,    setTeamPicks]    = useState<Record<string, SelectedTeam   | null>>({})
  const [playerPicks,  setPlayerPicks]  = useState<Record<string, SelectedPlayer | null>>({})
  const [savedValues,  setSavedValues]  = useState<Record<string, string>>({})   // key → id guardado en BD
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set())       // keys ya editadas (bloqueadas)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const bonuses = await fetchUserBonusPredictions(tournament.id)
        const newTeams:   Record<string, SelectedTeam   | null> = {}
        const newPlayers: Record<string, SelectedPlayer | null> = {}
        const baseline: Record<string, string> = {}
        const modified = new Set<string>()

        for (const b of bonuses) {
          const key  = `${b.type}-${b.rank}`
          const meta = BONUS_META[b.type as BonusType]
          if (meta?.kind === 'team' && b.team_name) {
            newTeams[key] = { id: b.team_id!, name: b.team_name, logo_url: b.team_logo_url ?? null }
            baseline[key] = b.team_id!
          } else if (meta?.kind === 'player' && b.player_name) {
            newPlayers[key] = { id: b.player_id!, name: b.player_name, photo_url: b.player_photo_url ?? null, team: null }
            baseline[key] = b.player_id!
          }
          if (b.is_modified) modified.add(key)
        }

        setTeamPicks(newTeams)
        setPlayerPicks(newPlayers)
        setSavedValues(baseline)
        setModifiedKeys(modified)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tournament.id])

  const isFieldLocked = (key: string) => locked || modifiedKeys.has(key)

  const handleSave = useCallback(async () => {
    if (locked) return  // bloqueo global: ya empezó el partido final del torneo

    const bonuses: BonusPrediction[] = []

    for (const bonusType of bonusTypes) {
      const meta = BONUS_META[bonusType]
      for (const { rank } of RANK_META) {
        const key = `${bonusType}-${rank}`
        if (modifiedKeys.has(key)) continue          // campo ya bloqueado → no se toca

        const pick = meta.kind === 'team' ? teamPicks[key] : playerPicks[key]
        if (!pick) continue                          // campo vacío → no se guarda nada

        const baseId = savedValues[key]
        if (baseId === pick.id) continue             // mismo valor que en BD → no es edición

        const isEdit = baseId !== undefined          // ya existía con otro valor → edición (se bloquea)

        if (meta.kind === 'team') {
          bonuses.push({
            tournament_id: tournament.id, type: bonusType, rank,
            team_id: pick.id, team_name: pick.name, is_modified: isEdit,
          })
        } else {
          bonuses.push({
            tournament_id: tournament.id, type: bonusType, rank,
            player_id: pick.id, player_name: pick.name, is_modified: isEdit,
          })
        }
      }
    }

    if (bonuses.length === 0) return
    await saveBonusPredictions(tournament.id, bonuses)

    const newSaved    = { ...savedValues }
    const newModified = new Set(modifiedKeys)
    bonuses.forEach(b => {
      const key = `${b.type}-${b.rank}`
      newSaved[key] = (b.team_id ?? b.player_id)!
      if (b.is_modified) newModified.add(key)
    })
    setSavedValues(newSaved)
    setModifiedKeys(newModified)
  }, [locked, teamPicks, playerPicks, savedValues, modifiedKeys, tournament.id, bonusTypes])

  useImperativeHandle(ref, () => ({ save: handleSave, isLocked: locked }), [handleSave, locked])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="text-brand animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Descripción */}
      <div className="bg-brand/10 border border-brand/25 rounded-xl px-4 py-3">
        <p className="text-sm text-text">
          Elegí hasta <span className="font-semibold text-brand">3 opciones</span> por cada premio.
          Si acertás con tu <span className="font-semibold">1ª opción</span> sumás <span className="font-semibold">10 pts</span>, con la <span className="font-semibold">2ª</span> sumás <span className="font-semibold">5 pts</span> y con la <span className="font-semibold">3ª</span> sumás <span className="font-semibold">3 pts</span>.
        </p>
      </div>

      {modifiedKeys.size > 0 && (
        <div className="flex items-center gap-2 text-muted text-sm bg-elevated border border-border rounded-xl px-4 py-3">
          <Lock size={14} className="shrink-0" />
          <span>Ya usaste tu modificación — los campos grisados no pueden volver a modificarse.</span>
        </div>
      )}

      {bonusTypes.map(bonusType => {
        const meta = BONUS_META[bonusType]
        if (!meta) return null
        const needsCompetition = meta.kind === 'player' && !tournament.competition_id
        if (needsCompetition) return null
        const { Icon } = meta

        return (
          <div key={bonusType} className="card">
            <div className="px-4 py-3 border-b border-border bg-elevated/50 rounded-t-[13px] flex items-center gap-2">
              <Icon size={16} className="text-brand" />
              <h3 className="text-text text-sm font-semibold">{meta.label}</h3>
              <span className="text-muted text-xs ml-auto hidden sm:block">si acertás con tu opción</span>
            </div>
            <div className="p-3 space-y-2.5">
              {RANK_META.map(({ rank, label, pts, medal }) => {
                const key = `${bonusType}-${rank}`
                return (
                  <div key={rank} className="flex items-center gap-2 min-w-0">
                    <div className="w-20 shrink-0 flex items-center gap-1.5">
                      <span className="text-lg leading-none">{medal}</span>
                      <div>
                        <p className="text-text text-xs font-semibold">{label}</p>
                        <p className="text-brand text-[11px] font-bold">+{pts} pts</p>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      {meta.kind === 'team' ? (
                        <AutocompleteTeam
                          value={teamPicks[key] ?? null}
                          onSelect={t => setTeamPicks(prev => ({ ...prev, [key]: t }))}
                          locked={isFieldLocked(key)}
                          teamType={tournament.team_type}
                          placeholder="Buscar equipo..."
                        />
                      ) : (
                        <AutocompletePlayer
                          value={playerPicks[key] ?? null}
                          onSelect={p => setPlayerPicks(prev => ({ ...prev, [key]: p }))}
                          locked={isFieldLocked(key)}
                          competitionId={tournament.competition_id!}
                          placeholder="Buscar jugador..."
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

    </div>
  )
})
