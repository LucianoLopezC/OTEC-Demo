// Modal de creación y edición de usuario. Al editar, la contraseña es opcional
// (si se deja vacía el servidor mantiene la anterior).
import { useState, useEffect } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import Button    from '../../components/atoms/Button'
import FormField from '../../components/atoms/FormField'
import TextInput from '../../components/atoms/TextInput'
import { useApp } from '../../context/AppContext'

const LABEL_PERMISO = {
  verDashboard: 'Dashboard', verEmpresas: 'Empresas', verPersonas: 'Personas',
  verEmision: 'Emisión', verVerificar: 'Verificar', verReportes: 'Reportes', verUsuarios: 'Usuarios',
}

function SSelect({ value, onChange, options, placeholder, error }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={onChange} style={{
        width: '100%', height: 38, paddingLeft: 12, paddingRight: 28, fontSize: 13,
        color: value ? 'var(--fg-2)' : 'var(--neutral-400)',
        background: 'var(--bg-surface)',
        border: `1px solid ${error ? 'var(--danger-500)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', appearance: 'none',
        fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--neutral-400)', fontSize: 10 }}>▼</span>
    </div>
  )
}

function validarPassword(pass) {
  if (pass.length < 8)                        return 'Mínimo 8 caracteres'
  if (!/[A-Z]/.test(pass))                   return 'Debe incluir al menos una mayúscula'
  if (!/[0-9]/.test(pass))                   return 'Debe incluir al menos un número'
  if (!/[!@#$%^&*\-_=+?.]/.test(pass))      return 'Debe incluir al menos un carácter especial (!@#$%...)'
  return null
}

export default function ModalUsuario({ usuario, onClose, onGuardar }) {
  const { usuarios, todosLosRoles, empresas } = useApp()

  const [nombre,      setNombre]      = useState(usuario?.nombre      ?? '')
  const [email,       setEmail]       = useState(usuario?.email       ?? '')
  const [password,    setPassword]    = useState('')
  const [password2,   setPassword2]   = useState('')
  const [rolId,       setRolId]       = useState(usuario?.rolId       ?? '')
  const [empresaId,   setEmpresaId]   = useState(usuario?.empresaId   ?? '')
  const [activo,      setActivo]      = useState(usuario?.activo      ?? true)
  const [errores,     setErrores]     = useState({})
  const [visible,     setVisible]     = useState(false)
  const [showPass,    setShowPass]    = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  const rolSeleccionado = todosLosRoles.find(r => String(r.id) === String(rolId))
  const necesitaEmpresa = rolSeleccionado?.permisos?.verDatosEmpresaPropia === true

  const empresasActivas = empresas.filter(e => e.estado === 'Activa')

  const validate = () => {
    const e = {}
    if (!nombre.trim())  e.nombre = 'Ingrese el nombre completo'
    if (!email.trim())   e.email  = 'Ingrese el correo electrónico'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Formato de correo inválido'
    else {
      const existe = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== usuario?.id)
      if (existe) e.email = 'Este correo ya está registrado'
    }
    if (!rolId)          e.rolId  = 'Seleccione un rol'
    if (necesitaEmpresa && !empresaId) e.empresaId = 'Este rol requiere una empresa asignada'
    if (!usuario) {
      if (!password)     e.password  = 'Ingrese una contraseña'
      else {
        const err = validarPassword(password)
        if (err) e.password = err
      }
      if (password !== password2) e.password2 = 'Las contraseñas no coinciden'
    } else {
      if (password) {
        const err = validarPassword(password)
        if (err) e.password = err
        if (password !== password2) e.password2 = 'Las contraseñas no coinciden'
      }
    }
    return e
  }

  const handleGuardar = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrores(e); return }

    const empresa = necesitaEmpresa ? empresas.find(em => String(em.id) === String(empresaId)) : null

    const datos = {
      nombre:       nombre.trim(),
      email:        email.trim(),
      rolId,
      empresaId:    necesitaEmpresa ? empresaId : null,
      empresaNombre: empresa?.nombre ?? null,
      activo,
    }
    if (!usuario || password) datos.password = password

    onGuardar(datos)
    handleClose()
  }

  const permisosVer = rolSeleccionado
    ? Object.entries(rolSeleccionado.permisos).filter(([k, v]) => k.startsWith('ver') && v)
    : []

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.45)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--modal-pad)', opacity: visible ? 1 : 0, transition: 'opacity 200ms',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        transform: visible ? 'scale(1)' : 'scale(0.97)', transition: 'transform 200ms',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-1)' }}>
            {usuario ? 'Editar Usuario' : 'Nuevo Usuario'}
          </div>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'transparent',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--fg-3)',
          }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField label="Nombre completo" required error={errores.nombre}>
            <TextInput
              value={nombre} onChange={e => { setNombre(e.target.value); setErrores(er => ({ ...er, nombre: null })) }}
              placeholder="Ej: Usuario Ejemplo"
            />
          </FormField>

          <FormField label="Correo electrónico" required error={errores.email}>
            <TextInput
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); setErrores(er => ({ ...er, email: null })) }}
              placeholder="usuario@ejemplo.cl"
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label={usuario ? 'Nueva contraseña' : 'Contraseña'} required={!usuario} error={errores.password}>
              <div style={{ position: 'relative' }}>
                <TextInput
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setErrores(er => ({ ...er, password: null, password2: null })) }}
                  placeholder={usuario ? 'Dejar vacío para no cambiar' : '••••••••'}
                  style={{ paddingRight: 36 }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: 'var(--neutral-400)', display: 'flex', alignItems: 'center',
                }}>
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </FormField>
            <FormField label="Repetir contraseña" required={!usuario && !!password} error={errores.password2}>
              <div style={{ position: 'relative' }}>
                <TextInput
                  type={showPass ? 'text' : 'password'} value={password2}
                  onChange={e => { setPassword2(e.target.value); setErrores(er => ({ ...er, password2: null })) }}
                  placeholder="••••••••"
                  style={{ paddingRight: 36 }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                  color: 'var(--neutral-400)', display: 'flex', alignItems: 'center',
                }}>
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                </button>
              </div>
            </FormField>
          </div>

          {/* Rol */}
          <FormField label="Rol" required error={errores.rolId}>
            <SSelect
              value={rolId}
              onChange={e => { setRolId(e.target.value); setEmpresaId(''); setErrores(er => ({ ...er, rolId: null, empresaId: null })) }}
              placeholder="— Seleccione un rol —"
              options={todosLosRoles.map(r => ({ value: r.id, label: r.nombre }))}
              error={!!errores.rolId}
            />
          </FormField>

          {/* Preview del rol */}
          {rolSeleccionado && (
            <div style={{
              background: 'var(--neutral-50)', borderRadius: 8, padding: '12px 14px',
              fontSize: 12, color: 'var(--fg-2)',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--fg-1)' }}>
                Accesos del rol seleccionado
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {permisosVer.map(([k]) => LABEL_PERMISO[k] && (
                  <span key={k} style={{
                    background: 'var(--success-50)', color: 'var(--success-600)',
                    borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                  }}>
                    ✓ {LABEL_PERMISO[k]}
                  </span>
                ))}
                {Object.entries(rolSeleccionado.permisos)
                  .filter(([k, v]) => k.startsWith('ver') && !v)
                  .map(([k]) => LABEL_PERMISO[k] && (
                    <span key={k} style={{
                      background: 'var(--neutral-100)', color: 'var(--fg-4)',
                      borderRadius: 999, padding: '2px 8px', fontSize: 11,
                      textDecoration: 'line-through',
                    }}>
                      {LABEL_PERMISO[k]}
                    </span>
                  ))
                }
              </div>
            </div>
          )}

          {/* Empresa asignada — solo si el rol lo requiere */}
          {necesitaEmpresa && (
            <FormField label="Empresa asignada" required error={errores.empresaId}>
              <SSelect
                value={empresaId}
                onChange={e => { setEmpresaId(e.target.value); setErrores(er => ({ ...er, empresaId: null })) }}
                placeholder="— Seleccione una empresa —"
                options={empresasActivas.map(e => ({ value: e.id, label: e.nombre }))}
                error={!!errores.empresaId}
              />
            </FormField>
          )}

          {/* Estado */}
          <FormField label="Estado de la cuenta">
            <div style={{ display: 'flex', gap: 8 }}>
              {[true, false].map(v => (
                <button key={String(v)} onClick={() => setActivo(v)} style={{
                  flex: 1, height: 38, borderRadius: 'var(--radius-md)', fontSize: 13,
                  fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  transition: 'all 150ms', fontFamily: 'var(--font-sans)',
                  background: activo === v ? (v ? 'var(--success-500)' : 'var(--danger-500)') : 'var(--bg-surface)',
                  color: activo === v ? '#fff' : 'var(--fg-3)',
                  borderColor: activo === v ? (v ? 'var(--success-500)' : 'var(--danger-500)') : 'var(--border-default)',
                }}>
                  {v ? 'Activo' : 'Inactivo'}
                </button>
              ))}
            </div>
          </FormField>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          <Button variant="secondary" size="md" onClick={handleClose}>Cancelar</Button>
          <Button variant="primary"   size="md" onClick={handleGuardar}>
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </div>
      </div>
    </div>
  )
}
