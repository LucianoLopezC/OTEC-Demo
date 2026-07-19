import { useState, lazy, Suspense, useEffect } from 'react'
import { brand } from './config/brand'
import Sidebar    from './components/layout/Sidebar'
import Topbar     from './components/layout/Topbar'
import LoginScreen from './screens/LoginScreen'
import Dashboard   from './screens/Dashboard'
import Empresas    from './screens/Empresas/index'
import Verify      from './screens/Verify'
import Placeholder from './screens/Placeholder'
import AccesoDenegado from './components/AccesoDenegado'
import { useApp } from './context/AppContext'
import { useResponsive } from './hooks/useResponsive'

// Las pantallas con librerías pesadas (jsPDF, xlsx, recharts) se cargan de forma lazy
// para que el bundle inicial sea más liviano y el login no tenga que esperar todo eso.
const EmisionCertificados      = lazy(() => import('./screens/EmisionCertificados/index'))
const Personas                 = lazy(() => import('./screens/Personas/index'))
const ReportesBI               = lazy(() => import('./screens/ReportesBI/index'))
const UsuariosRoles            = lazy(() => import('./screens/UsuariosRoles/index'))
const GestionCursos            = lazy(() => import('./screens/GestionCursos/index'))
const Plantillas               = lazy(() => import('./screens/Plantillas/index'))
const GestionLotesCertificados = lazy(() => import('./screens/GestionLotesCertificados/index'))
const SettingsSheets           = lazy(() => import('./screens/SettingsSheets'))
const PerfilScreen             = lazy(() => import('./screens/Perfil/index'))
const ConfiguracionScreen      = lazy(() => import('./screens/Configuracion/index'))
const Cotizador                = lazy(() => import('./screens/Cotizador/index'))

function ScreenFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: 'var(--fg-4)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid var(--brand-200)', borderTopColor: 'var(--brand-500)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Titles y subtítulos para el Topbar de cada pantalla.
const SCREEN_META = {
  dashboard:    { label: 'Dashboard',                    subtitle: 'Vista general del sistema' },
  empresas:     { label: 'Empresas',                     subtitle: 'Gestión de empresas y organizaciones' },
  personas:     { label: 'Personas',                     subtitle: 'Participantes registrados y certificados emitidos' },
  usuarios:     { label: 'Usuarios y Roles',             subtitle: 'Gestión de accesos y permisos del sistema' },
  emision:      { label: 'Emisión de Certificados',      subtitle: 'Generación y emisión de certificados de capacitación' },
  verify:       { label: 'Verificar Certificado',        subtitle: null },
  reportes:     { label: 'Reportes BI',                  subtitle: 'Análisis de certificados, empresas y personas' },
  gestionCursos:{ label: 'Gestión de Cursos',            subtitle: 'Administración del catálogo de cursos de capacitación' },
  plantillas:           { label: 'Plantillas de Certificado', subtitle: 'Gestión de plantillas Word para emisión de certificados' },
  lotesCertificados:    { label: 'Lotes de Certificados',     subtitle: 'Historial de emisiones y trazabilidad por folio' },
  perfil:       { label: 'Mi perfil',                    subtitle: 'Información de tu cuenta y seguridad' },
  configuracion:{ label: 'Configuración',                subtitle: 'Preferencias y opciones del sistema' },
  cotizador:    { label: 'Cotizador de Cursos',         subtitle: 'Generación de cotizaciones en PDF para empresas' },
}

// Mapa de pantalla → permiso requerido para acceder. Si el rol no tiene el permiso,
// MainContent renderiza AccesoDenegado en lugar de la pantalla.
const PERMISOS_POR_SCREEN = {
  dashboard:    'verDashboard',
  empresas:     'verEmpresas',
  personas:     'verPersonas',
  usuarios:     'verUsuarios',
  emision:      'verEmision',
  verify:       'verVerificar',
  reportes:     'verReportes',
  gestionCursos:'verCursos',
  plantillas:          'verPlantillas',
  lotesCertificados:   'verPlantillas',
  cotizador:    'verCotizador',
}

