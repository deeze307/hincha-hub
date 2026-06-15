import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CompetitionMatch } from '../../../services/matchesService'
import { saveMatchPredictions } from '../../../services/predictionsService'
import { isMatchLocked, isMatchLate } from '../../../utils/prodeScoring'
import { useScoringConfig } from '../../../contexts/ScoringConfigContext'
import { useToast } from '../../../contexts/ToastContext'
import { TeamLogo } from '../../atoms/TeamLogo'
import { ScoreBox } from '../../atoms/ScoreBox'

export interface QuickPredictExisting { home: number; away: number; is_modified: boolean }

/**
 * Modal liviano para cargar/editar el pronóstico de un único partido desde fuera
 * del prode (ej: "Partidos de hoy"). Respeta las mismas validaciones: partido
 * bloqueado, una sola edición (is_modified) y ½ puntos por cercanía/edición.
 */
export function QuickPredictModal({
  match, tournamentId, existing, onClose, onSaved,
}: {
  match:        CompetitionMatch
  tournamentId: string
  existing:     QuickPredictExisting | null
  onClose:      () => void
  onSaved:      (home: number, away: number, isModified: boolean) => void
}) {
  const { early_cutoff_hours: earlyCutoff, modify_cutoff_hours: modifyCutoff } = useScoringConfig()
  const { showToast } = useToast()

  const [visible, setVisible] = useState(false)
  const [home,    setHome]    = useState(existing ? String(existing.home) : '')
  const [away,    setAway]    = useState(existing ? String(existing.away) : '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  function close() { setVisible(false); setTimeout(onClose, 300) }

  // El umbral aplicable depende de si es nueva o modificación
  const relevantCutoff = existing ? modifyCutoff : earlyCutoff
  const willBeHalf     = isMatchLate(match, relevantCutoff)
  const canSave        = home !== '' && away !== '' && !saving

  async function handleSave() {
    if (isMatchLocked(match) || existing?.is_modified) {
      showToast('Este partido ya no admite cambios.', 'error')
      close()
      return
    }
    const h = parseInt(home), a = parseInt(away)
    if (isNaN(h) || isNaN(a)) return
    // Sin cambios respecto a lo guardado → no reenviar (no consume la edición)
    if (existing && h === existing.home && a === existing.away) { close(); return }

    setSaving(true)
    try {
      const isNew = !existing
      await saveMatchPredictions(tournamentId, [{ match_id: match.id, home: h, away: a, is_new: isNew }])
      onSaved(h, a, !isNew)
      showToast('¡Pronóstico guardado!', 'success')
      close()
    } catch {
      showToast('Error al guardar. Intentá de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const dateStr = match.match_date
    ? new Date(match.match_date).toLocaleString('es-AR', {
        weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : ''

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${visible ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'}`}
      onClick={close}
    >
      <div
        className={`bg-surface border border-border rounded-2xl w-full max-w-sm shadow-elevated transition-all duration-300 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-text font-semibold text-[15px]">{existing ? 'Editar pronóstico' : 'Cargar pronóstico'}</h2>
            {dateStr && <p className="text-muted-dark text-[11px] mt-0.5 capitalize">{dateStr}</p>}
          </div>
          <button onClick={close} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Equipos + inputs */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
              <span className="text-text text-sm font-semibold truncate text-right">{match.home_team?.name ?? '—'}</span>
              <TeamLogo url={match.home_team?.logo_url ?? null} name={match.home_team?.name ?? '?'} size={24} />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ScoreBox value={home} onChange={setHome} locked={false} />
              <span className="text-muted-dark text-xs font-semibold">-</span>
              <ScoreBox value={away} onChange={setAway} locked={false} />
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <TeamLogo url={match.away_team?.logo_url ?? null} name={match.away_team?.name ?? '?'} size={24} />
              <span className="text-text text-sm font-semibold truncate">{match.away_team?.name ?? '—'}</span>
            </div>
          </div>

          {existing ? (
            <p className={`text-[11px] text-center mt-4 leading-snug ${willBeHalf ? 'text-yellow-400' : 'text-muted'}`}>
              {willBeHalf
                ? 'Es tu modificación: queda bloqueada y suma ½ puntos.'
                : 'Es tu modificación: queda bloqueada, pero conserva los puntos completos.'}
            </p>
          ) : willBeHalf ? (
            <p className="text-yellow-400 text-[11px] text-center mt-4 leading-snug">
              Faltan menos de {earlyCutoff}h: este pronóstico suma ½ puntos.
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={close} className="flex-1 btn-secondary">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
