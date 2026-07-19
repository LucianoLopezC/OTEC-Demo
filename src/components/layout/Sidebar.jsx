import { useState } from 'react'
import {
  LayoutDashboard, Building2, Users, ShieldCheck,
  Award, BadgeCheck, BarChart2, BookOpen, FileText,
  ChevronLeft, ChevronRight, ClipboardList, Archive, X,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { brand } from '../../config/brand'

// Definición de todos los ítems del menú. Los que tienen `section` son separadores de grupo.
// permiso es el key del objeto permisos del rol. Si falta el permiso, el ítem no se muestra.
const NAV = [
  { id: 'dashboard',  label: 'Dashboard',               icon: LayoutDashboard, permiso: 'verDashboard' },
  { section: 'ADMINISTRACIÓN' },
  { id: 'empresas',   label: 'Empresas',                icon: Building2,       permiso: 'verEmpresas' },
  { id: 'personas',   label: 'Personas',                icon: Users,           permiso: 'verPersonas' },
  { id: 'usuarios',   label: 'Usuarios y Roles',        icon: ShieldCheck,     permiso: 'verUsuarios' },
  { section: 'CERTIFICADOS' },
  { id: 'gestionCursos', label: 'Gestión de Cursos',   icon: BookOpen,        permiso: 'verCursos' },
  { id: 'emision',    label: 'Emisión de Certificados', icon: Award,           permiso: 'verEmision' },
  { id: 'plantillas',        label: 'Plantillas',                icon: FileText, permiso: 'verPlantillas' },
  { id: 'lotesCertificados', label: 'Lotes de Certificados',    icon: Archive,  permiso: 'verPlantillas' },
  { section: 'OPERACIÓN' },
  { id: 'verify',     label: 'Verificar Certificado',   icon: BadgeCheck,      permiso: 'verVerificar' },
  { id: 'reportes',   label: 'Reportes BI',             icon: BarChart2,       permiso: 'verReportes' },
  { id: 'cotizador',  label: 'Cotizador de Cursos',     icon: ClipboardList,   permiso: 'verCotizador' },
]

function NavItem({ icon: Icon, label, active, collapsed, onClick, mobile }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed && !mobile ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: (collapsed && !mobile) ? '10px 0' : '10px 18px',
        justifyContent: (collapsed && !mobile) ? 'center' : 'flex-start',
        cursor: 'pointer', position: 'relative',
        background: active ? 'var(--bg-sidebar-active)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 150ms',
        color: active ? 'var(--fg-sidebar-active)' : 'var(--fg-sidebar)',
        minHeight: 44,
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
          borderRadius: '0 3px 3px 0', background: 'var(--info-400)',
        }} />
      )}
      <Icon size={18} strokeWidth={active ? 2 : 1.75} style={{ flexShrink: 0 }} />
      {(!collapsed || mobile) && (
        <span style={{
          fontSize: 13.5, fontWeight: active ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

// En mobile el sidebar se superpone como overlay deslizable en vez de estar fijo al lado.
export default function Sidebar({ active, onNav, collapsed, onToggle, isMobile, mobileOpen, onMobileClose }) {
  const { sesion } = useApp()

  const isOverlay = isMobile

  const sidebarLabel = sesion?.rol?.id === 'superadmin' ? 'Admin' : null
  const sidebarWidth = isOverlay ? 260 : (collapsed ? 64 : 240)

  // Verifica el permiso con !== false en vez de === true para que
  // los ítems sin permiso definido (como 'dashboard') siempre sean visibles.
  const tienePermiso = (permiso) => {
    if (!permiso) return true
    if (!sesion) return false
    return sesion.rol?.permisos?.[permiso] !== false
  }

  // Pre-calcula qué secciones tienen al menos un ítem visible antes de renderizar,
  // para evitar que aparezca un header de sección sin ítems debajo.
  const seccionesVisibles = new Set()
  let seccionActual = null
  for (const item of NAV) {
    if (item.section) {
      seccionActual = item.section
    } else if (seccionActual && tienePermiso(item.permiso)) {
      seccionesVisibles.add(seccionActual)
    }
  }

  const handleNav = (id) => {
    onNav(id)
    if (isOverlay) onMobileClose?.()
  }

  return (
    <>
      {/* Backdrop on mobile */}
      {isOverlay && mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 190, transition: 'opacity 250ms',
          }}
        />
      )}

      <div style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        height: '100vh',
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        position: isOverlay ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        transform: isOverlay
          ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)')
          : 'none',
        transition: isOverlay
          ? 'transform 260ms cubic-bezier(0.4,0,0.2,1)'
          : 'width 250ms cubic-bezier(0.4,0,0.2,1), min-width 250ms cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        zIndex: isOverlay ? 200 : 20,
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: '0 18px', gap: 10,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0, justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(!collapsed || isOverlay) && (
              <span style={{ fontSize: 14, color: 'var(--fg-sidebar)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {brand.name}{sidebarLabel && <strong style={{ fontWeight: 800, color: '#fff' }}> {sidebarLabel}</strong>}
              </span>
            )}
          </div>
          {/* Close button on mobile */}
          {isOverlay && (
            <button
              onClick={onMobileClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(255,255,255,0.07)', border: 'none',
                color: 'var(--fg-sidebar-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0' }}>
          {NAV.map((item, i) => {
            if (item.section) {
              if (!seccionesVisibles.has(item.section)) return null
              return (collapsed && !isOverlay) ? (
                <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '8px 12px' }} />
              ) : (
                <div key={i} style={{
                  fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--fg-sidebar-header)',
                  padding: '14px 20px 6px',
                }}>
                  {item.section}
                </div>
              )
            }

            if (!tienePermiso(item.permiso)) return null

            return (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={active === item.id}
                collapsed={collapsed}
                mobile={isOverlay}
                onClick={() => handleNav(item.id)}
              />
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px',
          display: 'flex', alignItems: 'center',
          justifyContent: (collapsed && !isOverlay) ? 'center' : 'space-between',
          flexShrink: 0,
        }}>
          {(!collapsed || isOverlay) && (
            <span style={{ fontSize: 11, color: 'var(--fg-sidebar-muted)' }}>v1.0.0</span>
          )}
          {/* Only show collapse toggle on desktop */}
          {!isOverlay && (
            <button
              onClick={onToggle}
              style={{
                width: 30, height: 30, borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.07)', border: 'none',
                color: 'var(--fg-sidebar-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {collapsed ? <ChevronRight size={15} strokeWidth={2} /> : <ChevronLeft size={15} strokeWidth={2} />}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
