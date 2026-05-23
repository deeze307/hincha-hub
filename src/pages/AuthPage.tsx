import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/images/logo2_transparente.png'

export default function AuthPage() {
  const [mode, setMode]       = useState<'login' | 'register'>('login')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const { signIn, signUp, signInWithGoogle, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/'

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true })
  }, [user, navigate, redirectTo])

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(traducirError(error))
    } else {
      if (!fullName.trim()) { setError('Ingresá tu nombre completo'); setLoading(false); return }
      const { error } = await signUp(email, password, fullName)
      if (error) setError(traducirError(error))
      else setSuccess('¡Revisá tu correo para confirmar la cuenta!')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-105">

        {/* Card */}
        <div className="card p-2">

          {/* Logo */}
          <div className="flex flex-col items-center mb-1">
            <img
              src={logo}
              alt="Hincha Hub"
              className="h-28 w-auto object-contain mb-2 drop-shadow-[0_4px_24px_rgba(255,116,3,0.35)]"
            />
            <p className="text-muted text-sm">
              {mode === 'login' ? 'Ingresá a tu cuenta' : 'Creá tu cuenta'}
            </p>
          </div>

          {/* Alertas */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl p-4 text-red-400 text-sm mb-7">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/25 rounded-xl p-4 text-green-400 text-sm mb-7">
              {success}
            </div>
          )}

          {/* Formulario */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <InputField
                label="Nombre completo"
                icon={<User size={16} />}
                type="text"
                placeholder="Ej: Lionel Andrés Messi"
                value={fullName}
                onChange={setFullName}
              />
            )}

            <InputField
              label="Email"
              icon={<Mail size={16} />}
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={setEmail}
            />

            {/* Contraseña */}
            <div className="space-y-2">
              <label className="label uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-dark">
                  <Lock size={16} />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="input input-icon pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-dark hover:text-muted transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <a href="#" className="text-muted text-xs hover:text-brand transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-primary-full py-3! text-[15px] mt-1"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-dark text-xs">o</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            className="btn-secondary w-full py-3!"
          >
            <svg width="17" height="17" viewBox="0 0 18 18" className="shrink-0">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
            </svg>
            Continuar con Google
          </button>

          {/* Switch mode */}
          <p className="text-center text-sm text-muted mt-8">
            {mode === 'login'
              ? <>¿No tenés cuenta?{' '}<button type="button" onClick={switchMode} className="text-brand font-semibold hover:underline">Registrarte</button></>
              : <>¿Ya tenés cuenta?{' '}<button type="button" onClick={switchMode} className="text-brand font-semibold hover:underline">Ingresar</button></>
            }
          </p>
        </div>

        {mode === 'register' && (
          <p className="text-muted-dark text-xs text-center mt-5 leading-relaxed px-4">
            Al registrarte aceptás los{' '}
            <a href="#" className="text-muted hover:text-brand transition-colors">Términos y Condiciones</a>
            {' '}y la{' '}
            <a href="#" className="text-muted hover:text-brand transition-colors">Política de Privacidad</a>
          </p>
        )}
      </div>
    </div>
  )
}

function InputField({
  label, icon, type, placeholder, value, onChange,
}: {
  label: string; icon: React.ReactNode; type: string
  placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2.5">
      <label className="label uppercase tracking-wider">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-dark">{icon}</div>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          className="input input-icon"
        />
      </div>
    </div>
  )
}

function traducirError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos'
  if (msg.includes('Email not confirmed'))       return 'Confirmá tu correo antes de ingresar'
  if (msg.includes('User already registered'))   return 'Ya existe una cuenta con ese correo'
  if (msg.includes('Password should be'))        return 'La contraseña debe tener al menos 6 caracteres'
  return msg
}
