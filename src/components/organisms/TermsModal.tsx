import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function TermsModal() {
  const { user, refreshProfile } = useAuth()
  const [accepted, setAccepted]   = useState(false)
  const [saving,   setSaving]     = useState(false)

  async function handleContinue() {
    if (!accepted || !user) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
    await refreshProfile()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-elevated">

        <div className="px-6 pt-6 pb-4 border-b border-border">
          <h2 className="text-text font-semibold text-lg">Antes de continuar...</h2>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-muted text-sm leading-relaxed">
            Hincha Hub es una plataforma destinada a la gestión de torneos de pronósticos deportivos y competencias entre participantes.
          </p>
          <p className="text-muted text-sm leading-relaxed">
            La plataforma no opera como casa de apuestas, no recibe, administra ni custodia dinero, y no interviene en los pagos, cobros o entrega de premios. Cualquier inscripción, aporte económico o premio asociado a un torneo es gestionado exclusivamente por sus organizadores y participantes.
          </p>
          <p className="text-muted text-sm leading-relaxed">
            Al utilizar la plataforma, aceptás que Hincha Hub actúa únicamente como herramienta de administración y registro de pronósticos deportivos.
          </p>
        </div>

        <div className="px-6 py-5 border-t border-border space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                  accepted ? 'bg-brand border-brand' : 'border-border group-hover:border-brand/60'
                }`}
              >
                {accepted && (
                  <svg viewBox="0 0 12 10" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1,5 4,9 11,1" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-text text-sm">
              Leí y acepto los términos y condiciones de uso de Hincha Hub.
            </span>
          </label>

          <button
            onClick={handleContinue}
            disabled={!accepted || saving}
            className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Continuar'}
          </button>
        </div>

      </div>
    </div>
  )
}
