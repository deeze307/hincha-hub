import { useEffect, useState } from 'react'
import { Loader2, Save, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { fetchScoringConfig, updateScoringConfig } from '../services/scoringConfigService'
import { fetchContactInfo, updateContactInfo } from '../services/contactService'

interface ContactForm {
  email:     string
  whatsapp:  string
  instagram: string
  subtitle:  string
}

const INITIAL_CONTACT: ContactForm = { email: '', whatsapp: '', instagram: '', subtitle: '' }

function TextField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-text text-sm">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-full text-sm"
      />
    </div>
  )
}

interface FormState {
  early_cutoff_hours:  string
  modify_cutoff_hours: string
  lockout_hours:       string
  early_exact:        string
  early_winner_goals: string
  early_winner:       string
  early_goals:        string
  late_exact:         string
  late_winner_goals:  string
  late_winner:        string
  late_goals:         string
}

const INITIAL: FormState = {
  early_cutoff_hours:  '24',
  modify_cutoff_hours: '8',
  lockout_hours:       '1',
  early_exact:        '12',
  early_winner_goals: '8',
  early_winner:       '6',
  early_goals:        '2',
  late_exact:         '6',
  late_winner_goals:  '4',
  late_winner:        '3',
  late_goals:         '1',
}

function NumberField({
  label, value, onChange, min = 0,
}: {
  label: string; value: string; onChange: (v: string) => void; min?: number
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-text text-sm">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input w-20 text-center text-sm"
      />
    </div>
  )
}

function ScoreRow({
  label,
  earlyKey, lateKey,
  form, onChange,
}: {
  label:    string
  earlyKey: keyof FormState
  lateKey:  keyof FormState
  form:     FormState
  onChange: (k: keyof FormState, v: string) => void
}) {
  return (
    <div className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center">
      <span className="text-text text-sm">{label}</span>
      <input
        type="number" min={0}
        value={form[earlyKey]}
        onChange={e => onChange(earlyKey, e.target.value)}
        className="input w-full text-center text-sm"
      />
      <input
        type="number" min={0}
        value={form[lateKey]}
        onChange={e => onChange(lateKey, e.target.value)}
        className="input w-full text-center text-sm"
      />
    </div>
  )
}

