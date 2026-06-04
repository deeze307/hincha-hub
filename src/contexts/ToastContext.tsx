import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Toast, type ToastInfo } from '../components/molecules/Toast'

interface ToastContextValue {
  showToast: (message: string, type: ToastInfo['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastInfo | null>(null)

  const showToast = useCallback((message: string, type: ToastInfo['type']) => {
    setToast({ message, type })
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast info={toast} onDismiss={() => setToast(null)} />}
    </ToastContext.Provider>
  )
}
