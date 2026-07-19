// Tab de roles: lista los roles del sistema y los roles personalizados.
// Los roles de sistema (superadmin, operador, empresa) se pueden editar pero no eliminar.
import { useState, useCallback } from 'react'
import { Plus, Lock, Edit2, Trash2, CheckCircle2 } from 'lucide-react'
import Button     from '../../components/atoms/Button'
import Badge      from '../../components/atoms/Badge'
import IconButton from '../../components/atoms/IconButton'
import { useApp } from '../../context/AppContext'
import { useConfirm } from '../../context/ConfirmContext'
import ModalRol   from './ModalRol'

const LABEL_PERMISO = {
  verDashboard: 'Dashboard',  verEmpresas: 'Empresas',   verPersonas: 'Personas',
  verCursos: 'Cursos',        verEmision: 'Emisión',      verPlantillas: 'Plantillas',
  verVerificar: 'Verificar',  verReportes: 'Reportes',   verUsuarios: 'Usuarios',
  verCotizador: 'Cotizador',
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      background: toast.type === 'error' ? 'var(--danger-500)' : 'var(--success-500)',
      color: '#fff', borderRadius: 'var(--radius-md)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--shadow-lg)', fontSize: 13, fontWeight: 500,
    }}>
      <CheckCircle2 size={16} strokeWidth={2} />
      {toast.msg}
    </div>
  )
}

export default function TabRoles() {
  const { todosLosRoles, crearRol, editarRol, eliminarRol, usuarios } = useApp()
  const confirm = useConfirm()
  const [modalRol, setModalRol] = useState(null)   // null | 'nuevo' | rol
  const [toast,    setToast]    = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const cantidadPorRol = (rolId) => usuarios.filter(u => u.rolId === rolId).length

  const handleGuardarRol = async (datos) => {
    try {
      if (modalRol === 'nuevo') {
        await crearRol({ ...datos, sistema: false })
        showToast('Rol creado correctamente')
      } else {
        await editarRol({ ...modalRol, ...datos, sistema: !!modalRol.sistema })
        showToast('Rol actualizado correctamente')
      }
      setModalRol(null)
    } catch (err) {
      showToast(err.message || 'Error al guardar el rol', 'error')
    }
  }

  const handleEliminarRol = async (rol) => {
    if (rol.id === 'superadmin') {
      showToast('El Superadministrador no puede eliminarse', 'error')
      return
    }
    const enUso = cantidadPorRol(rol.id) > 0
    if (enUso) {
      showToast(`No se puede eliminar "${rol.nombre}": tiene usuarios asignados`, 'error')
      return
    }
    const ok = await confirm(`¿Eliminar el rol "${rol.nombre}"?`, { confirmLabel: 'Eliminar rol' })
    if (!ok) return
    try {
      await eliminarRol(rol.id)
      showToast('Rol eliminado')
    } catch (err) {
      showToast(err.message || 'Error al eliminar el rol', 'error')
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <Button variant="primary" size="md" icon={Plus} onClick={() => setModalRol('nuevo')}>
          Nuevo Rol
        </Button>
      </div>

      {/* Grid de cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {todosLosRoles.map(rol => {
          const esSistema    = rol.sistema === true
          const esSuperAdmin = rol.id === 'superadmin'
          const count        = cantidadPorRol(rol.id)
          const permisosOn  = Object.entries(rol.permisos ?? {}).filter(([k, v]) => k.startsWith('ver') && v)
          const permisosOff = Object.entries(rol.permisos ?? {}).filter(([k, v]) => k.startsWith('ver') && !v)

          return (
            <div key={rol.id} style={{
              background: 'var(--bg-surface)', borderRadius: 14, padding: 20,
              boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-subtle)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge variant={rol.color ?? 'neutral'} dot={false}>{rol.nombre}</Badge>
                  {esSuperAdmin && (
                    <span title="El Superadministrador siempre tiene todos los permisos y no puede editarse" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'var(--neutral-100)', color: 'var(--neutral-500)',
                      borderRadius: 999, padding: '2px 7px', fontSize: 10, fontWeight: 600,
                    }}>
                      <Lock size={9} strokeWidth={2} /> No editable
                    </span>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <p style={{
                fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5, margin: 0,
                display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {rol.descripcion || <em style={{ color: 'var(--fg-4)' }}>Sin descripción</em>}
              </p>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              {/* Permisos */}
              <div>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, color: 'var(--fg-3)',
                  marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  Secciones con acceso
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {permisosOn.map(([k]) => LABEL_PERMISO[k] && (
                    <span key={k} style={{
                      background: 'var(--success-50)', color: 'var(--success-600)',
                      borderRadius: 999, padding: '2px 7px', fontSize: 10.5, fontWeight: 500,
                    }}>
                      ✓ {LABEL_PERMISO[k]}
                    </span>
                  ))}
                  {permisosOff.map(([k]) => LABEL_PERMISO[k] && (
                    <span key={k} style={{
                      background: 'var(--neutral-100)', color: 'var(--fg-4)',
                      borderRadius: 999, padding: '2px 7px', fontSize: 10.5,
                      textDecoration: 'line-through',
                    }}>
                      {LABEL_PERMISO[k]}
                    </span>
                  ))}
                  {permisosOn.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>Sin secciones habilitadas</span>
                  )}
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  {count} usuario{count !== 1 ? 's' : ''} con este rol
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <IconButton
                    icon={Edit2} size={28} variant="ghost"
                    title={esSuperAdmin ? 'El Superadministrador no puede editarse' : 'Editar rol'}
                    onClick={() => !esSuperAdmin && setModalRol(rol)}
                    style={{
                      opacity: esSuperAdmin ? 0.3 : 1,
                      cursor: esSuperAdmin ? 'not-allowed' : 'pointer',
                    }}
                  />
                  <IconButton
                    icon={Trash2} size={28} variant="ghost"
                    title={esSuperAdmin ? 'El Superadministrador no puede eliminarse' : 'Eliminar rol'}
                    onClick={() => handleEliminarRol(rol)}
                    style={{
                      opacity: esSuperAdmin ? 0.3 : 1,
                      cursor: esSuperAdmin ? 'not-allowed' : 'pointer',
                      color: esSuperAdmin ? undefined : 'var(--danger-500)',
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {(modalRol !== null) && (
        <ModalRol
          rol={modalRol === 'nuevo' ? null : modalRol}
          onClose={() => setModalRol(null)}
          onGuardar={handleGuardarRol}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
