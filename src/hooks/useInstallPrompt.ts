import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa_banner_dismissed'
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000 // 30 días

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS]           = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [dismissed, setDismissed]   = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    setIsInstalled(isStandalone)

    const ts = localStorage.getItem(DISMISS_KEY)
    if (ts && Date.now() - parseInt(ts) < DISMISS_TTL) setDismissed(true)

    const ua = navigator.userAgent
    const iosDevice = /iP(hone|ad|od)/.test(ua)
    const iosSafari = iosDevice && !(navigator as any).standalone
    setIsIOS(iosSafari)

    function handler(e: Event) {
      e.preventDefault()
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
      setDeferredPrompt(null)
      setIsInstalled(true)
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setDismissed(true)
  }

  const showBanner = !isInstalled && !dismissed && (deferredPrompt !== null || isIOS)

  return { showBanner, isIOS, install, dismiss }
}
