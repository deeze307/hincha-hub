import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Save, Search, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchAllCompetitionsAdmin,
  updateCompetitionFeatured,
} from '../services/competitionsService'
import type { Competition } from '../services/competitionsService'

type CompRow = Competition & { _dirty: boolean }
type ViewFilter = 'all' | 'featured'

export default function CompetitionsAdminPage() {
  const { profile } = useAuth()

  const [rows,       setRows]       = useState<CompRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [search,     setSearch]     = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')

  if (profile && profile.role !== 'superadmin') return <Navigate to="/" replace />

  useEffect(() => {
    fetchAllCompetitionsAdmin()
      .then(comps => setRows(comps.map(c => ({ ...c, _dirty: false }))))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function toggleFeatured(id: string) {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, featured: !r.featured, _dirty: true } : r,
    ))
    setSaved(false)
  }

  function changeOrder(id: string, raw: string) {
    const val = parseInt(raw, 10)
    if (isNaN(val)) return
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, display_order: val, _dirty: true } : r,
    ))
    setSaved(false)
  }

  async function saveChanges() {
    const dirty = rows.filter(r => r._dirty)
    if (!dirty.length) return
    setSaving(true)
    try {
      await Promise.all(dirty.map(r => updateCompetitionFeatured(r.id, r.featured, r.display_order)))
      setRows(prev => prev.map(r => ({ ...r, _dirty: false })))
      setSaved(true)
    } catch (err: any) {
      alert(err.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const dirtyCount = rows.filter(r => r._dirty).length

  const q = search.toLowerCase()
  const filtered = rows.filter(r => {
    const matchesSearch = !q || r.name.toLowerCase().includes(q) || r.country.toLowerCase().includes(q)
    const matchesView   = viewFilter === 'all' || r.featured
    return matchesSearch && matchesView
  })

  const featured = filtered.filter(r => r.featured)
  const others   = filtered.filter(r => !r.featured)

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6 space-y-5">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-text text-xl font-semibold">Competiciones destacadas</h1>
          <p className="text-muted text-sm mt-1">
            Las competiciones marcadas con ⭐ aparecen en el calendario público de Partidos, ordenadas por prioridad.
          </p>
        </div>
        <button
          onClick={saveChanges}
          disabled={saving || dirtyCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-h text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved && dirtyCount === 0 ? 'Guardado' : `Guardar${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Toggle Todas / Destacadas */}
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0 self-start">
          {(['all', 'featured'] as const).map(f => (
            <button
              key={f}
              onClick={() => setViewFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                f !== 'all' ? 'border-l border-border' : ''
              } ${
                viewFilter === f
                  ? 'bg-brand text-white'
                  : 'text-muted hover:text-text hover:bg-elevated'
              }`}
            >
              {f === 'featured' && <Star size={11} className={viewFilter === 'featured' ? 'fill-white' : 'fill-yellow-400 text-yellow-400'} />}
              {f === 'all' ? 'Todas' : 'Destacadas'}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar competición o país..."
            className="w-full bg-elevated border border-border rounded-lg pl-8 pr-3 py-2 text-text text-sm outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="text-brand animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Destacadas */}
          {featured.length > 0 && (
            <section>
              <h2 className="text-text text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Star size={13} className="text-yellow-400 fill-yellow-400" />
                Destacadas ({featured.length})
              </h2>
              <div className="card divide-y divide-border/50">
                {featured.map(r => (
                  <RowItem key={r.id} row={r} onToggle={toggleFeatured} onOrderChange={changeOrder} />
                ))}
              </div>
            </section>
          )}

          {/* Otras (solo en vista "Todas") */}
          {viewFilter === 'all' && others.length > 0 && (
            <section>
              <h2 className="text-muted text-sm font-semibold mb-2">
                Otras ({others.length})
              </h2>
              <div className="card divide-y divide-border/50">
                {others.map(r => (
                  <RowItem key={r.id} row={r} onToggle={toggleFeatured} onOrderChange={changeOrder} />
                ))}
              </div>
            </section>
          )}

          {/* Empty states */}
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-muted text-sm">
              {search
                ? `No se encontraron competiciones para "${search}"`
                : 'No hay competiciones destacadas aún.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RowItem({ row, onToggle, onOrderChange }: {
  row:           CompRow
  onToggle:      (id: string) => void
  onOrderChange: (id: string, val: string) => void
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${row._dirty ? 'bg-brand/5' : ''}`}>
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {row.logo_url
          ? <img src={row.logo_url} alt="" className="w-8 h-8 object-contain" />
          : <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center text-muted text-[10px] font-bold">
              {row.name.slice(0, 2).toUpperCase()}
            </div>}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-text text-sm font-medium truncate">{row.name}</p>
        <p className="text-muted-dark text-[10px]">{row.country} · {row.season_year}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-muted text-[10px]">#</span>
        <input
          type="number"
          min={1}
          value={row.display_order}
          onChange={e => onOrderChange(row.id, e.target.value)}
          className="w-14 bg-elevated border border-border rounded-lg px-2 py-1 text-text text-xs text-center outline-none focus:border-brand transition-colors"
        />
      </div>

      <button
        onClick={() => onToggle(row.id)}
        title={row.featured ? 'Quitar de destacadas' : 'Agregar a destacadas'}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
          row.featured
            ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
            : 'text-muted hover:text-yellow-400 hover:bg-yellow-400/10'
        }`}
      >
        <Star size={16} className={row.featured ? 'fill-yellow-400' : ''} />
      </button>
    </div>
  )
}
