// Pantalla de perfil del usuario autenticado: muestra sus datos, rol, empresa
// y permite cambiar la contraseña directamente contra la API PHP.
import { useState } from 'react'
import { User, Mail, Lock, Shield, Building2, CheckCircle2, AlertCircle, Eye, EyeOff, Calendar, Clock } from 'lucide-react'
import Avatar from '../../components/atoms/Avatar'
import Button from '../../components/atoms/Button'
import { useApp } from '../../context/AppContext'
import { apiFetch } from '../../services/apiClient'

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
        fontSize: 14, fontWeight: 700, color: 'var(--fg-1)',
      }}>
        {title}
      </div>
      <div style={{ padding: '20px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{hint}</span>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, disabled, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      {...rest}
      style={{
        height: 38, padding: '0 12px', fontSize: 13,
        color: disabled ? 'var(--fg-3)' : 'var(--fg-1)',
        background: disabled ? 'var(--neutral-50)' : 'var(--bg-surface)',
        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
        outline: 'none', fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
    />
  )
}

function RolBadge({ rol }) {
  const colorMap = {
    brand:   { bg: 'var(--brand-50)',   color: 'var(--brand-600)',   border: 'var(--brand-200)' },
    info:    { bg: 'var(--info-50)',     color: 'var(--info-600)',    border: 'var(--info-200)' },
    success: { bg: 'var(--success-50)', color: 'var(--success-600)', border: 'var(--success-200)' },
    warning: { bg: 'var(--warning-50)', color: 'var(--warning-600)', border: 'var(--warning-200)' },
  }
  const c = colorMap[rol?.color] ?? colorMap.brand
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      width: 'fit-content',
    }}>
      <Shield size={12} strokeWidth={2} />
      {rol?.nombre ?? 'Sin rol'}
    </div>
  )
}

function Toast({ ok, msg, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: 13,
      background: ok ? 'var(--success-50)' : 'var(--danger-50)',
      color: ok ? 'var(--success-700)' : 'var(--danger-600)',
      border: `1px solid ${ok ? 'var(--success-200)' : 'var(--danger-200)'}`,
    }}>
      {ok
        ? <CheckCircle2 size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
        : <AlertCircle  size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
      }
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  )
}

function fmtFecha(str) {
  if (!str) return '—'
  try {
    return new Date(str).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return str }
}

