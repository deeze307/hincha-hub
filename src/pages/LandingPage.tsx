import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useScoringConfig } from '../contexts/ScoringConfigContext'
import { Trophy, Users, Zap, ChevronRight, Star, Globe2, Shield } from 'lucide-react'
import logoFull from '../assets/images/logo2_transparente.png'
import isotipo  from '../assets/images/isotipo.png'

const COMPETITIONS = [
  'Copa Mundial FIFA',
  'Champions League',
  'Copa Libertadores',
  'Copa Sudamericana',
  'Liga Profesional Argentina',
  'Copa Argentina',
]

const FEATURES = [
  {
    icon: Zap,
    title: 'Predecí cada partido',
    desc: 'Apostá el resultado antes de que empiece. Más puntos si predecís con más anticipación. Resultado exacto, ganador, goles y más.',
  },
  {
    icon: Users,
    title: 'Competí con amigos',
    desc: 'Creá torneos privados, invitá a tus amigos y armá un pozo. También podés unirte a torneos públicos y medir tu nivel contra otros hinchas.',
  },
  {
    icon: Trophy,
    title: 'Seguí tus ligas',
    desc: 'Fixtures actualizados en tiempo real de las competiciones más importantes. Resultados, grupos, eliminatorias y estadísticas de cada equipo.',
  },
]

