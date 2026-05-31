import { useEffect, useState }  from 'react'
import { useNavigate }          from 'react-router-dom'
import { Trophy, Bell, X }      from 'lucide-react'
import MatchesCard              from '../components/organisms/dashboard/MatchesCard'
import MyTournamentsCard        from '../components/organisms/dashboard/MyTournamentsCard'
import { useAuth }              from '../contexts/AuthContext'
import { fetchMyTournamentPositions } from '../services/rankingService'
import type { MyTournamentPosition }  from '../services/rankingService'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function HomePage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const firstName   = profile?.full_name?.split(' ')[0] ?? profile?.username ?? 'hincha'

  const [positions, setPositions]         = useState<MyTournamentPosition[]>([])
  const [tournamentsLoading, setTLoading] = useState(true)
  const [pushDismissed, setPushDismissed] = useState(
    () => localStorage.getItem('push-banner-dismissed') === '1'
  )

  const push = usePushNotifications()

  function dismissPushBanner() {
    localStorage.setItem('push-banner-dismissed', '1')
    setPushDismissed(true)
  }

  useEffect(() => {
    fetchMyTournamentPositions(5)
      .then(setPositions)
      .finally(() => setTLoading(false))
  }, [])

  const noTournaments = !tournamentsLoading && positions.length === 0

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <h1 className="text-text text-xl font-semibold tracking-tight">
        Hola, {firstName}!
      </h1>

      {/* Banner de activación push */}
      {push.isSupported && !push.subscribed && push.permission !== 'denied' && !pushDismissed && (
        <div className="flex items-center gap-3 bg-brand/10 border border-brand/25 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
            <Bell size={15} className="text-brand" />
          </div>
          <p className="flex-1 text-sm text-text leading-snug">
            <span className="font-semibold">Activá las notificaciones</span>
            <span className="text-muted"> para recibir alertas de partidos, puntos y más.</span>
          </p>
          <button
            onClick={push.subscribe}
            disabled={push.loading}
            className="btn-primary text-xs py-1.5 px-3 shrink-0"
          >
            {push.loading ? '...' : 'Activar'}
          </button>
          <button
            onClick={dismissPushBanner}
            className="text-muted hover:text-text transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Banner sin torneos */}
      {noTournaments && (
        <div className="flex items-center gap-4 bg-brand/10 border border-brand/25 rounded-xl px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center shrink-0">
            <Trophy size={20} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text text-sm font-semibold leading-snug">¡Todavía no estás en ningún torneo!</p>
            <p className="text-muted text-xs mt-0.5 leading-relaxed">
              Sumate a un torneo para empezar a predecir partidos y competir con otros hinchas.
            </p>
          </div>
          <button
            onClick={() => navigate('/torneos')}
            className="btn-primary text-xs py-2 px-3 shrink-0"
          >
            Ver torneos
          </button>
        </div>
      )}

      {/* Fila 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-5">
        <MatchesCard />
        <MyTournamentsCard positions={positions} loading={tournamentsLoading} />
      </div>
    </div>
  )
}
