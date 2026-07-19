// Pantalla de configuración: preferencias del usuario guardadas en localStorage.
// No afecta la BD, solo cambia el comportamiento de la UI en este navegador.
import { useState, useContext } from 'react'
import { Shield, Monitor, CheckCircle2, Database, Download, AlertTriangle, Clock, Table2, Award, Bell } from 'lucide-react'
import Toggle from '../../components/Toggle'
import { AppContext, useApp } from '../../context/AppContext'
import { descargarBackup, getUltimoBackup } from '../../services/backupService'

const CONFIG_KEY = 'otec_demo_config'

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveConfig(cfg) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
}

const DEFAULTS = {
  confirmarEliminar:         true,
  confirmarCerrarSesion:     false,
  mostrarBreadcrumb:         true,
  sidebarCompacto:           false,
  reducirAnimaciones:        false,
  filasPorPagina:            10,
  mostrarIndiceTabla:        false,
  pdfNuevaPestana:           true,
  mostrarPreviaCertificado:  false,
  notifVencimiento:          true,
  notifActividadReciente:    true,
}

/* Elimina el borde inferior del último hijo visible sin necesitar prop `last` */
const SECTION_STYLE = `[data-cfg-body]>*:last-child{border-bottom:none!important}`

function Section({ icon: Icon, title, description, children }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      <style>{SECTION_STYLE}</style>
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'var(--brand-50)',
          display: 'grid', placeItems: 'center', color: 'var(--brand-600)', flexShrink: 0,
        }}>
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)' }}>{title}</div>
          {description && <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 1 }}>{description}</div>}
        </div>
      </div>
      <div data-cfg-body="" style={{ padding: '4px 0' }}>
        {children}
      </div>
    </div>
  )
}

function ToggleRow({ label, description, value, onChange }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', gap: 24,
        background: hovered ? 'var(--neutral-50)' : 'transparent',
        cursor: 'default', transition: 'background 120ms',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  )
}

