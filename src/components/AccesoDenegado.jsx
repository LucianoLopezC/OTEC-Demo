import { ShieldOff } from 'lucide-react'

// Pantalla de bloqueo que se muestra cuando el rol no tiene permiso para una sección.
// App.jsx la renderiza en lugar del componente de pantalla cuando el permiso falla.
export default function AccesoDenegado({ seccion }) {
  return (
    <div style={{ padding: 28 }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 14, padding: '56px 32px',
        boxShadow: 'var(--shadow-sm)', textAlign: 'center',
        maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16, margin: '0 auto 16px',
          background: 'var(--danger-50)', color: 'var(--danger-500)',
          display: 'grid', placeItems: 'center',
        }}>
          <ShieldOff size={28} strokeWidth={1.75} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)' }}>
          Acceso denegado
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 8, lineHeight: 1.5 }}>
          No tienes permisos para acceder a <strong>{seccion}</strong>.<br />
          Contacta al administrador del sistema si crees que esto es un error.
        </div>
      </div>
    </div>
  )
}
