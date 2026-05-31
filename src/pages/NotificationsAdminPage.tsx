import { useState } from 'react'
import { Send, Loader2, Users, User, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface UserResult {
  id:        string
  full_name: string | null
  alias:     string | null
  email:     string | null
}

export default function NotificationsAdminPage() {
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [url,         setUrl]         = useState('/')
  const [broadcast,   setBroadcast]   = useState(true)
  const [userSearch,  setUserSearch]  = useState('')
  const [searching,   setSearching]   = useState(false)
  const [results,     setResults]     = useState<UserResult[]>([])
  const [selected,    setSelected]    = useState<UserResult[]>([])
  const [sending,     setSending]     = useState(false)
  const [feedback,    setFeedback]    = useState<{ ok: boolean; msg: string } | null>(null)

  async function searchUsers(q: string) {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, alias')
        .or(`full_name.ilike.%${q}%,alias.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(10)
      setResults((data ?? []) as UserResult[])
    } finally {
      setSearching(false)
    }
  }

  function toggleUser(u: UserResult) {
    setSelected(prev =>
      prev.find(x => x.id === u.id)
        ? prev.filter(x => x.id !== u.id)
        : [...prev, u]
    )
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) return
    if (!broadcast && selected.length === 0) return
    setSending(true)
    setFeedback(null)
    try {
      const payload = broadcast
        ? { broadcast: true, title, body, url }
        : { user_ids: selected.map(u => u.id), title, body, url }

      const { data, error } = await supabase.functions.invoke('send-push', { body: payload })

      if (error) throw error

      setFeedback({ ok: true, msg: `Enviado a ${data.sent} de ${data.total} dispositivos` })
      setTitle('')
      setBody('')
      setUrl('/')
      setSelected([])
      setUserSearch('')
      setResults([])
    } catch (err: any) {
      setFeedback({ ok: false, msg: err.message ?? 'Error al enviar' })
    } finally {
      setSending(false)
    }
  }

  const displayName = (u: UserResult) => u.alias ?? u.full_name ?? u.email ?? u.id

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-text text-xl font-semibold tracking-tight">Enviar notificación</h1>

      {feedback && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          feedback.ok
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}>
          {feedback.msg}
        </div>
      )}

      <div className="card p-5 space-y-4">

        {/* Destinatarios */}
        <div>
          <label className="label mb-2">Destinatarios</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['true',  'General', 'Todos los usuarios con push activado', Users],
              ['false', 'Personalizado', 'Usuarios específicos que selecciones', User],
            ] as const).map(([val, title, desc, Icon]) => (
              <label
                key={val}
                className={`flex flex-col gap-1.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  String(broadcast) === val ? 'border-brand bg-brand/5' : 'border-border hover:border-border/80'
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  checked={String(broadcast) === val}
                  onChange={() => setBroadcast(val === 'true')}
                />
                <div className="flex items-center gap-2">
                  <Icon size={14} className={String(broadcast) === val ? 'text-brand' : 'text-muted'} />
                  <span className="text-text text-sm font-semibold">{title}</span>
                </div>
                <span className="text-muted text-xs leading-relaxed">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Buscador de usuarios (modo personalizado) */}
        {!broadcast && (
          <div className="space-y-2">
            <label className="label">Buscar usuarios</label>
            <input
              type="text"
              placeholder="Nombre, alias..."
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value) }}
              className="input"
            />
            {searching && <p className="text-muted text-xs">Buscando...</p>}
            {results.length > 0 && (
              <div className="bg-elevated border border-border rounded-xl overflow-hidden">
                {results.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-surface transition-colors border-b border-border/40 last:border-0 ${
                      selected.find(x => x.id === u.id) ? 'text-brand' : 'text-text'
                    }`}
                  >
                    <span>{displayName(u)}</span>
                    {selected.find(x => x.id === u.id) && (
                      <span className="text-[10px] font-semibold bg-brand/20 text-brand px-2 py-0.5 rounded-full">Seleccionado</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selected.map(u => (
                  <span key={u.id} className="flex items-center gap-1.5 bg-brand/10 border border-brand/30 text-brand text-xs font-medium px-2.5 py-1 rounded-full">
                    {displayName(u)}
                    <button onClick={() => toggleUser(u)} className="hover:text-red-400 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Título */}
        <div className="space-y-1.5">
          <label className="label">Título *</label>
          <input
            type="text"
            placeholder="Ej: Nueva jornada disponible"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input"
          />
        </div>

        {/* Cuerpo */}
        <div className="space-y-1.5">
          <label className="label">Mensaje *</label>
          <textarea
            placeholder="Ej: Ya podés hacer tus predicciones para los partidos de hoy"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            className="input resize-none"
          />
        </div>

        {/* URL de destino */}
        <div className="space-y-1.5">
          <label className="label">URL al abrir (opcional)</label>
          <input
            type="text"
            placeholder="Ej: /torneos o /partidos"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="input"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim() || (!broadcast && selected.length === 0)}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {sending
            ? <Loader2 size={15} className="animate-spin" />
            : <Send size={15} />
          }
          {sending ? 'Enviando...' : 'Enviar notificación'}
        </button>
      </div>
    </div>
  )
}
