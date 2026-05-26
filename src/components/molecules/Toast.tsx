import { useEffect, useRef, useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

export interface ToastInfo {
  message: string
  type:    'success' | 'error'
}

export function Toast({ info, onDismiss }: { info: ToastInfo; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    const rafId       = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    const hideTimer   = setTimeout(() => setVisible(false), 2700)
    const removeTimer = setTimeout(() => dismissRef.current(), 3200)
    return () => { cancelAnimationFrame(rafId); clearTimeout(hideTimer); clearTimeout(removeTimer) }
  }, [])

  return (
    <div
      onClick={() => dismissRef.current()}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium cursor-pointer select-none whitespace-nowrap transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${
        info.type === 'success'
          ? 'bg-green-500/15 border-green-500/30 text-green-400 shadow-[0_4px_24px_rgba(34,197,94,0.15)]'
          : 'bg-red-500/15 border-red-500/30 text-red-400 shadow-[0_4px_24px_rgba(239,68,68,0.15)]'
      }`}
    >
      {info.type === 'success'
        ? <CheckCircle size={16} className="shrink-0" />
        : <X size={16} className="shrink-0" />
      }
      {info.message}
    </div>
  )
}