function SelectRow({ label, description, value, onChange, options }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', gap: 24,
        background: hovered ? 'var(--neutral-50)' : 'transparent',
        transition: 'background 120ms',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          padding: '6px 10px', borderRadius: 'var(--radius-md)', fontSize: 13,
          border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
          color: 'var(--fg-1)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function formatFechaBackup(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default function ConfiguracionScreen() {
  const stored = loadConfig()
  const [cfg, setCfg] = useState({ ...DEFAULTS, ...stored })
  const [saved, setSaved] = useState(false)

  const { sesion } = useApp()
  const p            = sesion?.rol?.permisos ?? {}
  const esSuperadmin = sesion?.rol?.id === 'superadmin'

  /*
   * Visibilidad de opciones según permisos
   *
   * Superadmin : verEmision=T, emitirCertificados=T, eliminarEmpresa=T,
   *              crearPersona=T, gestionarUsuarios=T
   * Operador   : verEmision=T, emitirCertificados=T, crearPersona=F, eliminarEmpresa=F
   * Empresa    : verEmision=T, emitirCertificados=F, crearPersona=T, eliminarEmpresa=F
   */
  const puedeEmitir      = !!p.emitirCertificados
  const puedeVerEmision  = !!p.verEmision
  const puedeEliminar    = !!(p.eliminarEmpresa || p.crearPersona || p.crearCurso || p.gestionarUsuarios)
  const puedeGestionar   = !!p.gestionarUsuarios

  const mostrarCertificados   = puedeVerEmision
  const mostrarNotificaciones = puedeVerEmision || puedeGestionar

  const { backupPendiente, setBackupPendiente } = useContext(AppContext) || {}
  const [ultimoBackup, setUltimoBackup] = useState(getUltimoBackup)
  const [descargando, setDescargando]   = useState(false)
  const [backupOk, setBackupOk]         = useState(null)

  const handleDescargarBackup = async () => {
    setDescargando(true)
    setBackupOk(null)
    try {
      const resultado = await descargarBackup()
      setBackupOk(resultado.ok)
      setUltimoBackup(getUltimoBackup())
      if (setBackupPendiente) setBackupPendiente(false)
    } finally {
      setDescargando(false)
    }
  }

  const update = (key, val) => {
    const next = { ...cfg, [key]: val }
    setCfg(next)
    saveConfig(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 780 }}>

      {saved && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: 13,
          background: 'var(--success-50)', color: 'var(--success-600)',
          border: '1px solid var(--success-400)',
        }}>
          <CheckCircle2 size={15} strokeWidth={2} />
          Preferencias guardadas automáticamente
        </div>
      )}

      {/* ── Apariencia — visible para todos ── */}
      <Section
        icon={Monitor}
        title="Apariencia e interfaz"
        description="Personaliza cómo se ve el panel administrativo"
      >
        <ToggleRow
          label="Sidebar compacto por defecto"
          description="El menú lateral se abrirá colapsado al iniciar sesión"
          value={cfg.sidebarCompacto}
          onChange={v => update('sidebarCompacto', v)}
        />
        <ToggleRow
          label="Mostrar breadcrumb en topbar"
          description="Muestra la ruta de navegación sobre el título de cada sección"
          value={cfg.mostrarBreadcrumb}
          onChange={v => update('mostrarBreadcrumb', v)}
        />
        <ToggleRow
          label="Reducir animaciones de transición"
          description="Desactiva las animaciones de apertura de modales y cambios de pantalla"
          value={cfg.reducirAnimaciones}
          onChange={v => update('reducirAnimaciones', v)}
        />
      </Section>

      {/* ── Tablas y datos — visible para todos ── */}
      <Section
        icon={Table2}
        title="Tablas y datos"
        description="Preferencias de visualización de listados y exportaciones"
      >
        <SelectRow
          label="Filas por página"
          description="Cantidad de registros mostrados por defecto en todas las tablas"
          value={cfg.filasPorPagina}
          onChange={v => update('filasPorPagina', v)}
          options={[
            { value: 10,  label: '10 filas' },
            { value: 25,  label: '25 filas' },
            { value: 50,  label: '50 filas' },
            { value: 100, label: '100 filas' },
          ]}
        />
        <ToggleRow
          label="Mostrar número de índice en tablas"
          description="Agrega una columna con el número correlativo de cada fila"
          value={cfg.mostrarIndiceTabla}
          onChange={v => update('mostrarIndiceTabla', v)}
        />
      </Section>

      {/* ── Certificados — solo quienes pueden ver emisión ── */}
      {mostrarCertificados && (
        <Section
          icon={Award}
          title="Certificados"
          description="Comportamiento al generar y descargar certificados"
        >
          <ToggleRow
            label="Abrir PDF en nueva pestaña"
            description="Al generar un certificado, lo abre en el navegador en lugar de descargarlo directamente"
            value={cfg.pdfNuevaPestana}
            onChange={v => update('pdfNuevaPestana', v)}
          />
          {/* Vista previa solo para quienes pueden emitir (superadmin, operador) */}
          {puedeEmitir && (
            <ToggleRow
              label="Mostrar vista previa antes de descargar"
              description="Permite revisar el certificado antes de confirmar la descarga o emisión masiva"
              value={cfg.mostrarPreviaCertificado}
              onChange={v => update('mostrarPreviaCertificado', v)}
            />
          )}
        </Section>
      )}

      {/* ── Notificaciones — quienes ven emisión o gestionan usuarios ── */}
      {mostrarNotificaciones && (
        <Section
          icon={Bell}
          title="Notificaciones y alertas"
          description="Controla qué avisos se muestran dentro del sistema"
        >
          {/* Alertas de vencimiento: quienes pueden ver emisión */}
          {puedeVerEmision && (
            <ToggleRow
              label="Alertas de vencimiento de certificados"
              description="Muestra avisos en el dashboard cuando hay certificados próximos a vencer"
              value={cfg.notifVencimiento}
              onChange={v => update('notifVencimiento', v)}
            />
          )}
          {/* Actividad reciente: solo superadmin (único que ve el historial global) */}
          {puedeGestionar && (
            <ToggleRow
              label="Mostrar actividad reciente en dashboard"
              description="Muestra el historial de emisiones y registros recientes en la pantalla principal"
              value={cfg.notifActividadReciente}
              onChange={v => update('notifActividadReciente', v)}
            />
          )}
        </Section>
      )}

      {/* ── Seguridad — visible para todos ── */}
      <Section
        icon={Shield}
        title="Seguridad"
        description="Configuración de acciones con confirmación"
      >
        {/* Confirmar eliminar: solo roles que pueden borrar o crear registros */}
        {puedeEliminar && (
          <ToggleRow
            label="Confirmar antes de eliminar registros"
            description="Muestra un diálogo de confirmación al eliminar empresas, personas u otros datos"
            value={cfg.confirmarEliminar}
            onChange={v => update('confirmarEliminar', v)}
          />
        )}
        <ToggleRow
          label="Confirmar al cerrar sesión"
          description="Solicita confirmación antes de cerrar la sesión activa"
          value={cfg.confirmarCerrarSesion}
          onChange={v => update('confirmarCerrarSesion', v)}
        />
      </Section>

      {/* ── Base de datos — solo superadmin ── */}
      {esSuperadmin && (
        <Section
          icon={Database}
          title="Base de datos y respaldos"
          description="Gestión de respaldos de seguridad del sistema"
        >
          {backupPendiente && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              margin: '12px 24px', padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--warning-50)', color: 'var(--warning-600)',
              border: '1px solid var(--warning-400)', fontSize: 13,
            }}>
              <AlertTriangle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
              Han pasado más de 24 horas desde el último respaldo. Se recomienda descargar uno ahora.
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} strokeWidth={1.75} style={{ color: 'var(--fg-3)' }} />
              <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>Último respaldo</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>
              {formatFechaBackup(ultimoBackup)}
            </span>
          </div>

          {backupOk === true && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              margin: '8px 24px', padding: '8px 12px',
              borderRadius: 'var(--radius-md)', fontSize: 13,
              background: 'var(--success-50)', color: 'var(--success-600)',
              border: '1px solid var(--success-400)',
            }}>
              <CheckCircle2 size={14} strokeWidth={2} />
              Respaldo descargado exitosamente
            </div>
          )}
          {backupOk === false && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              margin: '8px 24px', padding: '8px 12px',
              borderRadius: 'var(--radius-md)', fontSize: 13,
              background: 'var(--danger-50)', color: 'var(--danger-600)',
              border: '1px solid var(--danger-400)',
            }}>
              <AlertTriangle size={14} strokeWidth={2} />
              Algunas tablas no pudieron exportarse. Verifica tu conexión.
            </div>
          )}

          <div style={{ padding: '12px 24px' }}>
            <button
              onClick={handleDescargarBackup}
              disabled={descargando}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--brand-200)',
                background: descargando ? 'var(--neutral-100)' : 'var(--brand-50)',
                color: descargando ? 'var(--fg-3)' : 'var(--brand-600)',
                fontSize: 13, fontWeight: 600, cursor: descargando ? 'not-allowed' : 'pointer',
                transition: 'all 120ms',
              }}
            >
              <Download size={14} strokeWidth={2} />
              {descargando ? 'Exportando…' : 'Descargar respaldo ahora'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--fg-4)', margin: '8px 0 0' }}>
              Exporta todas las tablas (empresas, personas, certificados, cursos, plantillas, usuarios) como archivo JSON.
            </p>
          </div>
        </Section>
      )}

    </div>
  )
}
