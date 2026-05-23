import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { resolveInviteToken } from '../services/inviteService'
import { joinTournament } from '../services/tournamentsService'
import logo from '../assets/images/logo2_transparente.png'

type Status = 'loading' | 'success' | 'expired' | 'error'

export default function InvitePage() {
  const { token }                  = useParams<{ token: string }>()
  const navigate                   = useNavigate()
  const location                   = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus]        = useState<Status>('loading')
  const [tournamentName, setTournamentName] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(location.pathname)}`, { replace: true })
      return
    }

    async function process() {
      try {
        const invite = await resolveInviteToken(token!)
        if (!invite) { setStatus('expired'); return }

        setTournamentName(invite.tournament_name)

        try {
          await joinTournament(invite.tournament_id)
        } catch (e: any) {
          // ignore duplicate-key: user already registered
          const code = e?.code ?? e?.message ?? ''
          if (!code.includes('23505') && !code.includes('duplicate')) throw e
        }

        setStatus('success')
        setTimeout(() => navigate(`/torneos/${invite.tournament_id}/prode`, { replace: true }), 1500)
      } catch {
        setStatus('error')
      }
    }

    process()
  }, [user, authLoading, token, navigate, location.pathname])

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
      <img src={logo} alt="HinchaHub" className="h-10 object-contain mb-2" />

      {status === 'loading' && (
        <>
          <Loader2 size={32} className="text-brand animate-spin" />
          <p className="text-muted text-sm">Procesando invitación…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle size={44} className="text-green-400" />
          <div>
            <p className="text-text font-semibold text-lg">¡Te uniste a {tournamentName}!</p>
            <p className="text-muted text-sm mt-1">Redirigiendo al prode…</p>
          </div>
        </>
      )}

      {status === 'expired' && (
        <>
          <XCircle size={44} className="text-brand" />
          <div>
            <p className="text-text font-semibold text-lg">Link vencido</p>
            <p className="text-muted text-sm mt-1">Este link de invitación ya expiró. Pedile uno nuevo al organizador.</p>
          </div>
          <button onClick={() => navigate('/torneos')} className="btn-primary text-sm py-2 px-5">
            Ver torneos
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={44} className="text-brand" />
          <div>
            <p className="text-text font-semibold text-lg">Algo salió mal</p>
            <p className="text-muted text-sm mt-1">No pudimos procesar la invitación.</p>
          </div>
          <button onClick={() => navigate('/')} className="btn-primary text-sm py-2 px-5">
            Ir al inicio
          </button>
        </>
      )}
    </div>
  )
}