export default function ConfiguracionPage() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const isSuperAdmin = profile?.role === 'superadmin'

  const [configId, setConfigId] = useState('')
  const [form, setForm]         = useState<FormState>(INITIAL)
  const [contactId, setContactId]   = useState('')
  const [contact, setContact]       = useState<ContactForm>(INITIAL_CONTACT)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!isSuperAdmin) { navigate('/'); return }
    Promise.all([fetchScoringConfig(), fetchContactInfo()])
      .then(([cfg, ci]) => {
        setConfigId(cfg.id)
        setForm({
          early_cutoff_hours:  String(cfg.early_cutoff_hours),
          modify_cutoff_hours: String(cfg.modify_cutoff_hours),
          lockout_hours:       String(cfg.lockout_hours),
          early_exact:        String(cfg.early_exact),
          early_winner_goals: String(cfg.early_winner_goals),
          early_winner:       String(cfg.early_winner),
          early_goals:        String(cfg.early_goals),
          late_exact:         String(cfg.late_exact),
          late_winner_goals:  String(cfg.late_winner_goals),
          late_winner:        String(cfg.late_winner),
          late_goals:         String(cfg.late_goals),
        })
        setContactId(ci.id ?? '')
        setContact({
          email:     ci.email     ?? '',
          whatsapp:  ci.whatsapp   ?? '',
          instagram: ci.instagram ?? '',
          subtitle:  ci.subtitle  ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [isSuperAdmin])

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setC(k: keyof ContactForm, v: string) {
    setContact(c => ({ ...c, [k]: v }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await updateScoringConfig(configId, {
        early_cutoff_hours:  parseInt(form.early_cutoff_hours)  || 24,
        modify_cutoff_hours: parseInt(form.modify_cutoff_hours) || 8,
        lockout_hours:       parseInt(form.lockout_hours)       || 1,
        early_exact:        parseInt(form.early_exact)        || 12,
        early_winner_goals: parseInt(form.early_winner_goals) || 8,
        early_winner:       parseInt(form.early_winner)       || 6,
        early_goals:        parseInt(form.early_goals)        || 2,
        late_exact:         parseInt(form.late_exact)         || 6,
        late_winner_goals:  parseInt(form.late_winner_goals)  || 4,
        late_winner:        parseInt(form.late_winner)        || 3,
        late_goals:         parseInt(form.late_goals)         || 1,
      })
      if (contactId) {
        await updateContactInfo(contactId, {
          email:     contact.email.trim()     || null,
          whatsapp:  contact.whatsapp.trim()   || null,
          instagram: contact.instagram.trim().replace(/^@/, '') || null,
          subtitle:  contact.subtitle.trim()  || null,
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
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
    <div className="p-6 max-w-xl space-y-6">
      <h1 className="text-text text-xl font-semibold tracking-tight">Configuración</h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Plazos ── */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-text text-sm font-semibold">Plazos de predicción</h2>
          <p className="text-muted-dark text-xs mt-0.5">Horas antes del partido</p>
        </div>
        <NumberField
          label="Bloqueo de predicciones"
          value={form.lockout_hours}
          onChange={v => set('lockout_hours', v)}
          min={0}
        />
        <NumberField
          label="Umbral para puntos reducidos"
          value={form.early_cutoff_hours}
          onChange={v => set('early_cutoff_hours', v)}
          min={0}
        />
        <NumberField
          label="Umbral de puntos reducidos en modificación"
          value={form.modify_cutoff_hours}
          onChange={v => set('modify_cutoff_hours', v)}
          min={0}
        />
        <p className="text-muted-dark text-[11px] leading-relaxed">
          Si modificás una predicción con más anticipación que este umbral, queda bloqueada pero conserva puntos completos. Dentro del umbral, suma la mitad.
        </p>
      </div>

      {/* ── Puntuación ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-elevated/50">
          <h2 className="text-text text-sm font-semibold">Sistema de puntos</h2>
        </div>

        {/* Encabezado columnas */}
        <div className="grid grid-cols-[1fr_5rem_5rem] gap-3 px-5 py-2.5 border-b border-border/50 bg-elevated/30">
          <span className="text-muted-dark text-[11px] font-semibold uppercase tracking-wider">Resultado</span>
          <span className="text-green-400 text-[11px] font-semibold uppercase tracking-wider text-center">
            ≥ {form.early_cutoff_hours}h
          </span>
          <span className="text-yellow-400 text-[11px] font-semibold uppercase tracking-wider text-center">
            &lt; {form.early_cutoff_hours}h
          </span>
        </div>

        <div className="px-5 py-4 space-y-4">
          <ScoreRow label="Resultado exacto"              earlyKey="early_exact"        lateKey="late_exact"        form={form} onChange={set} />
          <ScoreRow label="Ganador + goles de 1 equipo"  earlyKey="early_winner_goals" lateKey="late_winner_goals" form={form} onChange={set} />
          <ScoreRow label="Solo ganador / empate"        earlyKey="early_winner"       lateKey="late_winner"       form={form} onChange={set} />
          <ScoreRow label="Goles de un equipo específico" earlyKey="early_goals"       lateKey="late_goals"        form={form} onChange={set} />
        </div>
      </div>

      {/* ── Contacto ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-elevated/50">
          <h2 className="text-text text-sm font-semibold">Información de contacto</h2>
          <p className="text-muted-dark text-xs mt-0.5">Lo que se muestra en la sección "Contacto". Dejá vacío lo que no quieras mostrar.</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <TextField label="Subtítulo"  value={contact.subtitle}  onChange={v => setC('subtitle', v)}  placeholder="Estamos para ayudarte." />
          <TextField label="Email"      value={contact.email}     onChange={v => setC('email', v)}     placeholder="contacto@hinchahub.com.ar" />
          <TextField label="WhatsApp"   value={contact.whatsapp}  onChange={v => setC('whatsapp', v)}  placeholder="549290..." />
          <TextField label="Instagram"  value={contact.instagram} onChange={v => setC('instagram', v)} placeholder="hinchahub" />
          <p className="text-muted-dark text-[11px] leading-relaxed">
            WhatsApp: número internacional sin "+" (ej. 5492901234567). Instagram: solo el usuario, sin "@".
          </p>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> :
           saved  ? <CheckCircle size={15} /> :
                    <Save size={15} />}
          {saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
