import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ImagePlus, X, ChevronDown, Loader2, Search, Flag, Shield, Trophy, Star, Target, Award } from 'lucide-react'
import { fetchUpcomingCompetitions } from '../services/competitionsService'
import {
  createTournament, updateTournament, fetchTournaments,
  DEFAULT_PRODE_CONFIG, ALL_BONUS_TYPES, BONUS_TYPE_LABELS,
} from '../services/tournamentsService'
import type { Competition } from '../services/competitionsService'
import type { Tournament, ProdeConfig, BonusType } from '../services/tournamentsService'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const BONUS_FORM_ICONS: Record<BonusType, React.FC<{ size?: number; className?: string }>> = {
  champion:        Trophy,
  top_scorer:      Star,
  top_assists:     Target,
  mvp:             Award,
  best_goalkeeper: Shield,
}

interface FormState {
  name:                string
  description:         string
  competition_id:      string
  access_type:         'open' | 'request'
  has_max:             boolean
  max_participants:    string
  image_file:          File | null
  image_preview:       string | null
  image_url:           string | null
  // prode config
  team_type:           'national' | 'club'
  direct_qualifiers:   string
  best_third_count:    string
  has_knockout:  boolean
  has_bonus:     boolean
  bonus_types:   BonusType[]
  is_hidden:     boolean
}

const INITIAL: FormState = {
  name: '', description: '', competition_id: '',
  access_type: 'open', has_max: false,
  max_participants: '', image_file: null,
  image_preview: null, image_url: null,
  team_type: 'national',
  direct_qualifiers: '2',
  best_third_count: '0',
  has_knockout:  true,
  has_bonus:     true,
  bonus_types:   ['champion', 'top_scorer'] as BonusType[],
  is_hidden:     false,
}