export default function PerfilScreen() {
  const { sesion, setSesion, editarUsuario } = useApp()

  const usuario    = sesion?.usuario ?? {}
  const rol        = sesion?.rol     ?? {}
  const esSuperadmin = usuario.rolId === 'superadmin'

  /* ── Sección datos personales ── */
  const [nombre,  setNombre]  = useState(usuario.nombre  ?? '')
  const [email,   setEmail]   = useState(usuario.email   ?? '')
  const [saving,  setSaving]  = useState(false)
  const [toastInfo, setToastInfo] = useState(null)

  /* ── Sección contraseña ── */
  const [passActual,   setPassActual]   = useState('')
  const [passNueva,    setPassNueva]    = useState('')
  const [passConfirm,  setPassConfirm]  = useState('')
  const [showPass,     setShowPass]     = useState(false)
  const [savingPass,   setSavingPass]   = useState(false)
  const [toastPass,    setToastPass]    = useState(null)

  const handleGuardarInfo = async () => {
    if (!nombre.trim()) return setToastInfo({ ok: false, msg: 'El nombre no puede estar vacío.' })
    if (!email.trim() || !email.includes('@')) return setToastInfo({ ok: false, msg: 'Ingresa un email válido.' })
    setSaving(true)
    try {
      const actualizado = { ...usuario, nombre: nombre.trim(), email: email.trim() }
      await editarUsuario(actualizado)
      setSesion({ ...sesion, usuario: actualizado })
      setToastInfo({ ok: true, msg: 'Información actualizada correctamente.' })
    } catch {
      setToastInfo({ ok: false, msg: 'No se pudo guardar. Intenta nuevamente.' })
    } finally {
      setSaving(false)
    }
  }

  const handleCambiarPassword = async () => {
    if (!passActual) return setToastPass({ ok: false, msg: 'Ingresa tu contraseña actual.' })
    if (passNueva.length < 8) return setToastPass({ ok: false, msg: 'La nueva contraseña debe tener al menos 8 caracteres.' })
    if (passNueva !== passConfirm) return setToastPass({ ok: false, msg: 'Las contraseñas no coinciden.' })
    setSavingPass(true)
    try {
      await apiFetch('usuarios.php?action=cambiar_password', {
        method: 'POST',
        body: JSON.stringify({ id: usuario.id, passActual, passNueva }),
      })
      setPassActual(''); setPassNueva(''); setPassConfirm('')
      setToastPass({ ok: true, msg: 'Contraseña actualizada correctamente.' })
    } catch (err) {
      setToastPass({ ok: false, msg: err.message || 'No se pudo actualizar la contraseña.' })
    } finally {
      setSavingPass(false)
    }
  }

  const infoChanged = nombre !== (usuario.nombre ?? '') || email !== (usuario.email ?? '')

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780 }}>

      {/* Hero */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', padding: '28px 28px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <Avatar name={nombre || usuario.nombre} size={72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 4 }}>
            {usuario.nombre}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <RolBadge rol={rol} />
            {usuario.empresaNombre && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                background: 'var(--success-50)', color: 'var(--success-600)',
                border: '1px solid var(--success-200)',
              }}>
                <Building2 size={11} strokeWidth={2} />
                {usuario.empresaNombre}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, color: 'var(--fg-3)' }}>
            <Mail size={13} strokeWidth={1.75} />
            {usuario.email}
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: usuario.activo ? 'var(--success-50)' : 'var(--neutral-100)',
          color: usuario.activo ? 'var(--success-600)' : 'var(--fg-3)',
          border: `1px solid ${usuario.activo ? 'var(--success-200)' : 'var(--border-default)'}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: usuario.activo ? 'var(--success-500)' : 'var(--neutral-400)',
          }} />
          {usuario.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
        </div>
      </div>

      {/* Información personal */}
      <Section title="Información personal">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Nombre completo">
              <TextInput value={nombre} onChange={esSuperadmin ? setNombre : undefined} placeholder="Tu nombre completo" disabled={!esSuperadmin} />
            </Field>
            <Field label="Correo electrónico">
              <TextInput value={email} onChange={esSuperadmin ? setEmail : undefined} placeholder="tu@email.com" disabled={!esSuperadmin} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Rol del sistema">
              <TextInput value={rol.nombre ?? ''} disabled />
            </Field>
            <Field label="Empresa asociada">
              <TextInput value={usuario.empresaNombre || 'Sin empresa asociada'} disabled />
            </Field>
          </div>

          {toastInfo && (
            <Toast ok={toastInfo.ok} msg={toastInfo.msg} onClose={() => setToastInfo(null)} />
          )}

          {!esSuperadmin && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--fg-3)',
              background: 'var(--neutral-50)', border: '1px solid var(--border-subtle)',
            }}>
              <Shield size={13} strokeWidth={2} style={{ flexShrink: 0 }} />
              Solo el administrador puede modificar el nombre y correo de los usuarios.
            </div>
          )}

          {esSuperadmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant={infoChanged ? 'primary' : 'secondary'}
                onClick={handleGuardarInfo}
                disabled={saving || !infoChanged}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          )}
        </div>
      </Section>

      {/* Cambiar contraseña — solo superadmin */}
      {esSuperadmin && (
        <Section title="Cambiar contraseña">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Contraseña actual">
              <div style={{ position: 'relative' }}>
                <TextInput
                  value={passActual}
                  onChange={setPassActual}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Tu contraseña actual"
                />
                <button
                  onClick={() => setShowPass(s => !s)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)',
                    display: 'flex', padding: 0,
                  }}
                >
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
                <TextInput
                  value={passNueva}
                  onChange={setPassNueva}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Nueva contraseña"
                />
              </Field>
              <Field label="Confirmar nueva contraseña">
                <TextInput
                  value={passConfirm}
                  onChange={setPassConfirm}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Repetir contraseña"
                />
              </Field>
            </div>

            {toastPass && (
              <Toast ok={toastPass.ok} msg={toastPass.msg} onClose={() => setToastPass(null)} />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                icon={Lock}
                onClick={handleCambiarPassword}
                disabled={savingPass || !passActual || !passNueva || !passConfirm}
              >
                {savingPass ? 'Actualizando...' : 'Actualizar contraseña'}
              </Button>
            </div>
          </div>
        </Section>
      )}

      {/* Info de cuenta */}
      <Section title="Información de cuenta">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{
            background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)',
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <User size={12} strokeWidth={2} /> ID de usuario
            </div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              {usuario.id ?? '—'}
            </div>
          </div>
          <div style={{
            background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)',
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Calendar size={12} strokeWidth={2} /> Cuenta creada
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
              {fmtFecha(usuario.creadoEn)}
            </div>
          </div>
          <div style={{
            background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)',
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Clock size={12} strokeWidth={2} /> Último acceso
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
              {fmtFecha(usuario.ultimoAcceso)}
            </div>
          </div>
        </div>
      </Section>

    </div>
  )
}
