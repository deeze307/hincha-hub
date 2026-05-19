import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import isotipo from '../../assets/images/isotipo.png'

export default function InstallBanner() {
  const { showBanner, isIOS, install, dismiss } = useInstallPrompt()

  if (!showBanner) return null

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 px-3 pb-1 lg:hidden">
      <div className="bg-surface border border-border rounded-2xl px-3.5 py-3 flex items-center gap-3 shadow-elevated">
        <img src={isotipo} alt="" className="w-10 h-10 rounded-xl shrink-0 object-contain bg-elevated p-1" />

        <div className="flex-1 min-w-0">
          <p className="text-text text-sm font-semibold leading-tight">Instalá HinchaHub</p>
          {isIOS ? (
            <p className="text-muted text-xs mt-0.5 leading-snug">
              Tocá{' '}
              <svg className="inline align-middle mb-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {' '}→{' '}
              <span className="text-text font-medium">"Agregar al inicio"</span>
            </p>
          ) : (
            <p className="text-muted text-xs mt-0.5">Accedé más rápido desde tu pantalla</p>
          )}
        </div>

        {!isIOS && (
          <button
            onClick={install}
            className="btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1.5"
          >
            <Download size={13} />
            Instalar
          </button>
        )}

        <button
          onClick={dismiss}
          className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-elevated transition-colors shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
