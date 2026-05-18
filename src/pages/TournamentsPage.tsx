import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Lock, Globe, ChevronRight, Loader2 } from 'lucide-react'
import { fetchTournaments, joinTournament, requestJoinTournament } from '../services/tournamentsService'
import type { Tournament } from '../services/tournamentsService'
import { useAuth } from '../contexts/AuthContext'

function TournamentInitials({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <div className="w-full h-full bg-elevated flex items-center justify-center">
      <span className="text-text text-3xl font-bold tracking-tight">{initials}</span>
    </div>
  )
}

type Tab = 'all' | 'mine' | 'managed'

export default function TournamentsPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<Tab>('all')
  const [joining, setJoining]         = useState<string | null>(null)

  const isSuperAdmin = profile?.role === 'superadmin'

  async function load() {
    setLoading(true)
    try {
      const data = await fetchTournaments()
      setTournaments(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = tournaments.filter(t => {
    if (tab === 'mine')    return t.is_registered
    if (tab === 'managed') return t.created_by === profile?.id
    return true
  })

  async function handleJoin(t: Tournament) {
    setJoining(t.id)
    try {
      if (t.access_type === 'open') {
        await joinTournament(t.id)
      } else {
        await requestJoinTournament(t.id)
      }
      await load()
    } finally {
      setJoining(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-text text-xl font-semibold tracking-tight">Torneos</h1>
        {isSuperAdmin && (
          <button
            onClick={() => navigate('/torneos/nuevo')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Nuevo torneo
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated p-1 rounded-md w-fit">
        {([['all','Todos'],['mine','Mis torneos'],['managed','Administrados']] as [Tab,string][]).map(([v,l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-[8px] text-sm font-semibold transition-all ${
              tab === v ? 'bg-brand text-white' : 'text-muted hover:text-text'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="text-brand animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          {tab === 'all' ? 'No hay torneos disponibles.' :
           tab === 'mine' ? 'No estás inscripto en ningún torneo.' :
           'No administrás ningún torneo.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(t => (
            <TournamentCard
              key={t.id}
              tournament={t}
              isSuperAdmin={isSuperAdmin}
              currentUserId={profile?.id}
              joining={joining === t.id}
              onJoin={() => handleJoin(t)}
              onManage={() => navigate(`/torneos/${t.id}/editar`)}
              onProde={() => navigate(`/torneos/${t.id}/prode`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  tournament:    Tournament
  isSuperAdmin:  boolean
  currentUserId: string | undefined
  joining:       boolean
  onJoin:        () => void
  onManage:      () => void
  onProde:       () => void
}

function TournamentCard({ tournament: t, isSuperAdmin, currentUserId, joining, onJoin, onManage, onProde }: CardProps) {
  const isOwner      = t.created_by === currentUserId
  const canManage    = isOwner || isSuperAdmin
  const participantN = typeof t.participant_count === 'number' ? t.participant_count : 0
  const isFull       = t.max_participants != null && participantN >= t.max_participants

  return (
    <div className="card flex flex-col overflow-hidden group">
      {/* Cover */}
      <div className="h-28 bg-elevated overflow-hidden relative">
        {t.image_url
          ? <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
          : <TournamentInitials name={t.name} />
        }
        {/* Access badge */}
        <div className="absolute top-2 right-2">
          {t.access_type === 'open'
            ? <span className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full"><Globe size={9}/> Abierto</span>
            : <span className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-semibold px-2 py-0.5 rounded-full"><Lock size={9}/> Con solicitud</span>
          }
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          {t.competition && (
            <p className="text-muted-dark text-[10px] font-semibold uppercase tracking-wider mb-1">
              {t.competition.name}
            </p>
          )}
          <h3 className="text-text text-sm font-semibold leading-tight">{t.name}</h3>
          {t.description && (
            <p className="text-muted text-xs mt-1 line-clamp-2 leading-relaxed">{t.description}</p>
          )}
        </div>

        {/* Participants + Editar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-muted text-xs">
            <Users size={12} />
            <span>
              {participantN}
              {t.max_participants != null && ` / ${t.max_participants}`}
              {' '}participantes
            </span>
          </div>
          {canManage && (
            <button onClick={onManage} className="btn-secondary text-[11px] py-1 px-2.5 shrink-0">
              Editar
            </button>
          )}
        </div>

        {/* Action */}
        <div className="mt-auto">
          {(canManage || t.is_registered) ? (
            <button onClick={onProde} className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1">
              Ver Prode <ChevronRight size={13} />
            </button>
          ) : t.has_pending_request ? (
            <span className="block w-full text-center text-xs text-yellow-400 font-semibold py-2">Solicitud enviada</span>
          ) : isFull ? (
            <span className="block w-full text-center text-xs text-muted py-2">Torneo lleno</span>
          ) : (
            <button
              onClick={onJoin}
              disabled={joining}
              className="btn-primary w-full text-xs py-2"
            >
              {joining ? <Loader2 size={13} className="animate-spin" /> :
               t.access_type === 'open' ? 'Unirse' : 'Solicitar ingreso'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
