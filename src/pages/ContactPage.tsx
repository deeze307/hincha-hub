import { useEffect, useState } from 'react'
import { Mail, MessageCircle, AtSign, Loader2 } from 'lucide-react'
import { fetchContactInfo, type ContactInfo } from '../services/contactService'

interface ContactLink {
  icon:  React.ReactNode
  label: string
  href:  string
}

export default function ContactPage() {
  const [info, setInfo]       = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContactInfo()
      .then(setInfo)
      .finally(() => setLoading(false))
  }, [])

  const links: ContactLink[] = []
  if (info?.email) {
    links.push({ icon: <Mail size={15} className="text-brand" />, label: info.email, href: `mailto:${info.email}` })
  }
  if (info?.whatsapp) {
    links.push({ icon: <MessageCircle size={15} className="text-brand" />, label: 'WhatsApp', href: `https://wa.me/${info.whatsapp}` })
  }
  if (info?.instagram) {
    links.push({ icon: <AtSign size={15} className="text-brand" />, label: `@${info.instagram}`, href: `https://instagram.com/${info.instagram}` })
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-text mb-1">Contacto</h1>
      <p className="text-sm text-muted mb-6">{info?.subtitle ?? 'Estamos para ayudarte.'}</p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={20} className="text-brand animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl px-5 py-6 text-center text-muted text-sm">
          No hay información de contacto disponible.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl divide-y divide-border">
          <div className="px-5 py-4">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-3">Consultas generales</p>
            <div className="space-y-3">
              {links.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  target={l.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-brand hover:underline"
                >
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-brand/10 shrink-0">
                    {l.icon}
                  </span>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
