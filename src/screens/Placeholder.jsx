// Pantalla genérica para rutas que todavía no tienen implementación.
// App.jsx la usa como fallback en el case default del switch de pantallas.
import {
  Tag, Users, ShieldCheck, FileText, Code2, BarChart2,
  Award, LayoutDashboard, Building2,
} from 'lucide-react'

const ICONS = {
  categorias: Tag,
  personas:   Users,
  usuarios:   ShieldCheck,
  cursos:     Award,
  plantillas: FileText,
  shortcodes: Code2,
  reportes:   BarChart2,
  dashboard:  LayoutDashboard,
  empresas:   Building2,
}

const LABELS = {
  categorias: 'Categorías',
  personas:   'Personas',
  usuarios:   'Usuarios y Roles',
  cursos:     'Cursos / Certificados',
  plantillas: 'Plantillas',
  shortcodes: 'Shortcodes',
  reportes:   'Reportes BI',
}

export default function Placeholder({ screen }) {
  const Icon = ICONS[screen] ?? LayoutDashboard
  const label = LABELS[screen] ?? screen

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: 40,
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
        padding: '56px 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: 420,
        width: '100%',
        gap: 16,
      }}>
        <div style={{
          width: 68,
          height: 68,
          borderRadius: '50%',
          background: 'var(--neutral-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--neutral-400)',
        }}>
          <Icon size={30} strokeWidth={1.5} />
        </div>
        <div>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--fg-1)',
            letterSpacing: '-0.01em',
            marginBottom: 8,
          }}>
            {label}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.55 }}>
            Pantalla sin implementación en esta versión del panel.
          </p>
        </div>
      </div>
    </div>
  )
}
