// Tab de usuarios: tabla con búsqueda, filtro por rol y acciones de crear/editar/eliminar.
// Las contraseñas se hashean en el servidor (PHP bcrypt), no en el frontend.
import { useState, useMemo } from 'react'
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, AlertTriangle, X as XIcon } from 'lucide-react'
import Avatar       from '../../components/atoms/Avatar'
import Badge        from '../../components/atoms/Badge'
import IconButton   from '../../components/atoms/IconButton'
import Button       from '../../components/atoms/Button'
import FiltroSelect from '../../components/atoms/FiltroSelect'
import { useApp } from '../../context/AppContext'
import ModalUsuario from './ModalUsuario'

const TH = {
  padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--neutral-50)',
  borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap', textAlign: 'left',
}
const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--fg-2)', verticalAlign: 'middle' }

function fmtFecha(iso) {
  if (!iso) return 'Nunca'
  const [y, m, d] = iso.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d} ${meses[parseInt(m) - 1]} ${y}`
}

function generarId() {
  return 'u_' + Date.now().toString(36)
}


export default function TabUsuarios() {
  const { usuarios, crearUsuario, editarUsuario, eliminarUsuario, todosLosRoles, sesion } = useApp()
  const [busqueda,    setBusqueda]    = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroRol,    setFiltroRol]    = useState('todos')
  const [modalUsuario,      setModalUsuario]      = useState(null)  // null | 'nuevo' | usuario
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null)

  const usuarioActual = sesion?.usuario

  const filtrados = useMemo(() => {
    let list = [...usuarios]
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(u => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    if (filtroEstado !== 'todos') list = list.filter(u => u.activo === (filtroEstado === 'activo'))
    if (filtroRol    !== 'todos') list = list.filter(u => u.rolId === filtroRol)
    return list
  }, [usuarios, busqueda, filtroEstado, filtroRol])

  const opcionesRol = [
    { value: 'todos', label: 'Todos los roles' },
    ...todosLosRoles.map(r => ({ value: r.id, label: r.nombre })),
  ]

  const handleGuardarUsuario = async (datos) => {
    try {
      if (modalUsuario === 'nuevo') {
        await crearUsuario({
          creadoEn: new Date().toISOString().slice(0, 10),
          ultimoAcceso: '',
          ...datos,
        })
      } else {
        await editarUsuario({ ...modalUsuario, ...datos })
      }
      setModalUsuario(null)
    } catch (err) {
      console.error('Error al guardar usuario:', err)
    }
  }

  const handleToggleActivo = async (u) => {
    if (u.id === usuarioActual?.id) return
    try {
      await editarUsuario({ ...u, activo: !u.activo })
    } catch (err) {
      console.error('Error al actualizar usuario:', err)
    }
  }

  const handleEliminar = async (u) => {
    if (u.id === usuarioActual?.id) return
    try {
      await eliminarUsuario(u.id)
    } catch (err) {
      console.error('Error al eliminar usuario:', err)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={14} strokeWidth={1.75} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--neutral-400)', pointerEvents: 'none',
          }} />
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email..."
            style={{
              width: '100%', height: 30, paddingLeft: 32, paddingRight: busqueda ? 28 : 10,
              fontSize: 12, color: 'var(--fg-2)', background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', display: 'flex', padding: 0,
            }}>
              <XIcon size={12} strokeWidth={2} />
            </button>
          )}
        </div>
        <FiltroSelect
          label="Estado"
          value={filtroEstado}
          onChange={setFiltroEstado}
          options={[
            { value: 'todos',    label: 'Todos' },
            { value: 'activo',   label: 'Activos' },
            { value: 'inactivo', label: 'Inactivos' },
          ]}
        />
        <FiltroSelect label="Rol" value={filtroRol} onChange={setFiltroRol} options={opcionesRol} />
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setModalUsuario('nuevo')}>
          Nuevo Usuario
        </Button>
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Usuario</th>
                <th style={TH}>Email</th>
                <th style={TH}>Rol</th>
                <th style={TH}>Empresa</th>
                <th style={TH}>Estado</th>
                <th style={TH}>Último acceso</th>
                <th style={{ ...TH, textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
                    Sin usuarios para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtrados.map(u => {
                  const esSesionActual = u.id === usuarioActual?.id
                  const rol = todosLosRoles.find(r => r.id === u.rolId)
                  return (
                    <tr key={u.id} style={{
                      borderTop: '1px solid var(--border-subtle)',
                      background: esSesionActual ? 'var(--brand-50)' : 'var(--bg-surface)',
                    }}>
                      {/* Usuario */}
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={u.nombre} size={28} />
                          <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{u.nombre}</span>
                          {esSesionActual && (
                            <span style={{
                              background: 'var(--brand-100)', color: 'var(--brand-700)',
                              borderRadius: 999, padding: '1px 7px', fontSize: 10, fontWeight: 700,
                            }}>Tú</span>
                          )}
                        </div>
                      </td>
                      {/* Email */}
                      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>
                        {u.email}
                      </td>
                      {/* Rol */}
                      <td style={TD}>
                        {rol ? <Badge variant={rol.color ?? 'neutral'} dot={false}>{rol.nombre}</Badge> : u.rolId}
                      </td>
                      {/* Empresa */}
                      <td style={TD}>
                        {u.empresaNombre
                          ? <span style={{ fontSize: 12 }}>{u.empresaNombre}</span>
                          : <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>— Todas —</span>
                        }
                      </td>
                      {/* Estado */}
                      <td style={TD}>
                        <Badge variant={u.activo ? 'success' : 'neutral'} dot={false}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      {/* Último acceso */}
                      <td style={{ ...TD, fontSize: 12, color: 'var(--fg-3)' }}>
                        {fmtFecha(u.ultimoAcceso)}
                      </td>
                      {/* Acciones */}
                      <td style={{ ...TD, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <IconButton
                            icon={Edit2} size={30} variant="ghost"
                            title="Editar usuario"
                            onClick={() => setModalUsuario(u)}
                          />
                          <IconButton
                            icon={u.activo ? Eye : EyeOff} size={30} variant="ghost"
                            title={esSesionActual ? 'No puedes desactivar tu propia cuenta' : (u.activo ? 'Desactivar cuenta' : 'Activar cuenta')}
                            onClick={() => handleToggleActivo(u)}
                            style={{
                              opacity: esSesionActual ? 0.3 : 1,
                              cursor: esSesionActual ? 'not-allowed' : 'pointer',
                              color: u.activo ? 'var(--fg-3)' : 'var(--danger-500)',
                            }}
                          />
                          {!esSesionActual && u.id !== 'u1' && (
                            <IconButton
                              icon={Trash2} size={30} variant="ghost"
                              title="Eliminar usuario"
                              onClick={() => setUsuarioAEliminar(u)}
                              style={{ color: 'var(--danger-500)' }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(modalUsuario === 'nuevo' || (modalUsuario && modalUsuario !== 'nuevo')) && (
        <ModalUsuario
          usuario={modalUsuario === 'nuevo' ? null : modalUsuario}
          onClose={() => setModalUsuario(null)}
          onGuardar={handleGuardarUsuario}
        />
      )}

      {usuarioAEliminar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)', padding: 28, maxWidth: 440, width: '90%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: 'var(--danger-50)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={18} color="var(--danger-600)" strokeWidth={2} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}>
                ¿Eliminar usuario?
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
              Se eliminará <strong>{usuarioAEliminar.nombre}</strong> ({usuarioAEliminar.email})
              del sistema. Esta acción no se puede deshacer.
            </p>

            <div style={{
              background: '#FFFBEB', border: '1px solid #F59E0B',
              borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#78350F',
              marginBottom: 20, lineHeight: 1.5,
            }}>
              <strong>Sugerencia:</strong> si solo quieres bloquear el acceso temporalmente,
              usa <em>Inhabilitar</em> — el historial y los certificados asociados se conservan.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => setUsuarioAEliminar(null)}>
                Cancelar
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await handleToggleActivo({ ...usuarioAEliminar, activo: true })
                  setUsuarioAEliminar(null)
                }}
                style={{ color: 'var(--fg-2)', border: '1px solid var(--border-default)' }}
              >
                Inhabilitar en su lugar
              </Button>
              <Button
                variant="primary"
                style={{ background: 'var(--danger-600)', borderColor: 'var(--danger-600)' }}
                onClick={async () => {
                  await handleEliminar(usuarioAEliminar)
                  setUsuarioAEliminar(null)
                }}
              >
                Eliminar de todas formas
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
