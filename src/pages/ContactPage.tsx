import { Mail } from 'lucide-react'

export default function ContactPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text mb-1">Contacto</h1>
      <p className="text-sm text-muted mb-6">Estamos para ayudarte.</p>

      <div className="bg-surface border border-border rounded-xl divide-y divide-border">
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Consultas generales</p>
          <a
            href="mailto:deeze.designs@gmail.com"
            className="flex items-center gap-3 text-sm text-brand hover:underline"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-brand/10 shrink-0">
              <Mail size={15} className="text-brand" />
            </span>
            deeze.designs@gmail.com
          </a>
        </div>
      </div>
    </div>
  )
}
