import { useState } from 'react'
import { Save, Lock, Check } from 'lucide-react'

type Prediction = '1' | 'X' | '2' | null

interface Match {
  id: number
  home: string
  homeCode: string
  away: string
  awayCode: string
  date: string
  time: string
  group: string
  locked: boolean
}

function Flag({ code, size = 24 }: { code: string; size?: number }) {
  return (
    <img
      src={`https://flagcdn.com/w${size}/${code.toLowerCase()}.png`}
      width={size}
      alt={code}
      className="rounded-sm object-cover shrink-0"
      style={{ height: size * 0.67 }}
    />
  )
}

/* Ícono de escudo SVG */
function ShieldIcon({ active, saved }: { active: boolean; saved: boolean }) {
  if (saved) return (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path d="M12 2L4 5v6c0 5.25 3.5 10.14 8 11.36C16.5 21.14 20 16.25 20 11V5L12 2z"
        fill="#22c55e" stroke="#22c55e" strokeWidth="1" />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6">
      <path d="M12 2L4 5v6c0 5.25 3.5 10.14 8 11.36C16.5 21.14 20 16.25 20 11V5L12 2z"
        fill={active ? '#FF7403' : 'transparent'}
        stroke={active ? '#FF7403' : '#AAB3C5'}
        strokeWidth="1.5" />
    </svg>
  )
}

const MATCHES: Match[] = [
  { id: 1, home: 'Argentina',    homeCode: 'ar', away: 'Marruecos',    awayCode: 'ma', date: '11 Jun', time: '12:00', group: 'Grupo A', locked: false },
  { id: 2, home: 'España',       homeCode: 'es', away: 'Portugal',     awayCode: 'pt', date: '11 Jun', time: '15:00', group: 'Grupo A', locked: false },
  { id: 3, home: 'Brasil',       homeCode: 'br', away: 'México',       awayCode: 'mx', date: '12 Jun', time: '18:00', group: 'Grupo B', locked: false },
  { id: 4, home: 'Francia',      homeCode: 'fr', away: 'Alemania',     awayCode: 'de', date: '12 Jun', time: '21:00', group: 'Grupo B', locked: false },
  { id: 5, home: 'Inglaterra',   homeCode: 'gb', away: 'Países Bajos', awayCode: 'nl', date: '13 Jun', time: '12:00', group: 'Grupo C', locked: false },
  { id: 6, home: 'Uruguay',      homeCode: 'uy', away: 'Colombia',     awayCode: 'co', date: '13 Jun', time: '15:00', group: 'Grupo C', locked: false },
  { id: 7, home: 'Japón',        homeCode: 'jp', away: 'Corea del Sur',awayCode: 'kr', date: '14 Jun', time: '09:00', group: 'Grupo D', locked: true  },
  { id: 8, home: 'Italia',       homeCode: 'it', away: 'Croacia',      awayCode: 'hr', date: '14 Jun', time: '12:00', group: 'Grupo D', locked: true  },
]

export default function ProdePage() {
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [globalSaved, setGlobalSaved] = useState(false)

  function pick(matchId: number, value: Prediction) {
    setPredictions(prev => ({ ...prev, [matchId]: prev[matchId] === value ? null : value }))
    setSaved(prev => ({ ...prev, [matchId]: false }))
    setGlobalSaved(false)
  }

  function handleSave() {
    const newSaved: Record<number, boolean> = {}
    Object.keys(predictions).forEach(k => {
      if (predictions[+k]) newSaved[+k] = true
    })
    setSaved(newSaved)
    setGlobalSaved(true)
    setTimeout(() => setGlobalSaved(false), 2500)
  }

  const completedCount = Object.values(predictions).filter(Boolean).length
  const totalEditable  = MATCHES.filter(m => !m.locked).length

  const groups = MATCHES.reduce<Record<string, Match[]>>((acc, m) => {
    ;(acc[m.group] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-text text-xl font-semibold">Predecir</h1>
        <p className="text-muted text-sm mt-0.5">Mundial 2026 · Fase de grupos</p>
      </div>

      {/* Progreso */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text text-sm font-medium">Pronósticos cargados</span>
          <span className="text-brand font-semibold text-sm">{completedCount}/{totalEditable}</span>
        </div>
        <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: `${totalEditable ? (completedCount / totalEditable) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Grupos */}
      {Object.entries(groups).map(([group, matches]) => (
        <section key={group}>
          <h2 className="text-muted text-[11px] font-semibold uppercase tracking-widest mb-2 px-1">{group}</h2>
          <div className="space-y-2">
            {matches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predictions[m.id] ?? null}
                isSaved={saved[m.id] ?? false}
                onPick={val => pick(m.id, val)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Guardar */}
      <div className="sticky bottom-20 lg:bottom-6">
        <button
          onClick={handleSave}
          disabled={completedCount === 0}
          className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all ${
            globalSaved
              ? 'bg-green-600'
              : completedCount === 0
              ? 'bg-elevated text-muted cursor-not-allowed'
              : 'bg-brand hover:bg-brand-h active:scale-[0.98]'
          }`}
        >
          {globalSaved ? <Check size={18} /> : <Save size={18} />}
          {globalSaved ? '¡Predicciones guardadas!' : `Guardar predicciones${completedCount > 0 ? ` (${completedCount})` : ''}`}
        </button>
      </div>
    </div>
  )
}

function MatchCard({
  match, prediction, isSaved, onPick,
}: {
  match: Match; prediction: Prediction; isSaved: boolean; onPick: (v: Prediction) => void
}) {
  const opts: { val: '1' | 'X' | '2'; label: string }[] = [
    { val: '1', label: 'Local' },
    { val: 'X', label: 'Empate' },
    { val: '2', label: 'Visita' },
  ]

  return (
    <div className={`bg-surface border border-border rounded-xl p-4 ${match.locked ? 'opacity-55' : ''}`}>
      {/* Equipos */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Flag code={match.homeCode} size={28} />
          <span className="text-text text-sm font-medium truncate">{match.home}</span>
        </div>
        <div className="text-center shrink-0 px-2">
          <p className="text-muted text-xs font-bold">VS</p>
          <p className="text-muted text-[10px]">{match.time} hs</p>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-text text-sm font-medium truncate text-right">{match.away}</span>
          <Flag code={match.awayCode} size={28} />
        </div>
      </div>

      {/* Selector */}
      {match.locked ? (
        <div className="flex items-center justify-center gap-2 text-muted text-xs py-1">
          <Lock size={12} />
          <span>Partido cerrado · No se pueden ingresar predicciones</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {opts.map(({ val, label }) => {
            const isActive = prediction === val
            const thisSaved = isSaved && isActive
            return (
              <button
                key={val}
                onClick={() => onPick(val)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-lg text-xs font-medium transition-all active:scale-95 ${
                  thisSaved
                    ? 'bg-green-600/20 border border-green-500/40 text-green-400'
                    : isActive
                    ? 'bg-brand/20 border border-brand text-brand'
                    : 'bg-elevated border border-border text-muted hover:text-text hover:border-muted'
                }`}
              >
                <ShieldIcon active={isActive} saved={thisSaved} />
                <span>{val}</span>
                <span className="text-[10px] opacity-70">{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
