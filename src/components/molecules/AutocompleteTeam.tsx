import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { searchTeams } from '../../services/teamsService'
import type { TeamOption } from '../../services/teamsService'
import type { SelectedTeam } from '../../utils/prodeScoring'
import { TeamLogo } from '../atoms/TeamLogo'

export function AutocompleteTeam({
  value, onSelect, locked, teamType, placeholder,
}: {
  value:       SelectedTeam | null
  onSelect:    (t: SelectedTeam | null) => void
  locked:      boolean
  teamType?:   'national' | 'club'
  placeholder: string
}) {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<TeamOption[]>([])
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
        const r = await searchTeams(query, teamType)
        setResults(r)
        setOpen(true)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, teamType])

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-elevated rounded-lg border border-border">
        <TeamLogo url={value.logo_url} name={value.name} size={20} />
        <span className="text-text text-sm font-medium flex-1 truncate">{value.name}</span>
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
              onMouseDown={() => { onSelect({ id: r.id, name: r.name, logo_url: r.logo_url }); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-elevated transition-colors text-left"
            >
              <TeamLogo url={r.logo_url} name={r.name} size={18} />
              <span className="text-text text-sm flex-1 truncate">{r.name}</span>
              {r.country && <span className="text-muted text-xs shrink-0">{r.country}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
