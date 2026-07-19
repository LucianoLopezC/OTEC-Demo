// Gestión de usuarios y roles: pantalla con dos tabs.
// Solo accesible para roles con el permiso gestionarUsuarios (superadmin por defecto).
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import AccesoDenegado from '../../components/AccesoDenegado'
import TabUsuarios from './TabUsuarios'
import TabRoles    from './TabRoles'

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'roles',    label: 'Roles' },
]

export default function UsuariosRoles() {
  const { sesion } = useApp()
  const [tab, setTab] = useState('usuarios')

  if (!sesion?.rol?.permisos?.gestionarUsuarios) {
    return <AccesoDenegado seccion="Usuarios y Roles" />
  }

  return (
    <div style={{ padding: 'var(--screen-pad)' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border-default)',
        marginBottom: 24,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px', fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--brand-600)' : 'var(--fg-3)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: tab === t.id ? '2px solid var(--brand-600)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 150ms, border-color 150ms',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'usuarios' && <TabUsuarios />}
      {tab === 'roles'    && <TabRoles />}
    </div>
  )
}
