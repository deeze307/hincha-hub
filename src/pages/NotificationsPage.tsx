import { useEffect, useRef, useState } from 'react'
import { Search, Target, Users, Megaphone, ChevronLeft, ChevronRight, CheckCheck } from 'lucide-react'
import { fetchNotificationsPage, markNotificationRead, markAllNotificationsRead } from '../services/notificationsService'
import { useNotificationsStore } from '../store/useNotificationsStore'
import type { Notification } from '../store/useNotificationsStore'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const TYPE_ICON: Record<Notification['type'], React.ReactNode> = {
  prediction: <Target   size={14} className="text-brand"     />,
  league:     <Users    size={14} className="text-blue-400"  />,
  system:     <Megaphone size={14} className="text-muted"    />,
}

const TYPE_LABEL: Record<Notification['type'], string> = {
  prediction: 'Predicción',
  league:     'Liga',
  system:     'Sistema',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NotificationsPage() {
  const { fetch: refreshBell } = useNotificationsStore()

  const [rows, setRows]           = useState<Notification[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [pageSize, setPageSize]   = useState(20)
  const [search, setSearch]       = useState('')
  const [query, setQuery]         = useState('')   // valor debounceado
  const [loading, setLoading]     = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function load(p: number, ps: number, q: string) {
    setLoading(true)
    try {
      const res = await fetchNotificationsPage({ page: p, pageSize: ps, search: q })
      setRows(res.data)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }

  // Debounce del buscador
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      setQuery(search)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => {
    load(page, pageSize, query)
  }, [page, pageSize, query])

  async function handleMarkRead(n: Notification) {
    if (n.read) return
    setRows(prev => prev.map(r => r.id === n.id ? { ...r, read: true } : r))
    setTotal(t => t) // sin cambio en total
    await markNotificationRead(n.id)
    refreshBell()
  }

  async function handleMarkAllRead() {
    const ids = rows.filter(r => !r.read).map(r => r.id)
    if (ids.length === 0) return
    setRows(prev => prev.map(r => ({ ...r, read: true })))
    await markAllNotificationsRead(ids)
    refreshBell()
  }

  const unreadOnPage = rows.filter(r => !r.read).length

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-text text-xl font-semibold tracking-tight">Notificaciones</h1>
        {unreadOnPage > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-ghost flex items-center gap-2 text-[13px]"
          >
            <CheckCheck size={15} />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Buscador + selector de página */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-dark" />
          <input
            type="text"
            placeholder="Buscar notificaciones..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 py-2.5 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-muted text-xs">Por página:</span>
          {PAGE_SIZE_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setPageSize(s); setPage(0) }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                pageSize === s
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-text hover:bg-elevated'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Tipo', 'Notificación', 'Fecha', 'Estado'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] text-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-muted text-sm">
                  {query ? 'Sin resultados para esa búsqueda.' : 'No tenés notificaciones.'}
                </td>
              </tr>
            ) : rows.map(n => (
              <tr
                key={n.id}
                onClick={() => handleMarkRead(n)}
                className={`border-b border-border/40 last:border-0 transition-colors cursor-pointer ${
                  n.read ? 'hover:bg-elevated' : 'bg-brand/5 hover:bg-brand/10'
                }`}
              >
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center shrink-0">
                      {TYPE_ICON[n.type]}
                    </div>
                    <span className="text-muted text-xs">{TYPE_LABEL[n.type]}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <p className={`text-sm leading-snug ${n.read ? 'text-muted' : 'text-text font-medium'}`}>
                    {n.text}
                  </p>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-muted text-xs">
                  {formatDate(n.created_at)}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  {n.read
                    ? <span className="text-muted-dark text-xs">Leída</span>
                    : <span className="badge-brand text-[10px]">Nueva</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginado */}
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs">
          {total === 0 ? '0 resultados' : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} de ${total}`}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i)
            .filter(i => Math.abs(i - page) <= 2)
            .map(i => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                  i === page
                    ? 'bg-brand text-white'
                    : 'text-muted hover:text-text hover:bg-elevated'
                }`}
              >
                {i + 1}
              </button>
            ))
          }

          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
