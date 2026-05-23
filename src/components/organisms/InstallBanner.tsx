import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import isotipo from '../../assets/images/isotipo.png'

function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className="inline align-middle mb-0.5 mx-0.5">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}

export default function InstallBanner() {
  const { showBanner, isIOS, isSamsung, hasDeferredPrompt, install, dismiss } = useInstallPrompt()

  if (!showBanner) return null

  // Instrucciones paso a paso para el caso manual (sin deferredPrompt)
  function ManualSteps() {
    if (isSamsung) {
      return (
        <ol className="text-muted text-xs mt-1 space-y-0.5 leading-snug">
          <li><span className="text-text font-medium">1.</span> Tocá el ícono <span className="text-text font-medium">☰</span> del navegador</li>
          <li><span className="text-text font-medium">2.</span> Elegí <span className="text-text font-medium">"Añadir página a"</span> → <span className="text-text font-medium">"Pantalla de inicio"</span></li>
        </ol>
      )
    }
    // Chrome / Brave / Chromium genérico
    return (
      <ol className="text-muted text-xs mt-1 space-y-0.5 leading-snug">
        <li><span className="text-text font-medium">1.</span> Tocá el menú <span className="text-text font-medium">⋮</span> del navegador (arriba a la derecha)</li>
        <li><span className="text-text font-medium">2.</span> Elegí <span className="text-text font-medium">"Añadir a pantalla de inicio"</span></li>
      </ol>
    )
  }

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 px-3 pb-1 lg:hidden">
      <div className="border border-brand/50 rounded-2xl px-3.5 py-3 flex items-start gap-3" style={{ backgroundColor: '#221100', boxShadow: '0 0 24px rgba(255,116,3,0.2)' }}>
        <img src={isotipo} alt="" className="w-10 h-10 rounded-xl shrink-0 object-contain bg-brand/20 p-1 mt-0.5" />

        <div className="flex-1 min-w-0">
          <p className="text-text text-sm font-semibold leading-tight">Instalá HinchaHub</p>
          {isIOS ? (
            <ol className="text-muted text-xs mt-1 space-y-0.5 leading-snug">
              <li><span className="text-text font-medium">1.</span> Tocá el ícono de compartir <ShareIcon /> (abajo del navegador)</li>
              <li><span className="text-text font-medium">2.</span> Elegí <span className="text-text font-medium">"Agregar a pantalla de inicio"</span></li>
            </ol>
          ) : hasDeferredPrompt ? (
            <p className="text-muted text-xs mt-0.5">Accedé más rápido desde tu pantalla</p>
          ) : (
            <ManualSteps />
          )}
        </div>

        {!isIOS && hasDeferredPrompt && (
          <button
            onClick={install}
            className="btn-primary text-xs py-1.5 px-3 shrink-0 flex items-center gap-1.5 mt-0.5"
          >
            <Download size={13} />
            Instalar
          </button>
        )}

        <button
          onClick={dismiss}
          className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-brand/20 transition-colors shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