function MainContent({ screen, onNav, sesion }) {
  const permiso = PERMISOS_POR_SCREEN[screen]

  if (permiso && sesion?.rol?.permisos?.[permiso] !== true) {
    return <AccesoDenegado seccion={SCREEN_META[screen]?.label ?? screen} />
  }

  switch (screen) {
    case 'dashboard':     return <Dashboard  onNav={onNav} />
    case 'empresas':      return <Empresas   onNav={onNav} />
    case 'cursos':
    case 'emision':       return <EmisionCertificados onNav={onNav} />
    case 'personas':      return <Personas />
    case 'verify':        return <Verify />
    case 'reportes':      return <ReportesBI />
    case 'usuarios':      return <UsuariosRoles />
    case 'gestionCursos': return <GestionCursos onNav={onNav} />
    case 'plantillas':         return <Plantillas onNav={onNav} />
    case 'lotesCertificados':  return <GestionLotesCertificados onNav={onNav} />
    case 'perfil':        return <PerfilScreen />
    case 'configuracion': return <ConfiguracionScreen />
    case 'cotizador':     return <Cotizador />
    default:              return <Placeholder screen={screen} />
  }
}

function loadDemoConfig() {
  try { return JSON.parse(localStorage.getItem('otec_demo_config') || '{}') } catch { return {} }
}

export default function App() {
  const { sesion, cerrarSesion, cargandoSesion, sincronizando } = useApp()
  const { isMobile } = useResponsive()

  // Si la URL tiene ?codigo=X se va directo a verificación, incluso sin sesión.
  // Si no, se restaura la última pantalla visitada desde localStorage.
  const [screen,         setScreen]         = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('codigo')) return 'verify'
    const esRecarga = performance.getEntriesByType('navigation')[0]?.type === 'reload'
    return esRecarga ? (loadDemoConfig().lastScreen ?? 'dashboard') : 'dashboard'
  })
  const [collapsed,      setCollapsed]      = useState(() => loadDemoConfig().sidebarCompacto ?? false)
  const [settingsSheets, setSettingsSheets] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode,       setDarkMode]       = useState(() => {
    const isDark = loadDemoConfig().darkMode ?? false
    document.documentElement.classList.toggle('dark', isDark)
    return isDark
  })

  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false)
  }, [isMobile])

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      try {
        const cfg = JSON.parse(localStorage.getItem('otec_demo_config') || '{}')
        localStorage.setItem('otec_demo_config', JSON.stringify({ ...cfg, darkMode: next }))
      } catch {}
      return next
    })
  }

  /* Spinner mientras se verifica la sesión activa */
  if (cargandoSesion) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-app)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid var(--brand-200)', borderTopColor: 'var(--brand-600)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!sesion) {
    const params = new URLSearchParams(window.location.search)
    if (params.get('codigo')) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
          <div style={{
            padding: '12px 24px', background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--brand-600)', letterSpacing: '-0.02em' }}>
              ·{brand.name.toLowerCase()}· capacitación
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Verificación de Certificados</span>
          </div>
          <Verify />
        </div>
      )
    }
    return <LoginScreen />
  }

  const meta       = SCREEN_META[screen] ?? SCREEN_META.dashboard
  const cfg        = loadDemoConfig()
  const breadcrumb = (cfg.mostrarBreadcrumb !== false) && screen !== 'dashboard' ? ['Panel', meta.label] : []

  const handleLogout = () => {
    cerrarSesion()
    setScreen('dashboard')
    try {
      const cfg = JSON.parse(localStorage.getItem('otec_demo_config') || '{}')
      delete cfg.lastScreen
      localStorage.setItem('otec_demo_config', JSON.stringify(cfg))
    } catch {}
  }

  const handleNav = (s) => {
    setSettingsSheets(false)
    setScreen(s)
    try {
      const cfg = JSON.parse(localStorage.getItem('otec_demo_config') || '{}')
      localStorage.setItem('otec_demo_config', JSON.stringify({ ...cfg, lastScreen: s }))
    } catch {}
    if (isMobile) setMobileMenuOpen(false)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)' }}>
      <Sidebar
        active={screen}
        onNav={handleNav}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Topbar
          title={settingsSheets ? 'Estado de la base de datos' : meta.label}
          subtitle={settingsSheets ? 'Diagnóstico de la API y base de datos' : meta.subtitle}
          breadcrumb={settingsSheets ? ['Panel', 'Base de datos'] : breadcrumb}
          onLogout={handleLogout}
          onSettingsSheets={() => setSettingsSheets(true)}
          onNav={handleNav}
          darkMode={darkMode}
          onToggleDark={toggleDarkMode}
          sincronizando={sincronizando}
          isMobile={isMobile}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
        />
        <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-app)' }}>
          <Suspense fallback={<ScreenFallback />}>
            {settingsSheets
              ? <SettingsSheets onBack={() => setSettingsSheets(false)} />
              : <MainContent screen={screen} onNav={handleNav} sesion={sesion} />
            }
          </Suspense>
        </main>
      </div>
    </div>
  )
}