export default function TournamentFormPage() {
  const { id }   = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit   = Boolean(id)
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'superadmin'

  const [form, setForm]             = useState<FormState>(INITIAL)
  const [competitions, setComps]    = useState<Competition[]>([])
  const [compSearch, setCompSearch] = useState('')
  const [compOpen, setCompOpen]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const compRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const comps = await fetchUpcomingCompetitions()
        setComps(comps)
        if (isEdit && id) {
          const all = await fetchTournaments()
          const t   = all.find(x => x.id === id)
          if (t) populateForm(t)
        }
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  function populateForm(t: Tournament) {
    const pc = t.prode_config ?? DEFAULT_PRODE_CONFIG
    setForm({
      name:                t.name,
      description:         t.description ?? '',
      competition_id:      t.competition_id ?? '',
      access_type:         t.access_type,
      has_max:             t.max_participants != null,
      max_participants:    t.max_participants?.toString() ?? '',
      image_file:          null,
      image_preview:       t.image_url,
      image_url:           t.image_url,
      team_type:           t.team_type ?? 'national',
      direct_qualifiers:   String(pc.direct_qualifiers ?? 2),
      best_third_count:    String(pc.best_third_count ?? 0),
      has_knockout:        pc.has_knockout ?? true,
      has_bonus:           pc.has_bonus ?? true,
      bonus_types:         pc.bonus_types ?? ['champion', 'top_scorer'],
      is_hidden:           t.is_hidden ?? false,
    })
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (compRef.current && !compRef.current.contains(e.target as Node)) setCompOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function set(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    set({ image_file: file, image_preview: URL.createObjectURL(file) })
  }

  function removeImage() {
    set({ image_file: null, image_preview: null, image_url: null })
    if (fileRef.current) fileRef.current.value = ''
  }

  const filteredComps = competitions.filter(c =>
    c.name.toLowerCase().includes(compSearch.toLowerCase()) ||
    c.country.toLowerCase().includes(compSearch.toLowerCase())
  )

  const selectedComp = competitions.find(c => c.id === form.competition_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim())       { setError('El nombre es obligatorio'); return }
    if (!form.competition_id)    { setError('Seleccioná una competencia base'); return }
    if (form.has_max && (!form.max_participants || parseInt(form.max_participants) < 2)) {
      setError('El máximo de participantes debe ser al menos 2')
      return
    }
    if (!form.direct_qualifiers || parseInt(form.direct_qualifiers) < 1) {
      setError('Indicá cuántos equipos clasifican directamente por grupo (mínimo 1)')
      return
    }

    const prodeConfig: ProdeConfig = {
      direct_qualifiers: parseInt(form.direct_qualifiers),
      best_third_count:  parseInt(form.best_third_count) || 0,
      has_knockout:      form.has_knockout,
      has_bonus:         form.has_bonus,
      bonus_types:       form.has_bonus ? form.bonus_types : [],
      tiebreakers:       ['points', 'gd', 'gf', 'h2h'],
    }

    setSaving(true)
    try {
      if (isEdit && id) {
        await updateTournament(id, {
          name:        form.name,
          description: form.description,
          image_file:  form.image_file,
          image_url:   form.image_url,
          is_hidden:   isSuperAdmin ? form.is_hidden : undefined,
        })
      } else {
        await createTournament({
          name:                form.name,
          description:         form.description,
          competition_id:      form.competition_id,
          access_type:         form.access_type,
          max_participants:    form.has_max ? parseInt(form.max_participants) : null,
          image_file:          form.image_file,
          team_type:           form.team_type,
          prode_config:        prodeConfig,
          prediction_deadline: null,
        })
        // Sync automático en background: equipos + fixture + jugadores
        // No esperamos para no bloquear al usuario
        supabase.functions.invoke('sync-fixtures')
          .then(() => supabase.functions.invoke('sync-squads'))
          .catch(e => console.error('Background sync failed:', e))
      }
      navigate('/torneos', { state: { justCreated: !isEdit } })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-brand animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-text text-xl font-semibold tracking-tight mb-6">
        {isEdit ? 'Editar torneo' : 'Nuevo torneo'}
      </h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Imagen ── */}
        <div>
          <label className="label">Imagen del torneo (opcional)</label>
          <div className="flex items-center gap-4 mt-1">
            <div
              onClick={() => !form.image_preview && fileRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-border overflow-hidden flex items-center justify-center cursor-pointer hover:border-brand transition-colors bg-elevated shrink-0"
            >
              {form.image_preview
                ? <img src={form.image_preview} alt="" className="w-full h-full object-cover" />
                : <ImagePlus size={22} className="text-muted-dark" />
              }
            </div>
            <div className="space-y-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5 px-3">
                {form.image_preview ? 'Cambiar imagen' : 'Subir imagen'}
              </button>
              {form.image_preview && (
                <button type="button" onClick={removeImage} className="flex items-center gap-1 text-red-400 text-xs hover:text-red-300 transition-colors">
                  <X size={12} /> Quitar imagen
                </button>
              )}
              <p className="text-muted-dark text-xs">JPG, PNG o WebP · Máx. 2 MB</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
        </div>

        {/* ── Nombre ── */}
        <div className="space-y-2">
          <label className="label">Nombre del torneo *</label>
          <input
            type="text"
            placeholder="Ej: Prode Mundial 2026"
            value={form.name}
            onChange={e => set({ name: e.target.value })}
            className="input"
          />
        </div>

        {/* ── Descripción ── */}
        <div className="space-y-2">
          <label className="label">Descripción (opcional)</label>
          <textarea
            placeholder="Describí el torneo, las reglas especiales, etc."
            value={form.description}
            onChange={e => set({ description: e.target.value })}
            rows={3}
            className="input resize-none"
          />
        </div>

        {/* ── Competencia base ── */}
        <div className="space-y-2">
          <label className="label">
            Competencia base *
            {isEdit && <span className="text-muted-dark ml-1">(no editable)</span>}
          </label>
          <div className="relative" ref={compRef}>
            <button
              type="button"
              disabled={isEdit}
              onClick={() => setCompOpen(o => !o)}
              className="input flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedComp ? (
                <span className="flex items-center gap-2.5">
                  {selectedComp.logo_url && (
                    <img src={selectedComp.logo_url} alt="" className="w-5 h-5 object-contain" />
                  )}
                  <span>{selectedComp.name}</span>
                  <span className="text-muted-dark text-xs">· {selectedComp.country}</span>
                </span>
              ) : (
                <span className="text-muted-dark">Seleccioná una competencia...</span>
              )}
              <ChevronDown size={15} className={`text-muted-dark transition-transform ${compOpen ? 'rotate-180' : ''}`} />
            </button>

            {compOpen && (
              <div className="absolute z-20 w-full mt-1 bg-surface border border-border rounded-xl shadow-elevated overflow-hidden">
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-dark" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Buscar competencia..."
                      value={compSearch}
                      onChange={e => setCompSearch(e.target.value)}
                      className="input pl-8 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredComps.length === 0 ? (
                    <p className="px-4 py-6 text-center text-muted text-sm">
                      {competitions.length === 0 ? 'No hay competencias sincronizadas aún.' : 'Sin resultados.'}
                    </p>
                  ) : filteredComps.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { set({ competition_id: c.id }); setCompOpen(false); setCompSearch('') }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-elevated transition-colors ${
                        form.competition_id === c.id ? 'text-brand' : 'text-text'
                      }`}
                    >
                      {c.logo_url
                        ? <img src={c.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
                        : <div className="w-5 h-5 rounded bg-elevated shrink-0" />
                      }
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-muted-dark text-xs shrink-0">{c.country}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tipo de acceso ── */}
        <div className="space-y-2">
          <label className="label">
            Tipo de acceso
            {isEdit && <span className="text-muted-dark ml-1">(no editable)</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['open',    'Abierto',       'Cualquier usuario puede unirse directamente.'],
              ['request', 'Con solicitud', 'Los usuarios envían una solicitud que vos aprobás.'],
            ] as const).map(([val, title, desc]) => (
              <label
                key={val}
                className={`relative flex flex-col gap-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isEdit ? 'opacity-50 cursor-not-allowed' :
                  form.access_type === val ? 'border-brand bg-brand/5' : 'border-border hover:border-border/80'
                }`}
              >
                <input
                  type="radio" name="access_type" value={val}
                  disabled={isEdit} checked={form.access_type === val}
                  onChange={() => set({ access_type: val })}
                  className="sr-only"
                />
                <span className="text-text text-sm font-semibold">{title}</span>
                <span className="text-muted text-xs leading-relaxed">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Máximo de participantes ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label mb-0">
              Máximo de participantes
              {isEdit && <span className="text-muted-dark ml-1">(no editable)</span>}
            </label>
            <button
              type="button" disabled={isEdit}
              onClick={() => set({ has_max: !form.has_max })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                form.has_max ? 'bg-brand' : 'bg-elevated'
              } ${isEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.has_max ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {form.has_max && (
            <input
              type="number" min={2} max={10000} placeholder="Ej: 50"
              value={form.max_participants}
              onChange={e => set({ max_participants: e.target.value })}
              disabled={isEdit} className="input disabled:opacity-50"
            />
          )}
        </div>

        {/* ════════════════════════════════════════
            SECCIÓN PRODE (solo en creación)
        ════════════════════════════════════════ */}
        {!isEdit && (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="bg-elevated px-5 py-3 border-b border-border">
              <h2 className="text-text text-sm font-semibold">Configuración del Prode</h2>
              <p className="text-muted-dark text-xs mt-0.5">Definí las reglas de predicción para este torneo</p>
            </div>

            <div className="p-5 space-y-5">

              {/* Tipo de equipos */}
              <div className="space-y-2">
                <label className="label">Tipo de competencia *</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['national', 'Selecciones', 'Copa del Mundo, Eurocopa, Copa América…', Flag],
                    ['club',     'Clubes',      'Champions League, Libertadores, Ligas…', Shield],
                  ] as const).map(([val, title, desc, Icon]) => (
                    <label
                      key={val}
                      className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        form.team_type === val ? 'border-brand bg-brand/5' : 'border-border hover:border-border/80'
                      }`}
                    >
                      <input
                        type="radio" name="team_type" value={val}
                        checked={form.team_type === val}
                        onChange={() => set({ team_type: val })}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={form.team_type === val ? 'text-brand' : 'text-muted'} />
                        <span className="text-text text-sm font-semibold">{title}</span>
                      </div>
                      <span className="text-muted text-xs leading-relaxed">{desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Clasificación de grupos */}
              <div className="space-y-3">
                <label className="label">Clasificación de la fase de grupos *</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-text text-xs font-medium">Clasifican directamente por grupo</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={1} max={10}
                        value={form.direct_qualifiers}
                        onChange={e => set({ direct_qualifiers: e.target.value })}
                        className="input w-20 text-center"
                      />
                      <span className="text-muted text-xs">equipos por grupo</span>
                    </div>
                    <p className="text-muted-dark text-[11px]">
                      Ej: WC 2026 = 2, Champions grupos = 2
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-text text-xs font-medium">Mejores 3eros que clasifican</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min={0} max={20}
                        value={form.best_third_count}
                        onChange={e => set({ best_third_count: e.target.value })}
                        className="input w-20 text-center"
                      />
                      <span className="text-muted text-xs">equipos totales</span>
                    </div>
                    <p className="text-muted-dark text-[11px]">
                      Ej: WC 2026 = 8, Eurocopa = 4, Champions = 0
                    </p>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <ToggleRow
                  label="Incluir fase eliminatoria"
                  description="Los usuarios también predicen octavos, cuartos, semis y final"
                  value={form.has_knockout}
                  onChange={v => set({ has_knockout: v })}
                />
                <ToggleRow
                  label="Incluir predicciones bonus"
                  description="Premios del torneo: campeón, goleador, MVP, etc."
                  value={form.has_bonus}
                  onChange={v => set({ has_bonus: v })}
                />
                {form.has_bonus && (
                  <div className="ml-0 mt-1 p-4 bg-elevated/40 rounded-xl border border-border/60 space-y-3">
                    <p className="text-muted-dark text-[11px] font-semibold uppercase tracking-wider">
                      Premios habilitados
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {ALL_BONUS_TYPES.map(bt => {
                        const Icon     = BONUS_FORM_ICONS[bt]
                        const selected = form.bonus_types.includes(bt)
                        return (
                          <button
                            key={bt}
                            type="button"
                            onClick={() => {
                              const next = selected
                                ? form.bonus_types.filter(x => x !== bt)
                                : [...form.bonus_types, bt]
                              set({ bonus_types: next })
                            }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                              selected
                                ? 'border-brand bg-brand/10'
                                : 'border-border hover:border-muted'
                            }`}
                          >
                            <Icon size={14} className={selected ? 'text-brand' : 'text-muted'} />
                            <span className={`text-sm font-medium flex-1 ${selected ? 'text-text' : 'text-muted'}`}>
                              {BONUS_TYPE_LABELS[bt]}
                            </span>
                            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                              selected ? 'border-brand bg-brand' : 'border-border'
                            }`}>
                              {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── Visibilidad (solo superadmin en edición) ── */}
        {isEdit && isSuperAdmin && (
          <div className="border border-border rounded-xl p-4">
            <ToggleRow
              label="Ocultar torneo"
              description="El torneo no será visible para los usuarios generales"
              value={form.is_hidden}
              onChange={v => set({ is_hidden: v })}
            />
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : isEdit ? 'Guardar cambios' : 'Crear torneo'}
          </button>
          <button type="button" onClick={() => navigate('/torneos')} className="btn-ghost">
            Cancelar
          </button>
        </div>

      </form>
    </div>
  )
}

function ToggleRow({
  label, description, value, onChange,
}: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-t border-border/50 first:border-0 first:pt-0">
      <div>
        <p className="text-text text-sm font-medium">{label}</p>
        <p className="text-muted-dark text-xs mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${value ? 'bg-brand' : 'bg-elevated'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
