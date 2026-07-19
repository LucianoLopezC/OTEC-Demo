// Modal de creación y edición de roles personalizados.
// Cada permiso se activa con un Toggle individual para que sea visual y explícito.
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Button    from '../../components/atoms/Button'
import FormField from '../../components/atoms/FormField'
import TextInput from '../../components/atoms/TextInput'
import Toggle    from '../../components/Toggle'

const COLORES = [
  { value: 'brand',   label: 'Azul (Brand)' },
  { value: 'info',    label: 'Celeste' },
  { value: 'success', label: 'Verde' },
  { value: 'warning', label: 'Naranja' },
  { value: 'danger',  label: 'Rojo' },
  { value: 'neutral', label: 'Gris' },
]

const PERMISOS_SECCIONES = [
  { key: 'verDashboard',   label: 'Dashboard',                desc: 'Ver el panel de resumen general' },
  { key: 'verEmpresas',    label: 'Empresas',                 desc: 'Ver el listado global de empresas' },
  { key: 'verPersonas',    label: 'Personas',                 desc: 'Ver el listado de personas y certificados' },
  { key: 'verCursos',      label: 'Gestión de Cursos',        desc: 'Acceder al catálogo de cursos' },
  { key: 'verEmision',     label: 'Emisión de Certificados',  desc: 'Acceder al módulo de emisión' },
  { key: 'verPlantillas',  label: 'Plantillas de Certificado',desc: 'Ver y gestionar plantillas de certificado' },
  { key: 'verVerificar',   label: 'Verificar Certificado',    desc: 'Buscar y verificar certificados por código' },
  { key: 'verReportes',    label: 'Reportes BI',              desc: 'Ver los reportes y análisis de datos' },
  { key: 'verUsuarios',    label: 'Usuarios y Roles',         desc: 'Ver y gestionar usuarios del sistema' },
  { key: 'verCotizador',  label: 'Cotizador de Cursos',      desc: 'Acceder al módulo de cotización (solo superadmin)' },
]

const PERMISOS_ACCIONES = [
  { key: 'crearEmpresa',       label: 'Crear empresas',           desc: 'Agregar nuevas empresas al sistema' },
  { key: 'editarEmpresa',      label: 'Editar empresas',          desc: 'Modificar datos de empresas existentes' },
  { key: 'eliminarEmpresa',    label: 'Eliminar empresas',        desc: 'Eliminar empresas del sistema' },
  { key: 'crearPersona',       label: 'Crear personas',           desc: 'Agregar nuevos participantes' },
  { key: 'crearCurso',         label: 'Crear cursos',             desc: 'Agregar nuevos cursos al catálogo, duplicar e importar' },
  { key: 'emitirCertificados', label: 'Emitir certificados',      desc: 'Generar y emitir certificados' },
  { key: 'gestionarUsuarios',  label: 'Gestionar usuarios',       desc: 'Crear, editar y desactivar usuarios' },
  { key: 'gestionarRoles',     label: 'Gestionar roles',          desc: 'Crear y editar roles personalizados' },
  { key: 'exportarDatos',      label: 'Exportar datos',           desc: 'Descargar tablas y reportes en Excel' },
  { key: 'verDatosEmpresaPropia', label: 'Solo datos de empresa propia', desc: 'Limita la vista a su empresa asignada' },
]

const PERMISOS_VACIOS = {
  verDashboard: false, verEmpresas: false, verPersonas: false, verUsuarios: false,
  verEmision: false, verVerificar: false, verReportes: false,
  verCursos: false, verPlantillas: false,
  crearEmpresa: false, editarEmpresa: false, eliminarEmpresa: false,
  crearPersona: false, crearCurso: false, emitirCertificados: false,
  gestionarUsuarios: false, gestionarRoles: false, exportarDatos: false,
  verCotizador: false, verDatosEmpresaPropia: false,
}

const LABEL_PERMISO = {
  verDashboard: 'Dashboard', verEmpresas: 'Empresas', verPersonas: 'Personas',
  verCursos: 'Cursos', verEmision: 'Emisión', verPlantillas: 'Plantillas',
  verVerificar: 'Verificar', verReportes: 'Reportes', verUsuarios: 'Usuarios',
}

/* ── Styled select ── */
function SSelect({ value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={onChange} style={{
        width: '100%', height: 38, paddingLeft: 12, paddingRight: 28, fontSize: 13,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)', outline: 'none', appearance: 'none',
        fontFamily: 'var(--font-sans)', cursor: 'pointer',
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--neutral-400)', fontSize: 10 }}>▼</span>
    </div>
  )
}

