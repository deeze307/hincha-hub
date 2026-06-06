import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import Modal from '../components/organisms/Modal'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModalButton {
  label:    string
  onClick:  () => void | Promise<void>
  variant?: 'primary' | 'danger'
}

interface ModalFooterConfig {
  primary?:   ModalButton
  secondary?: ModalButton
}

export interface ModalOptions {
  header?:      ReactNode
  content:      ReactNode
  footer?:      ModalFooterConfig
  dismissible?: boolean        // default: true
  maxWidth?:    'sm' | 'md' | 'lg'
}

export interface ConfirmOptions {
  title:           string
  message:         ReactNode
  confirmLabel?:   string
  confirmVariant?: 'primary' | 'danger'
  onConfirm:       () => void | Promise<void>
  onCancel?:       () => void
}

interface ModalContextValue {
  openModal:  (opts: ModalOptions) => void
  closeModal: () => void
  confirm:    (opts: ConfirmOptions) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ModalContext = createContext<ModalContextValue | null>(null)

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ModalProvider({ children }: { children: ReactNode }) {
  const [mounted,        setMounted]        = useState(false)
  const [visible,        setVisible]        = useState(false)
  const [options,        setOptions]        = useState<ModalOptions | null>(null)
  const [primaryLoading, setPrimaryLoading] = useState(false)

  const closeModal = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      setMounted(false)
      setOptions(null)
    }, 300)
  }, [])

  const openModal = useCallback((opts: ModalOptions) => {
    setOptions(opts)
    setMounted(true)
    setTimeout(() => setVisible(true), 10)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    openModal({
      header: (
        <h2 className="text-text font-semibold text-base">{opts.title}</h2>
      ),
      content: (
        typeof opts.message === 'string'
          ? <p className="text-muted text-sm leading-relaxed">{opts.message}</p>
          : opts.message
      ),
      footer: {
        primary: {
          label:   opts.confirmLabel  ?? 'Confirmar',
          variant: opts.confirmVariant ?? 'danger',
          onClick: opts.onConfirm,
        },
        secondary: {
          label:   'Cancelar',
          onClick: () => opts.onCancel?.(),
        },
      },
      dismissible: true,
    })
  }, [openModal])

  async function handlePrimary() {
    if (!options?.footer?.primary?.onClick) return
    setPrimaryLoading(true)
    try {
      await options.footer.primary.onClick()
    } finally {
      setPrimaryLoading(false)
      closeModal()
    }
  }

  function handleSecondary() {
    options?.footer?.secondary?.onClick?.()
    closeModal()
  }

  const footer = options?.footer ? (
    <div className="flex gap-3">
      {options.footer.secondary && (
        <button onClick={handleSecondary} className="flex-1 btn-secondary">
          {options.footer.secondary.label}
        </button>
      )}
      {options.footer.primary && (
        <button
          onClick={handlePrimary}
          disabled={primaryLoading}
          className={
            options.footer.primary.variant === 'danger'
              ? 'flex-1 font-semibold py-2.5 px-4 rounded-[10px] bg-red-500 hover:bg-red-600 active:scale-[0.97] text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed'
              : 'flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed'
          }
        >
          {primaryLoading ? 'Cargando...' : options.footer.primary.label}
        </button>
      )}
    </div>
  ) : undefined

  return (
    <ModalContext.Provider value={{ openModal, closeModal, confirm }}>
      {children}
      {mounted && options && (
        <Modal
          visible={visible}
          onClose={closeModal}
          dismissible={options.dismissible}
          maxWidth={options.maxWidth}
          header={options.header}
          footer={footer}
        >
          {options.content}
        </Modal>
      )}
    </ModalContext.Provider>
  )
}
