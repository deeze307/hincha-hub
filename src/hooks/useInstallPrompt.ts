import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa_banner_dismissed'
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000 // 30 días

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS]         = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isInstalled, setIsInstalled] = useState(true) // optimista: asume instalado hasta verificar
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    setIsInstalled(standalone)

    const ts = localStorage.getItem(DISMISS_KEY)
    if (ts && Date.now() - parseInt(ts) < DISMISS_TTL) setDismissed(true)

    const ua = navigator.userAgent
    setIsIOS(/iP(hone|ad|od)/.test(ua) && !(navigator as any).standalone)
    setIsAndroid(/Android/.test(ua) && !standalone)

    // Recuperar evento capturado antes de que React montara
    const cached = (window as any).__pwaInstallPrompt
    if (cached) setDeferredPrompt(cached)

    function handler(e: Event) {
      e.preventDefault()
      ;(window as any).__pwaInstallPrompt = e
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      ;(window as any).__pwaInstallPrompt = null
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setDismissed(true)
  }

  const isMobile = isIOS || isAndroid
  const showBanner = isMobile && !isInstalled && !dismissed

  return { showBanner, isIOS, isAndroid, hasDeferredPrompt: deferredPrompt !== null, install, dismiss }
}
