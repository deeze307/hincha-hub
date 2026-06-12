import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { searchPlayers } from '../../services/teamsService'
import type { PlayerOption } from '../../services/teamsService'
import { POSITION_ES, type SelectedPlayer } from '../../utils/prodeScoring'

export function AutocompletePlayer({
  value, onSelect, locked, competitionId, placeholder,
}: {
  value:         SelectedPlayer | null
  onSelect:      (p: SelectedPlayer | null) => void
  locked:        boolean
  competitionId: string
  placeholder:   string
}) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<PlayerOption[]>([])
  const [open,      setOpen]      = useState(false)
  const [searching, setSearching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchPlayers(query, competitionId)
        setResults(r)
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, competitionId])

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border">
        {value.photo_url
          ? <img src={value.photo_url} alt={value.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
          : <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted border border-border shrink-0">{value.name.slice(0,2).toUpperCase()}</div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-text text-sm font-medium truncate">{value.name}</p>
          {value.team && <p className="text-muted text-[11px] truncate">{value.team}</p>}
        </div>
        {!locked && (
          <button onClick={() => onSelect(null)} className="text-muted hover:text-text shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border focus-within:border-brand transition-colors">
        <Search size={14} className="text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          disabled={locked}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-text text-sm outline-none placeholder:text-muted-dark disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {searching && <Loader2 size={12} className="text-muted animate-spin shrink-0" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-elevated z-20 max-h-48 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onMouseDown={() => {
                onSelect({ id: r.id, name: r.name, photo_url: r.photo_url, team: (r.team as any)?.name ?? null })
                setQuery('')
                setOpen(false)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
            >
              {r.photo_url
                ? <img src={r.photo_url} alt={r.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-elevated flex items-center justify-center text-[9px] font-bold text-muted border border-border shrink-0">{r.name.slice(0,2).toUpperCase()}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-text text-sm truncate">{r.name}</p>
                {(r.team as any)?.name && <p className="text-muted text-[11px] truncate">{(r.team as any).name}</p>}
              </div>
              {r.position && <span className="text-muted text-xs shrink-0">{POSITION_ES[r.position] ?? r.position}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