const STEPS = [
  { n: '1', title: 'Creá tu cuenta', desc: 'Registrate gratis con tu email o Google en menos de un minuto.' },
  { n: '2', title: 'Inscribite a un torneo', desc: 'Elegí una competición, unite a un torneo público o creá uno privado con tus amigos.' },
  { n: '3', title: 'Predecí y sumá puntos', desc: 'Cargá tus pronósticos antes de cada partido y seguí el ranking en tiempo real.' },
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const { early_cutoff_hours: cutoff } = useScoringConfig()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/inicio', { replace: true })
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base text-text font-sans">

      {/* ── Navbar ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-base/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <img src={isotipo}  alt="HinchaHub" className="h-9 w-9 object-contain sm:hidden" />
          <img src={logoFull} alt="HinchaHub" className="h-7 w-auto hidden sm:block" />
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="text-sm font-medium text-muted hover:text-text transition-colors px-3 py-1.5"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth"
              className="text-sm font-semibold bg-brand text-white px-4 py-1.5 rounded-full hover:bg-brand-h transition-colors"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* glow de fondo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,116,3,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center relative">
          <div className="inline-flex items-center gap-1.5 bg-brand/10 border border-brand/20 text-brand text-xs font-semibold px-3 py-1 rounded-full mb-6">
            <Star size={11} fill="currentColor" />
            El prode de los hinchas argentinos
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-5">
            Donde compiten{' '}
            <span className="text-brand">los Hinchas</span>
          </h1>

          <p className="text-muted text-base sm:text-lg max-w-xl mx-auto leading-relaxed mb-8">
            Predecí resultados, armá torneos con amigos y seguí Champions League,
            Copa Libertadores, Liga Profesional y más — todo en un solo lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-h text-white font-semibold px-7 py-3 rounded-full transition-colors text-sm shadow-[0_4px_20px_rgba(255,116,3,0.35)]"
            >
              Crear cuenta gratis
              <ChevronRight size={16} />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 border border-border hover:border-muted-dark text-muted hover:text-text font-medium px-7 py-3 rounded-full transition-colors text-sm"
            >
              Ya tengo cuenta
            </Link>
          </div>

          {/* mock phone preview */}
          <div className="mt-16 flex justify-center">
            <div
              className="relative w-[280px] rounded-[2.5rem] overflow-hidden border-2 border-border shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
              style={{ background: '#0B1020' }}
            >
              {/* status bar mock */}
              <div className="flex justify-between items-center px-6 pt-3 pb-1">
                <span className="text-[10px] text-muted font-medium">9:41</span>
                <div className="flex gap-1">
                  <div className="w-3 h-1.5 rounded-sm bg-muted-dark" />
                  <div className="w-1 h-1.5 rounded-sm bg-muted-dark" />
                </div>
              </div>
              {/* header mock */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <img src={isotipo} alt="" className="w-7 h-7 object-contain" />
                <span className="text-xs text-muted">🔔</span>
              </div>
              {/* content */}
              <div className="px-3 py-3 space-y-2">
                <p className="text-text font-bold text-sm px-1">Hola, hincha!</p>
                {/* partidos card */}
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-[9px] text-muted font-bold uppercase tracking-widest mb-2">Partidos de hoy</p>
                  {[
                    { h: 'ARG', hLogo: 'https://media.api-sports.io/football/teams/26.png',  a: 'BRA', aLogo: 'https://media.api-sports.io/football/teams/6.png', ph: 2, pa: 1 },
                    { h: 'ESP', hLogo: 'https://media.api-sports.io/football/teams/9.png',   a: 'ING', aLogo: 'https://media.api-sports.io/football/teams/10.png', ph: 1, pa: 1 },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center gap-1 py-1.5 border-b border-border/30 last:border-0 text-[10px]">
                      <span className="w-6 text-center text-muted-dark">19:00</span>
                      <div className="flex-1 flex items-center justify-end gap-1">
                        <span className="font-semibold">{m.h}</span>
                        <img src={m.hLogo} alt={m.h} className="w-4 h-4 object-contain" />
                      </div>
                      <span className="mx-1 px-2 py-0.5 bg-elevated rounded font-bold text-brand">{m.ph}-{m.pa}</span>
                      <div className="flex-1 flex items-center gap-1">
                        <img src={m.aLogo} alt={m.a} className="w-4 h-4 object-contain" />
                        <span className="font-semibold">{m.a}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* torneos card */}
                <div className="bg-surface rounded-xl p-3">
                  <p className="text-[9px] text-muted font-bold uppercase tracking-widest mb-2">Mis torneos</p>
                  {[
                    { name: 'Copa Libertadores', pts: 93, pos: 1 },
                    { name: 'Champions League', pts: 211, pos: 2 },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                      <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center">
                        <Trophy size={10} className="text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-semibold truncate">{t.name}</p>
                        <p className="text-[8px] text-muted">{t.pts} pts</p>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-[9px] font-bold text-white">
                        #{t.pos}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-20 px-5" aria-labelledby="features-title">
        <div className="max-w-5xl mx-auto">
          <h2 id="features-title" className="text-2xl sm:text-3xl font-bold text-center mb-3">
            Todo lo que necesita un hincha
          </h2>
          <p className="text-muted text-center text-sm mb-12">
            Competiciones en vivo, pronósticos y torneos con amigos en una sola app.
          </p>

          <div className="grid sm:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-surface border border-border rounded-2xl p-6 hover:border-brand/30 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
                  <Icon size={22} className="text-brand" />
                </div>
                <h3 className="font-semibold text-text mb-2">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Competiciones ────────────────────────────────────── */}
      <section className="py-16 px-5 border-y border-border" aria-labelledby="comps-title">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Globe2 size={16} className="text-brand" />
            <h2 id="comps-title" className="text-sm font-semibold text-muted uppercase tracking-widest">
              Competiciones disponibles
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {COMPETITIONS.map(c => (
              <span
                key={c}
                className="bg-elevated border border-border text-muted text-xs font-medium px-4 py-2 rounded-full"
              >
                {c}
              </span>
            ))}
            <span className="bg-elevated border border-border/50 text-muted-dark text-xs font-medium px-4 py-2 rounded-full">
              + más competiciones
            </span>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────── */}
      <section className="py-20 px-5" aria-labelledby="how-title">
        <div className="max-w-3xl mx-auto">
          <h2 id="how-title" className="text-2xl sm:text-3xl font-bold text-center mb-3">
            Empezá en 3 pasos
          </h2>
          <p className="text-muted text-center text-sm mb-12">Sin instalación. Sin configuración. Solo fútbol.</p>

          <div className="space-y-5">
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="flex gap-5 items-start">
                <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center shrink-0 font-bold text-white shadow-[0_0_20px_rgba(255,116,3,0.3)]">
                  {n}
                </div>
                <div className="pt-1">
                  <h3 className="font-semibold text-text mb-1">{title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sistema de puntos ────────────────────────────────── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto bg-surface border border-border rounded-2xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Shield size={18} className="text-brand" />
            <h2 className="font-bold text-text">Sistema de puntos</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Resultado exacto', early: '+12 pts', late: '+6 pts' },
              { label: 'Ganador + goles de 1 equipo', early: '+8 pts', late: '+4 pts' },
              { label: 'Solo ganador / empate', early: '+6 pts', late: '+3 pts' },
              { label: 'Goles de un equipo', early: '+2 pts', late: '+1 pt' },
            ].map(({ label, early, late }) => (
              <div key={label} className="flex items-center justify-between bg-elevated rounded-xl px-4 py-3 gap-3">
                <span className="text-muted text-xs flex-1">{label}</span>
                <span className="text-green-400 text-xs font-bold whitespace-nowrap">{early}</span>
                <span className="text-orange-400 text-xs font-bold whitespace-nowrap">{late}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-dark text-[11px] mt-4 text-center">
            <span className="text-green-400 font-semibold">Verde</span> = +{cutoff}h antes del partido ·{' '}
            <span className="text-orange-400 font-semibold">Naranja</span> = menos de {cutoff}h
          </p>

          {/* Bonus */}
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs font-semibold text-text mb-3">
              🏅 Puntos Bonus — en torneos seleccionados
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                'Campeón de la competencia',
                'Goleador',
                'Más asistencias',
                'MVP',
                'Mejor Arquero',
              ].map(b => (
                <span key={b} className="bg-brand/10 border border-brand/20 text-brand text-[11px] font-medium px-3 py-1 rounded-full">
                  {b}
                </span>
              ))}
            </div>
            <p className="text-muted-dark text-[11px] mt-3 text-center">
              Elegí hasta 3 opciones por premio · 1ª opción <span className="text-text font-semibold">+10 pts</span> · 2ª <span className="text-text font-semibold">+5 pts</span> · 3ª <span className="text-text font-semibold">+3 pts</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="py-20 px-5">
        <div
          className="max-w-3xl mx-auto rounded-3xl p-10 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #15162E 0%, #1E243B 100%)',
            border: '1px solid #2A3352',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 100%, rgba(255,116,3,0.1) 0%, transparent 70%)' }}
          />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 relative">
            ¿Listo para demostrar que sabés de fútbol?
          </h2>
          <p className="text-muted text-sm mb-8 relative">
            Unite gratis y empezá a predecir los partidos de tus competiciones favoritas.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-h text-white font-semibold px-8 py-3.5 rounded-full transition-colors text-sm shadow-[0_4px_24px_rgba(255,116,3,0.4)] relative"
          >
            Empezar ahora — es gratis
            <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={logoFull} alt="HinchaHub" className="h-6 w-auto opacity-70" />
          <p className="text-muted-dark text-xs text-center">
            © {new Date().getFullYear()} HinchaHub. Hecho con ❤️ para los hinchas.
          </p>
          <div className="flex gap-4">
            <Link to="/auth" className="text-muted-dark text-xs hover:text-muted transition-colors">Iniciar sesión</Link>
            <Link to="/auth" className="text-muted-dark text-xs hover:text-muted transition-colors">Registrarse</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
