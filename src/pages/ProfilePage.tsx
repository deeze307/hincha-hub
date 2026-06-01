import { useEffect, useRef, useState } from 'react'
import { Trophy, Zap, Users, Loader2, Camera, Flame, Pencil, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth, getDisplayName } from '../contexts/AuthContext'
import { fetchMyTournamentPositions } from '../services/rankingService'
import { uploadAvatar, fetchUserStreaks, updateAlias, updatePushEnabled } from '../services/profileService'
import { usePushNotifications } from '../hooks/usePushNotifications'
import type { MyTournamentPosition } from '../services/rankingService'

function medalFor(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isGoogleUser = user?.app_metadata?.provider === 'google'

  const displayName = getDisplayName(profile, user?.email)
  const initials    = displayName.split(' ').filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const email     = user?.email ?? ''
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url ?? null

  const [positions,      setPositions]      = useState<MyTournamentPosition[]>([])
  const [streaks,        setStreaks]        = useState<{ current: number; best: number } | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState<string | null>(null)
  const [editingAlias,   setEditingAlias]   = useState(false)
  const [aliasValue,     setAliasValue]     = useState('')
  const [aliasSaving,    setAliasSaving]    = useState(false)
  const [aliasError,     setAliasError]     = useState<string | null>(null)
  const [pushSaving,     setPushSaving]     = useState(false)
  const push = usePushNotifications()

  useEffect(() => {
    Promise.all([
      fetchMyTournamentPositions(20),
      fetchUserStreaks(),
    ]).then(([pos, str]) => {
      setPositions(pos)
      setStreaks(str)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  function handleEditAlias() {
    setAliasValue(profile?.alias ?? '')
    setAliasError(null)
    setEditingAlias(true)
  }

  async function handleTogglePush() {
    if (!user || pushSaving) return
    const next = !(profile?.push_enabled ?? true)
    setPushSaving(true)
    try {
      if (next) {
        await push.subscribe()
      } else {
        await push.unsubscribe()
      }
      await updatePushEnabled(user.id, next)
      await refreshProfile()
    } finally {
      setPushSaving(false)
    }
  }

  async function handleSaveAlias() {
    if (!user) return
    setAliasSaving(true)
    setAliasError(null)
    try {
      await updateAlias(user.id, aliasValue)
      await refreshProfile()
      setEditingAlias(false)
    } catch (err: any) {
      setAliasError(err.message ?? 'Error al guardar el alias')
    } finally {
      setAliasSaving(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const MAX_MB = 2
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`La imagen no puede superar ${MAX_MB} MB`)
      return
    }

    setUploadError(null)
    setUploading(true)
    try {
      await uploadAvatar(user.id, file)
      await refreshProfile()
    } catch (err: any) {
      setUploadError(err.message ?? 'Error al subir la imagen')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const totalPts = positions.reduce((sum, p) => sum + p.totalPts, 0)
  const bestRank = positions.reduce<number | null>((best, p) => {
    if (p.rank === null) return best
    return best === null ? p.rank : Math.min(best, p.rank)
  }, null)

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6 space-y-6">
      <h1 className="text-text text-xl font-semibold">Perfil</h1>

      {/* Avatar + info */}
      <div className="card p-5 flex items-center gap-4">

        {/* Avatar con botón de subida */}
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center">
              <span className="text-white font-bold text-2xl">{initials}</span>
            </div>
          )}

          {/* Botón de cámara — solo para usuarios que NO son de Google */}
          {!isGoogleUser && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand border-2 border-surface flex items-center justify-center hover:bg-brand-h transition-colors disabled:opacity-60"
                title="Cambiar foto"
              >
                {uploading
                  ? <Loader2 size={12} className="text-white animate-spin" />
                  : <Camera size={12} className="text-white" />
                }
              </button>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-text font-semibold text-lg leading-tight">{displayName}</h2>
          <p className="text-muted text-sm mt-0.5 truncate">{email}</p>
          {profile?.role && profile.role !== 'user' && (
            <span className="inline-block mt-2 px-2.5 py-0.5 bg-brand/20 border border-brand/40 text-brand text-xs font-medium rounded-full capitalize">
              {profile.role}
            </span>
          )}
          {uploadError && (
            <p className="text-red-400 text-xs mt-1">{uploadError}</p>
          )}
        </div>
      </div>

      {/* Alias */}
      <div className="card p-5">
        <h3 className="text-text font-semibold text-sm mb-0.5">Alias en torneos</h3>
        <p className="text-muted text-xs mb-3">Tu alias reemplaza tu nombre real en la tabla de posiciones.</p>

        {editingAlias ? (
          <div className="space-y-2">
            <input
              value={aliasValue}
              onChange={e => setAliasValue(e.target.value)}
              maxLength={30}
              autoFocus
              placeholder="Tu alias..."
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-text text-sm outline-none focus:border-brand transition-colors"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingAlias(false)}
                className="px-3 py-2 text-muted hover:text-text text-sm rounded-lg hover:bg-elevated transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAlias}
                disabled={aliasSaving}
                className="px-4 py-2 bg-brand hover:bg-brand-h text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                {aliasSaving ? <Loader2 size={14} className="animate-spin" /> : 'Guardar'}
              </button>
            </div>
            {aliasError && <p className="text-red-400 text-xs">{aliasError}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-lg px-3 py-2">
            <span className={`flex-1 text-sm ${profile?.alias ? 'text-text' : 'text-muted italic'}`}>
              {profile?.alias ?? 'Sin alias configurado'}
            </span>
            <button
              onClick={handleEditAlias}
              className="flex items-center gap-1 text-brand text-xs font-medium shrink-0 hover:underline"
            >
              <Pencil size={12} />
              Editar
            </button>
          </div>
        )}
      </div>

      {/* Notificaciones push */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Bell size={15} className="text-brand" />
            </div>
            <div>
              <h3 className="text-text font-semibold text-sm">Notificaciones push</h3>
              <p className="text-muted text-xs mt-0.5">Recibí alertas aunque la app esté cerrada</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTogglePush}
            disabled={pushSaving}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
              (profile?.push_enabled ?? true) ? 'bg-brand' : 'bg-elevated'
            } disabled:opacity-50`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              (profile?.push_enabled ?? true) ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="text-brand animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Users size={16} className="text-brand" />}
              label="Torneos"
              value={String(positions.length)}
              sub="inscripto"
            />
            <StatCard
              icon={<Trophy size={16} className="text-yellow-400" />}
              label="Mejor pos."
              value={bestRank !== null ? `#${bestRank}` : '—'}
              sub="entre torneos"
            />
            <StatCard
              icon={<Zap size={16} className="text-green-400" />}
              label="Puntos"
              value={totalPts > 0 ? totalPts.toLocaleString('es-AR') : '—'}
              sub="acumulados"
            />
            <StatCard
              icon={<Flame size={16} className="text-orange-400" />}
              label="Racha actual"
              value={streaks ? String(streaks.current) : '—'}
              sub={streaks?.best ? `Mejor: ${streaks.best}` : 'aciertos seguidos'}
              highlight={!!streaks?.current}
            />
          </div>

          {/* Lista de torneos */}
          <section>
            <h2 className="text-text font-semibold mb-3">Mis torneos</h2>
            {positions.length === 0 ? (
              <div className="card p-8 text-center text-muted text-sm">
                No estás inscripto en ningún torneo aún.
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map(p => (
                  <button
                    key={p.tournamentId}
                    onClick={() => navigate(`/torneos/${p.tournamentId}/prode`)}
                    className="card w-full px-4 py-3 flex items-center gap-3 hover:bg-elevated/60 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-elevated shrink-0 flex items-center justify-center">
                      {p.tournamentImage
                        ? <img src={p.tournamentImage} alt="" className="w-full h-full object-cover" />
                        : <span className="text-text text-xs font-bold">
                            {p.tournamentName.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                          </span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text text-sm font-medium truncate">{p.tournamentName}</p>
                      <p className="text-muted text-xs mt-0.5">
                        {p.totalPts > 0 ? `${p.totalPts.toLocaleString('es-AR')} pts` : 'Sin predicciones aún'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {p.rank !== null && p.rank > 0 ? (
                        <span className="text-sm font-bold text-text">
                          {medalFor(p.rank) || `#${p.rank}`}
                        </span>
                      ) : (
                        <span className="text-muted-dark text-xs">—</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, sub, highlight = false,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={`card p-4 ${highlight ? 'border-orange-400/30' : ''}`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-muted text-xs font-medium">{label}</span>
      </div>
      <p className={`font-bold text-xl ${highlight ? 'text-orange-400' : 'text-text'}`}>{value}</p>
      <p className="text-muted text-xs mt-0.5">{sub}</p>
    </div>
  )
}
