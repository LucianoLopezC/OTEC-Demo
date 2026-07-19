import { useState } from 'react'
import { CheckCircle2, XCircle, RefreshCw, Database, ChevronLeft } from 'lucide-react'
import Button from '../components/atoms/Button'
import { useApp } from '../context/AppContext'

function fmtSync(timestamp) {
  if (!timestamp) return 'Nunca'
  const d = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'hace menos de 1 min'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  return d.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' })
}

function EstadoChip({ ok }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: ok ? 'var(--success-50)' : 'var(--danger-50)',
      color: ok ? 'var(--success-600)' : 'var(--danger-600)',
      border: `1px solid ${ok ? 'var(--success-200)' : 'var(--danger-200)'}`,
    }}>
      {ok
        ? <CheckCircle2 size={13} strokeWidth={2} />
        : <XCircle size={13} strokeWidth={2} />
      }
      {ok ? 'Conectado' : 'Error'}
    </div>
  )
}

// Diagnóstico de la conexión a la API PHP y estado de cada tabla.
// Solo accesible para superadmin desde el menú de usuario en el topbar.
export default function SettingsSheets({ onBack }) {
  const {
    dbEmpresas, dbPersonas, dbCertificados, dbCursos, dbUsuarios, dbPlantillas,
    empresas, personas, certificados, cursos, usuarios, plantillas,
    refrescarTodo, sincronizando,
  } = useApp()

  const [testResult, setTestResult] = useState(null)

  const tablas = [
    { nombre: 'Empresas',     hook: dbEmpresas,     datos: empresas     },
    { nombre: 'Personas',     hook: dbPersonas,     datos: personas     },
    { nombre: 'Certificados', hook: dbCertificados, datos: certificados },
    { nombre: 'Cursos',       hook: dbCursos,       datos: cursos       },
    { nombre: 'Usuarios',     hook: dbUsuarios,     datos: usuarios     },
    { nombre: 'Plantillas',   hook: dbPlantillas,   datos: plantillas   },
  ]

  const hayError     = tablas.some(t => t.hook?.error)
  const algoCargando = tablas.some(t => t.hook?.cargando)

  const handleTest = async () => {
    setTestResult(null)
    try {
      await dbUsuarios.refrescar()
      setTestResult({ ok: true, msg: `Conexión exitosa — ${usuarios.length} usuarios encontrados` })
    } catch (err) {
      setTestResult({ ok: false, msg: err.message })
    }
  }

  const card = {
    background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)', padding: '24px 28px',
  }

  const TH = {
    padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--neutral-50)',
    borderBottom: '1px solid var(--border-default)', textAlign: 'left',
  }
  const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--fg-2)', borderTop: '1px solid var(--border-subtle)' }

  const apiUrl = import.meta.env.VITE_API_URL || '(no configurado)'

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg-3)', fontSize: 13, fontFamily: 'var(--font-sans)',
          }}
        >
          <ChevronLeft size={16} strokeWidth={1.75} /> Volver
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 2 }}>
            Estado de la base de datos
          </h2>
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            Conexión y diagnóstico de la API PHP
          </p>
        </div>
      </div>

      {/* Sección 1: Estado de conexión */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--brand-50)',
              display: 'grid', placeItems: 'center', color: 'var(--brand-600)',
            }}>
              <Database size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>API PHP + MySQL</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {apiUrl}
              </div>
            </div>
          </div>
          <EstadoChip ok={!hayError && !algoCargando} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            variant="secondary" size="sm" icon={RefreshCw}
            onClick={handleTest}
          >
            Probar conexión
          </Button>
          <Button
            variant="ghost" size="sm" icon={RefreshCw}
            onClick={refrescarTodo} disabled={sincronizando}
          >
            {sincronizando ? 'Sincronizando...' : 'Sincronizar todo'}
          </Button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: testResult.ok ? 'var(--success-50)' : 'var(--danger-50)',
            color: testResult.ok ? 'var(--success-700)' : 'var(--danger-600)',
            border: `1px solid ${testResult.ok ? 'var(--success-200)' : 'var(--danger-200)'}`,
          }}>
            {testResult.msg}
          </div>
        )}
      </div>

      {/* Sección 2: Estado de las tablas */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 12px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Estado de las tablas</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Tabla</th>
              <th style={{ ...TH, textAlign: 'center' }}>Registros</th>
              <th style={TH}>Última carga</th>
              <th style={TH}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {tablas.map(({ nombre, hook, datos }) => (
              <tr key={nombre}>
                <td style={{ ...TD, fontWeight: 500, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {nombre.toLowerCase()}
                </td>
                <td style={{ ...TD, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  {hook?.cargando ? '…' : datos.length}
                </td>
                <td style={{ ...TD, color: 'var(--fg-3)', fontSize: 12 }}>
                  {fmtSync(hook?.ultimaSync)}
                </td>
                <td style={TD}>
                  {hook?.cargando
                    ? <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Cargando...</span>
                    : hook?.error
                    ? <span style={{ fontSize: 12, color: 'var(--danger-500)' }}>✕ {hook.error}</span>
                    : <span style={{ fontSize: 12, color: 'var(--success-600)', fontWeight: 500 }}>✓ OK</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
