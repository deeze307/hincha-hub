import { useEffect, useState } from 'react'
import { Check, X, Loader2, Inbox } from 'lucide-react'
import { useRequestsStore } from '../store/useRequestsStore'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function UserInitials({ name }: { name: string | null }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center shrink-0">
      <span className="text-white text-xs font-semibold">{initials}</span>
    </div>
  )
}

export default function RequestsPage() {
  const { requests, loading, fetchAll, accept, reject } = useRequestsStore()
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function handleAccept(id: string) {
    const req = requests.find(r => r.id === id)
    if (!req) return
    setActioning(id)
    try { await accept(req) } finally { setActioning(null) }
  }

  async function handleReject(id: string) {
    const req = requests.find(r => r.id === id)
    if (!req) return
    setActioning(id)
    try { await reject(req) } finally { setActioning(null) }
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-text text-xl font-semibold tracking-tight">Solicitudes</h1>
        {requests.length > 0 && (
          <span className="badge-brand">{requests.length} pendiente{requests.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="text-brand animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Inbox size={36} className="text-muted-dark" />
          <p className="text-muted text-sm">No hay solicitudes pendientes.</p>
        </div>
      ) : (
        <>
          {/* ── Tabla (desktop) ── */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Solicitante', 'Acción', 'Fecha', 'Responder'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] text-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const name = r.profile?.full_name ?? r.profile?.username ?? 'Usuario'
                  const isActioning = actioning === r.id
                  return (
                    <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-elevated transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <UserInitials name={name} />
                          <span className="text-text text-sm font-medium">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-muted text-sm">
                          Ingresar al torneo{' '}
                          <span className="text-text font-medium">{r.tournament?.name ?? '—'}</span>
                        </p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-muted text-xs">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAccept(r.id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
                          >
                            {isActioning ? <Loader2 size={12} className="animate-spin" /> : <Check size={13} />}
                            Aceptar
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={isActioning}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                          >
                            <X size={13} />
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Tarjetas (mobile) ── */}
          <div className="md:hidden space-y-3">
            {requests.map(r => {
              const name = r.profile?.full_name ?? r.profile?.username ?? 'Usuario'
              const isActioning = actioning === r.id
              return (
                <div key={r.id} className="card p-4 space-y-3">
                  {/* Usuario + fecha */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <UserInitials name={name} />
                      <span className="text-text text-sm font-semibold">{name}</span>
                    </div>
                    <span className="text-muted text-[11px] shrink-0">{formatDate(r.created_at)}</span>
                  </div>

                  {/* Acción */}
                  <p className="text-muted text-sm">
                    Solicita ingresar al torneo{' '}
                    <span className="text-text font-semibold">{r.tournament?.name ?? '—'}</span>
                  </p>

                  {/* Botones */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleAccept(r.id)}
                      disabled={isActioning}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/15 text-green-400 text-sm font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
                    >
                      {isActioning ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      disabled={isActioning}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      <X size={14} />
                      Rechazar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
