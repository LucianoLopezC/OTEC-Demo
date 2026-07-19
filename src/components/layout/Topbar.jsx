import { useState } from 'react'
import { ChevronDown, ChevronRight, User, Settings, LogOut, Building2, Database, Moon, Sun, Menu } from 'lucide-react'
import Avatar  from '../atoms/Avatar'
import { useApp } from '../../context/AppContext'

function DropdownItem({ icon: Icon, label, danger, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', fontSize: 13,
        color: danger ? 'var(--danger-500)' : 'var(--fg-2)',
        background: hovered ? (danger ? 'var(--danger-50)' : 'var(--neutral-50)') : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background 150ms', fontFamily: 'var(--font-sans)', fontWeight: 400,
      }}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </button>
  )
}


// Barra superior fija con título de pantalla, indicador de sync, toggle de dark mode y menú de usuario.
// El menú de "Estado de BD" solo aparece para superadmin — los demás no lo ven en el dropdown.
export default function Topbar({
  title, subtitle, breadcrumb = [], onLogout, onSettingsSheets, onNav,
  darkMode, onToggleDark, sincronizando,
  isMobile, onMobileMenuOpen,
}) {
  const { sesion } = useApp()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const nombre        = sesion?.usuario?.nombre  ?? 'Usuario'
  const rolNombre     = sesion?.rol?.nombre      ?? ''
  const empresaNombre = sesion?.usuario?.empresaNombre ?? null
  const esEmpresaScope = sesion?.rol?.permisos?.verDatosEmpresaPropia === true
  const esSuperadmin  = sesion?.rol?.id === 'superadmin'

  return (
    <header style={{
        height: 64, background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        gap: isMobile ? 8 : 16,
        position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>

        {/* Hamburger on mobile */}
        {isMobile && (
          <button
            onClick={onMobileMenuOpen}
            style={{
              width: 36, height: 36, flexShrink: 0,
              background: 'transparent',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--fg-2)',
            }}
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
        )}

        {/* Left: title */}
        <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
          {!isMobile && breadcrumb.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
              {breadcrumb.map((crumb, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {i > 0 && <ChevronRight size={10} strokeWidth={2} color="var(--fg-4)" />}
                  <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{crumb}</span>
                </span>
              ))}
            </div>
          )}
          <h1 style={{
            fontSize: isMobile ? 16 : 20,
            fontWeight: 700, color: 'var(--fg-1)',
            letterSpacing: '-0.01em', lineHeight: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {title}
          </h1>
          {!isMobile && subtitle && <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{subtitle}</p>}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexShrink: 0 }}>

          {/* Chip empresa (rol empresa scope) — oculto en móvil */}
          {!isMobile && esEmpresaScope && empresaNombre && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--success-50)', color: 'var(--success-600)',
              border: '1px solid var(--success-400)', borderRadius: 999,
              padding: '4px 12px', fontSize: 12, fontWeight: 600,
            }}>
              <Building2 size={13} strokeWidth={1.75} />
              {empresaNombre}
            </div>
          )}


          {/* Indicador de sincronización automática */}
          {sincronizando && (
            <>
              <style>{`@keyframes topbar-spin { to { transform: rotate(360deg); } }`}</style>
              <div title="Sincronizando datos..." style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid var(--brand-200)', borderTopColor: 'var(--brand-500)',
                  animation: 'topbar-spin 0.7s linear infinite',
                }} />
              </div>
            </>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            style={{
              width: 34, height: 34,
              background: 'transparent',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--fg-3)',
              transition: 'background 150ms, color 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-100)'; e.currentTarget.style.color = 'var(--fg-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-3)' }}
          >
            {darkMode
              ? <Sun  size={15} strokeWidth={1.75} />
              : <Moon size={15} strokeWidth={1.75} />
            }
          </button>

          {/* User dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(d => !d)}
              style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 8,
                padding: isMobile ? 4 : '4px 8px 4px 4px',
                background: dropdownOpen ? 'var(--neutral-100)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', color: 'var(--fg-2)',
                transition: 'background 150ms', fontFamily: 'var(--font-sans)',
              }}
            >
              <Avatar name={nombre} size={32} />
              {!isMobile && (
                <>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', color: 'var(--fg-1)' }}>
                      {nombre}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.2 }}>
                      {rolNombre}{empresaNombre && !esEmpresaScope ? ` · ${empresaNombre}` : ''}
                    </div>
                  </div>
                  <ChevronDown
                    size={14} strokeWidth={1.75} color="var(--fg-3)"
                    style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
                  />
                </>
              )}
            </button>

            {dropdownOpen && (
              <>
                <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  width: 220, background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border-default)', overflow: 'hidden', zIndex: 50,
                }}>
                  <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg-1)' }}>{nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                      {rolNombre}{empresaNombre ? ` · ${empresaNombre}` : ''}
                    </div>
                  </div>
                  <div style={{ padding: '4px 0' }}>
                    <DropdownItem
                      icon={User} label="Mi perfil"
                      onClick={() => { setDropdownOpen(false); onNav?.('perfil') }}
                    />
                    <DropdownItem
                      icon={Settings} label="Configuración"
                      onClick={() => { setDropdownOpen(false); onNav?.('configuracion') }}
                    />
                    {esSuperadmin && (
                      <DropdownItem
                        icon={Database} label="Estado de BD"
                        onClick={() => { setDropdownOpen(false); onSettingsSheets?.() }}
                      />
                    )}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />
                    <DropdownItem
                      icon={LogOut} label="Cerrar sesión" danger
                      onClick={() => { setDropdownOpen(false); onLogout?.() }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
  )
}
