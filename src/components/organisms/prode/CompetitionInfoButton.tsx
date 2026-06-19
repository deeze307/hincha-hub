import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { CompetitionInfoSheet } from './CompetitionInfoSheet'

/**
 * Botón "Pos y stats" autocontenido: abre el modal/drawer de posiciones y
 * estadísticas de la competición. Se puede colocar en cualquier header.
 */
export function CompetitionInfoButton({
  competitionId, seasonYear, competitionName, className,
}: {
  competitionId:   string
  seasonYear:      number
  competitionName: string | null
  className?:      string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-brand transition-colors'}
      >
        <BarChart3 size={11} className="shrink-0" /> Pos y stats
      </button>
      {open && (
        <CompetitionInfoSheet
          competitionId={competitionId}
          seasonYear={seasonYear}
          competitionName={competitionName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