export default function ModalRol({ rol, onClose, onGuardar }) {
  const [nombre,      setNombre]      = useState(rol?.nombre      ?? '')
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? '')
  const [color,       setColor]       = useState(rol?.color       ?? 'brand')
  const [permisos,    setPermisos]    = useState(rol?.permisos    ?? { ...PERMISOS_VACIOS })
  const [errores,     setErrores]     = useState({})
  const [visible,     setVisible]     = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  const togglePermiso = (key, val) => setPermisos(p => ({ ...p, [key]: val }))

  const validate = () => {
    const e = {}
    if (!nombre.trim()) e.nombre = 'Ingrese un nombre para el rol'
    return e
  }

  const handleGuardar = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrores(e); return }
    onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim(), color, permisos, sistema: false })
    handleClose()
  }

  const permisosVer = Object.entries(permisos).filter(([k, v]) => k.startsWith('ver') && v)

  return (
    <div
      onClick={ev => ev.target === ev.currentTarget && handleClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.45)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--modal-pad)', opacity: visible ? 1 : 0, transition: 'opacity 200ms',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 600,
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
            {rol ? 'Editar Rol' : 'Nuevo Rol Personalizado'}
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
        <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Datos básicos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
            <FormField label="Nombre del rol" required error={errores.nombre}>
              <TextInput
                value={nombre} onChange={e => { setNombre(e.target.value); setErrores(er => ({ ...er, nombre: null })) }}
                placeholder="Ej: Auditor Externo"
              />
            </FormField>
            <FormField label="Color del badge">
              <SSelect value={color} onChange={e => setColor(e.target.value)} options={COLORES} />
            </FormField>
          </div>

          <FormField label="Descripción (opcional)">
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Describe brevemente qué puede hacer este rol..."
              rows={2}
              style={{
                width: '100%', padding: '8px 12px', fontSize: 13, color: 'var(--fg-2)',
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical',
                fontFamily: 'var(--font-sans)', lineHeight: 1.5,
              }}
            />
          </FormField>

          {/* Secciones */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 4 }}>
              Secciones visibles
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
              Pantallas a las que puede acceder este rol
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
              {PERMISOS_SECCIONES.map((p, i) => (
                <div key={p.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 14px',
                  borderBottom: i < PERMISOS_SECCIONES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.desc}</div>
                  </div>
                  <Toggle value={permisos[p.key]} onChange={v => togglePermiso(p.key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 4 }}>
              Acciones permitidas
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 12 }}>
              Operaciones que puede ejecutar este rol
            </div>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 10, overflow: 'hidden' }}>
              {PERMISOS_ACCIONES.map((p, i) => (
                <div key={p.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 14px',
                    borderBottom: i < PERMISOS_ACCIONES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{p.desc}</div>
                    </div>
                    <Toggle value={permisos[p.key]} onChange={v => togglePermiso(p.key, v)} />
                  </div>
                  {p.key === 'verDatosEmpresaPropia' && permisos.verDatosEmpresaPropia && (
                    <div style={{
                      background: 'var(--warning-50)', border: '1px solid var(--warning-200)',
                      borderRadius: 8, padding: '10px 14px', margin: '0 12px 12px',
                      fontSize: 12, color: 'var(--warning-600)',
                    }}>
                      ⚠ Los usuarios con este rol solo verán datos de la empresa asignada a su cuenta.
                      Al asignar este rol a un usuario, será obligatorio especificar su empresa.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{
            background: 'var(--neutral-50)', borderRadius: 10, padding: '14px',
            fontSize: 12, color: 'var(--fg-2)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--fg-1)' }}>Vista previa del acceso</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {permisosVer.length === 0 && (
                <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>Sin secciones habilitadas aún</span>
              )}
              {permisosVer.map(([k]) => LABEL_PERMISO[k] && (
                <span key={k} style={{
                  background: 'var(--success-50)', color: 'var(--success-600)',
                  borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                }}>
                  ✓ {LABEL_PERMISO[k]}
                </span>
              ))}
              {Object.entries(permisos).filter(([k, v]) => k.startsWith('ver') && !v).map(([k]) => LABEL_PERMISO[k] && (
                <span key={k} style={{
                  background: 'var(--neutral-100)', color: 'var(--fg-4)',
                  borderRadius: 999, padding: '2px 8px', fontSize: 11,
                  textDecoration: 'line-through',
                }}>
                  {LABEL_PERMISO[k]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          <Button variant="secondary" size="md" onClick={handleClose}>Cancelar</Button>
          <Button variant="primary"   size="md" onClick={handleGuardar}>
            {rol ? 'Guardar cambios' : 'Crear rol'}
          </Button>
        </div>
      </div>
    </div>
  )
}
