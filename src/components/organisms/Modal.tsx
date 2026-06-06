import type { ReactNode } from 'react'

export interface ModalProps {
  visible:      boolean
  onClose?:     () => void
  dismissible?: boolean
  maxWidth?:    'sm' | 'md' | 'lg'
  header?:      ReactNode
  footer?:      ReactNode
  children:     ReactNode
}

const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const

export default function Modal({
  visible,
  onClose,
  dismissible = true,
  maxWidth    = 'md',
  header,
  footer,
  children,
}: ModalProps) {
  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-sm',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className={[
          'bg-surface border border-border rounded-2xl w-full shadow-elevated',
          widths[maxWidth],
          'transition-all duration-300 ease-out',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        {header && (
          <div className="px-6 pt-6 pb-4 border-b border-border">
            {header}
          </div>
        )}

        <div className={[
          'px-6 overflow-y-auto max-h-[60vh]',
          header ? 'pt-5' : 'pt-6',
          footer ? 'pb-5' : 'pb-6',
        ].join(' ')}>
          {children}
        </div>

        {footer && (
          <div className="px-6 pt-4 pb-6 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
