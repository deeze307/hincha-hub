import { Pencil, Plus } from 'lucide-react'

/**
 * Botón para cargar/editar el pronóstico de un partido.
 * Sin pronóstico → pelota con "+". Con pronóstico → lápiz (editar).
 */
export function PredictButton({ hasPred, onClick }: { hasPred: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hasPred ? 'Editar pronóstico' : 'Cargar pronóstico'}
      className="flex items-center gap-0.5 px-1 h-6 rounded-md text-muted hover:text-brand hover:bg-brand/10 transition-colors shrink-0"
    >
      {hasPred ? (
        <Pencil size={13} />
      ) : (
        <>
          <Plus size={10} strokeWidth={3} className="text-brand" />
          <span className="text-[12px] leading-none">⚽</span>
        </>
      )}
    </button>
  )
}
