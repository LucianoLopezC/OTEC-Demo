import { useState, useEffect } from 'react'
import { ArrowRight, Mail, Lock, Eye, EyeOff, AlertCircle, Award, Building2, BarChart3, ShieldCheck } from 'lucide-react'
import Button    from '../components/atoms/Button'
import TextInput from '../components/atoms/TextInput'
import FormField from '../components/atoms/FormField'
import { useApp } from '../context/AppContext'
import { brand } from '../config/brand'

// Rate limiting del lado del cliente: bloquea el formulario 2 minutos después de 5 intentos fallidos.
// Se guarda en sessionStorage para que se resetee si el usuario cierra la pestaña.
const MAX_INTENTOS = 5
const LOCKOUT_MS   = 2 * 60 * 1000

function getLockoutData() {
  try { return JSON.parse(sessionStorage.getItem('otec_demo_login_lock') || 'null') } catch { return null }
}
function setLockoutData(data) {
  if (data) sessionStorage.setItem('otec_demo_login_lock', JSON.stringify(data))
  else sessionStorage.removeItem('otec_demo_login_lock')
}

/* ── Helpers UI ─────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Award,       title: 'Certificación digital',      desc: 'Emita y gestione certificados con trazabilidad completa.' },
  { icon: Building2,   title: 'Gestión de empresas',        desc: 'Administre empresas, participantes y cursos en un solo lugar.' },
  { icon: BarChart3,   title: 'Reportes en tiempo real',    desc: 'Analítica e indicadores de capacitación siempre actualizados.' },
  { icon: ShieldCheck, title: 'Verificación online',        desc: 'Portal público para validar la autenticidad de cada certificado.' },
]

function FeatureItem({ icon: Icon, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.85)',
      }}>
        <Icon size={18} strokeWidth={1.6} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

// Pantalla de login: formulario a la izquierda, panel de marketing a la derecha.
// Fuerza tokens de color claro en el panel izquierdo para que no se vea afectado por el dark mode.
export default function LoginScreen() {
  const { todosLosRoles, setSesion, actualizarUltimoAcceso, iniciarSesion } = useApp()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [cargando, setCargando] = useState(false)
  /* Rate limiting */
  const [lockout, setLockout] = useState(() => {
    const data = getLockoutData()
    return (data && Date.now() < data.hasta) ? data : null
  })

  // Muestra la cuenta regresiva del bloqueo actualizándose cada segundo.
  // Cuando expira limpia el estado y deja volver a intentar.
  useEffect(() => {
    if (!lockout) return
    const interval = setInterval(() => {
      if (Date.now() >= lockout.hasta) {
        setLockout(null)
        setLockoutData(null)
        setError('')
      } else {
        const segs = Math.ceil((lockout.hasta - Date.now()) / 1000)
        setError(`Demasiados intentos fallidos. Espere ${segs} segundos para volver a intentarlo.`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [lockout])

  const registrarFallo = () => {
    const data = getLockoutData() || { intentos: 0 }
    const intentos = data.intentos + 1
    if (intentos >= MAX_INTENTOS) {
      const nuevo = { intentos, hasta: Date.now() + LOCKOUT_MS }
      setLockoutData(nuevo)
      setLockout(nuevo)
      return 0
    }
    setLockoutData({ intentos })
    return MAX_INTENTOS - intentos
  }

  /* Login email + contraseña via PHP API.
     Acepta credenciales explícitas (usadas por el botón "Probar versión demo")
     para no depender del estado async de los inputs. */
  const handleLogin = async (demoEmail, demoPassword) => {
    if (lockout && Date.now() < lockout.hasta) return

    const loginEmail    = demoEmail ?? email.trim()
    const loginPassword = demoPassword ?? password

    if (!loginEmail || !loginPassword) {
      setError('Ingrese su correo y contraseña para continuar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
      setError('Ingrese un correo electrónico válido.')
      return
    }

    setError('')
    setCargando(true)

    try {
      await iniciarSesion(loginEmail, loginPassword)
      setLockoutData(null)
      setLockout(null)
    } catch (err) {
      const restantes = registrarFallo()
      if (restantes === 0) {
        setError(`Cuenta bloqueada por seguridad. Espere ${LOCKOUT_MS / 60000} minutos e intente nuevamente.`)
      } else {
        setError(`Credenciales incorrectas o cuenta inactiva. ${restantes} intento${restantes !== 1 ? 's' : ''} restante${restantes !== 1 ? 's' : ''}.`)
      }
    } finally {
      setCargando(false)
    }
  }

  // Acceso instantáneo con la cuenta demo — pensado para que cualquier visitante
  // del portafolio pueda entrar sin tener que buscar las credenciales.
  const DEMO_EMAIL    = 'admin@otec-demo.cl'
  const DEMO_PASSWORD = 'Demo2026!'
  const handleDemoLogin = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    handleLogin(DEMO_EMAIL, DEMO_PASSWORD)
  }

  const bloqueado = !!(lockout && Date.now() < lockout.hasta)

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-grid {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          height: 100vh;
          font-family: var(--font-sans);
        }
        .login-form-col {
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 56px;
        }
        .login-brand-col {
          position: relative;
          background: linear-gradient(160deg, var(--brand-700) 0%, var(--brand-900) 70%, #08102B 100%);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 48px;
        }
        @media (max-width: 768px) {
          .login-grid {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100vh;
          }
          .login-form-col {
            padding: 40px 24px;
            justify-content: flex-start;
            padding-top: 60px;
          }
          .login-brand-col {
            display: none;
          }
        }
      `}</style>
      <div className="login-grid">
        {/* ── Left: form ── */}
        <div className="login-form-col" style={{
          /* Force light-mode tokens regardless of html.dark */
          '--bg-surface': '#FFFFFF',
          '--bg-muted':   '#EAF2F4',
          '--fg-1': '#0D1F27',
          '--fg-2': '#2E4F5C',
          '--fg-3': '#5E8A98',
          '--fg-4': '#89AEBA',
          '--border-default': '#D8E8EC',
          '--border-focus':   '#14b4c9',
          '--neutral-400': '#89AEBA',
          '--danger-50':  '#FDECEC',
          '--danger-200': '#fca5a5',
          '--danger-500': '#D03A3A',
          '--danger-600': '#A82626',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
            <svg width={36} height={36} viewBox="0 0 36 36" fill="none">
              <rect width={36} height={36} rx={9} fill="var(--brand-600)" />
              <path d="M8 11h13M8 18h10M8 25h15" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={29} cy={11} r={5} fill="var(--accent-sky-400)" />
            </svg>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
              {brand.name} Admin
            </span>
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 700, color: 'var(--fg-1)',
            letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1.2,
          }}>
            Bienvenido de vuelta
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-3)', marginBottom: 32, lineHeight: 1.5 }}>
            Inicie sesión para acceder al panel administrativo de {brand.name}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <FormField label="Correo corporativo" required>
              <TextInput
                icon={Mail} placeholder="usuario@empresa.cl" type="email"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !bloqueado && handleLogin()}
                disabled={cargando || bloqueado}
              />
            </FormField>

            <FormField label="Contraseña" required>
              <div style={{ position: 'relative' }}>
                <TextInput
                  icon={Lock} placeholder="••••••••"
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !bloqueado && handleLogin()}
                  disabled={cargando || bloqueado}
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--neutral-400)', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </FormField>

            <Button
              variant="primary" size="lg"
              iconRight={cargando ? undefined : ArrowRight}
              fullWidth onClick={() => handleLogin()}
              disabled={cargando || bloqueado}
              style={{ marginTop: 4 }}
            >
              {cargando ? <><Spinner />&nbsp;Verificando...</> : 'Iniciar sesión'}
            </Button>

            <Button
              variant="secondary" size="lg"
              fullWidth onClick={handleDemoLogin}
              disabled={cargando || bloqueado}
            >
              Probar versión demo
            </Button>
            <p style={{ fontSize: 11.5, color: 'var(--fg-4)', textAlign: 'center', marginTop: -6 }}>
              Acceso instantáneo con datos de ejemplo. Se restablecen todos los días.
            </p>

            {error && (
              <div style={{
                background: 'var(--danger-50)', border: '1px solid var(--danger-200)',
                borderRadius: 8, padding: '10px 14px',
                display: 'flex', gap: 8, alignItems: 'flex-start',
                fontSize: 13, color: 'var(--danger-600)',
              }}>
                <AlertCircle size={15} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--fg-4)', textAlign: 'center' }}>
            © 2026 {brand.name} Chile
          </p>
        </div>

        {/* ── Right: brand panel ── */}
        <div className="login-brand-col">
          <div style={{
            position: 'absolute', top: -80, right: -80, width: 340, height: 340, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(92,143,240,0.22) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, left: -60, width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(26,174,99,0.16) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'absolute', top: '10%', right: 48, left: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FEATURES.map(f => <FeatureItem key={f.title} {...f} />)}
          </div>

          <div style={{ position: 'relative', zIndex: 2 }}>
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: 14,
            }}>
              PANEL ADMINISTRATIVO · SAAS 2026
            </p>
            <h2 style={{
              fontSize: 32, fontWeight: 700, color: '#fff',
              lineHeight: 1.25, letterSpacing: '-0.01em', marginBottom: 16, maxWidth: 420,
            }}>
              Gestione toda su operación de capacitación desde un solo lugar.
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.65, maxWidth: 400 }}>
              Administre empresas, cursos, participantes y certificados con eficiencia y trazabilidad total.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
