import { useState, useMemo, useCallback } from 'react'
import {
  Upload, Download, Trash2, FileText, FilePlus,
  CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import Button     from '../../components/atoms/Button'
import Badge      from '../../components/atoms/Badge'
import { useApp } from '../../context/AppContext'
import { descargarPlantillaDocx, eliminarArchivoPlantilla } from '../../services/supabase'
import ModalSubirPlantilla from './ModalSubirPlantilla'

const PAGE_SIZE = 10

function fmtFecha(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(iso))
  } catch { return iso }
}

function tipoBadge(p) {
  const map = { 'Aprobación': 'success', 'Asistencia': 'brand', 'Participación': 'neutral' }
  return <Badge variant={map[p.tipo] ?? 'neutral'} dot={false}>{p.tipo}</Badge>
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null
  const isError = toast.type === 'error'
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      background: isError ? 'var(--danger-500)' : 'var(--success-500)',
      color: '#fff', borderRadius: 'var(--radius-md)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--shadow-lg)', fontSize: 13, fontWeight: 500,
    }}>
      <CheckCircle2 size={16} strokeWidth={2} />
      {toast.msg}
    </div>
  )
}

// ── Modal confirmación eliminar ───────────────────────────────────────────────

function ModalConfirmar({ plantilla, cursoCount, onConfirm, onClose, loading }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        padding: 32, display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: cursoCount > 0 ? 'var(--warning-50)' : 'var(--danger-50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={22}
              style={{ color: cursoCount > 0 ? 'var(--warning-500)' : 'var(--danger-500)' }}
              strokeWidth={2} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-1)', margin: '0 0 8px' }}>
              {cursoCount > 0 ? 'Plantilla en uso' : 'Eliminar plantilla'}
            </h3>
            {cursoCount > 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, margin: 0 }}>
                Esta plantilla está asignada a <strong>{cursoCount} curso{cursoCount > 1 ? 's' : ''}</strong>.
                Desasígnala en <strong>Gestión de Cursos</strong> antes de eliminar.
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, margin: 0 }}>
                ¿Eliminar la plantilla <strong>«{plantilla.nombre}»</strong>?
                Esta acción no se puede deshacer.
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
          {cursoCount === 0 && (
            <Button variant="danger" size="sm" loading={loading} onClick={onConfirm}>
              Eliminar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tabla inline ──────────────────────────────────────────────────────────────

function TablaPaginated({ rows, onDescargar, onEliminar }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pagina = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const TH = ({ children, width, align = 'left' }) => (
    <th style={{
      padding: '10px 14px', fontSize: 11, fontWeight: 700,
      color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.07em',
      textAlign: align, width, background: 'var(--neutral-50)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>{children}</th>
  )

  const TD = ({ children, style }) => (
    <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle', ...style }}>
      {children}
    </td>
  )

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <TH>Nombre</TH>
              <TH width="140px">Tipo</TH>
              <TH>Archivo</TH>
              <TH width="110px">Fecha</TH>
              <TH width="116px" align="right"></TH>
            </tr>
          </thead>
          <tbody>
            {pagina.map(p => (
              <tr key={p.id} style={{ background: 'var(--bg-surface)', transition: 'background 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-50)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
              >
                <TD>
                  <span style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 14 }}>{p.nombre}</span>
                  {p.descripcion && (
                    <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{p.descripcion}</div>
                  )}
                </TD>
                <TD>{tipoBadge(p)}</TD>
                <TD>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-2)' }}>
                    <FileText size={14} style={{ color: 'var(--fg-3)', flexShrink: 0 }} strokeWidth={1.75} />
                    {p.nombreArchivo || '—'}
                  </span>
                </TD>
                <TD style={{ fontSize: 13, color: 'var(--fg-3)' }}>{fmtFecha(p.creadoEn)}</TD>
                <TD>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button title="Descargar" onClick={() => onDescargar(p)} style={{
                      width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-md)',
                      background: 'var(--neutral-100)', color: 'var(--fg-2)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Download size={14} strokeWidth={2} />
                    </button>
                    <button title="Eliminar" onClick={() => onEliminar(p)} style={{
                      width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-md)',
                      background: 'var(--danger-50)', color: 'var(--danger-500)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {rows.length} plantillas — Página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{
              width: 28, height: 28, border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', cursor: page === 1 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: page === 1 ? 'var(--fg-4)' : 'var(--fg-2)',
            }}>
              <ChevronLeft size={14} strokeWidth={2} />
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{
              width: 28, height: 28, border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', cursor: page === totalPages ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: page === totalPages ? 'var(--fg-4)' : 'var(--fg-2)',
            }}>
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Panel de placeholders ─────────────────────────────────────────────────────

const GRUPOS_CERT = [
  {
    titulo: 'CURSO',
    color: 'var(--brand-600)', bg: 'var(--brand-50)', border: 'var(--brand-200)',
    items: [
      ['{curso_nombre}',          'Nombre del curso'],
      ['{curso_codigo_sence}',    'Código SENCE'],
      ['{curso_horas}',           'Horas de duración'],
      ['{curso_modalidad}',       'Modalidad: Presencial / Híbrido / Online'],
      ['{curso_condicion}',       'Condición: Teórico-Práctico / E-Learning, etc.'],
      ['{curso_fecha_inicio}',    '"14 de enero de 2026"'],
      ['{curso_fecha_termino}',   '"18 de enero de 2026"'],
      ['{curso_lugar_ejecucion}', 'Ciudad / lugar de ejecución'],
      ['{curso_vigencia}',        'Validez: "12 meses" ó "2 años"'],
      ['{curso_contenidos}',      'Contenidos / temario del curso'],
      ['{fecha_emision}',         'Fecha de generación del certificado'],
      ['{codigo_certificado}',    'Código único del certificado (CERT-2026-XXXX-0000)'],
      ['{folio}',                 'Folio del lote (CERT-2026-0001)'],
    ],
  },
  {
    titulo: 'PARTICIPANTE',
    color: 'var(--success-700)', bg: 'var(--success-50)', border: 'var(--success-200)',
    items: [
      ['{alumno_nombre_completo}', 'Nombre completo'],
      ['{alumno_rut}',             'RUT (15.678.432-8)'],
      ['{alumno_empresa}',         'Empresa del participante'],
      ['{alumno_cargo}',           'Cargo'],
      ['{nota_final}',             'Nota con coma decimal (6,5)'],
      ['{porcentaje_asistencia}',  'Porcentaje de asistencia (95%)'],
      ['{resultado}',              'APROBADO / REPROBADO'],
    ],
  },
]

function PanelPlaceholders() {
  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
          Códigos disponibles para tu plantilla Word
        </h3>
        <span style={{
          fontSize: 12, background: 'var(--warning-50)', color: 'var(--warning-700)',
          border: '1px solid var(--warning-200)', borderRadius: 'var(--radius-md)',
          padding: '4px 10px', fontWeight: 500, whiteSpace: 'nowrap',
        }}>
          Usa una sola llave: {'{codigo}'} — no doble {'{{codigo}}'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {GRUPOS_CERT.map(g => (
          <div key={g.titulo} style={{ flex: '1 1 260px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: g.color, letterSpacing: '0.1em', marginBottom: 10 }}>
              {g.titulo}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.items.map(([code, desc]) => (
                <div key={code} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <code style={{
                    fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    background: g.bg, color: g.color,
                    border: `1px solid ${g.border}`,
                    borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {code}
                  </code>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
        Si un código no se reconoce, el sistema lo reemplaza por texto vacío sin interrumpir la generación.
      </p>
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function Plantillas() {
  const { plantillas, eliminarPlantilla, cursos } = useApp()

  const [modalSubir,   setModalSubir]   = useState(false)
  const [confirmar,    setConfirmar]    = useState(null)
  const [eliminando,   setEliminando]   = useState(false)
  const [toast,        setToast]        = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const filas = useMemo(() =>
    plantillas.filter(p => p.categoria === 'certificado' || !p.categoria),
    [plantillas]
  )

  const handleDescargar = async (plantilla) => {
    try {
      const blob = await descargarPlantillaDocx(plantilla.storagePath)
      saveAs(blob, plantilla.nombreArchivo || `${plantilla.nombre}.docx`)
    } catch (err) {
      showToast(`Error al descargar: ${err.message}`, 'error')
    }
  }

  const handleEliminar = (plantilla) => {
    const usada = (cursos ?? []).filter(c => c.plantillaId === plantilla.id).length
    setConfirmar({ plantilla, cursoCount: usada })
  }

  const confirmarEliminar = async () => {
    if (!confirmar) return
    setEliminando(true)
    try {
      await eliminarArchivoPlantilla(confirmar.plantilla.storagePath)
      await eliminarPlantilla(confirmar.plantilla.id)
      showToast('Plantilla eliminada')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setEliminando(false)
      setConfirmar(null)
    }
  }

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Plantillas</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '4px 0 0' }}>
            Gestiona las plantillas Word para la generación de certificados.
          </p>
        </div>
        <Button variant="primary" size="md" icon={Upload} onClick={() => setModalSubir(true)}>
          Subir Plantilla
        </Button>
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        {filas.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            padding: '64px 24px',
          }}>
            <FilePlus size={44} strokeWidth={1.25} style={{ color: 'var(--neutral-300)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>
                No hay plantillas de certificado
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                Sube un archivo Word (.docx) para comenzar.
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => setModalSubir(true)}>
              Subir Plantilla
            </Button>
          </div>
        ) : (
          <TablaPaginated
            rows={filas}
            onDescargar={handleDescargar}
            onEliminar={handleEliminar}
          />
        )}
      </div>

      {/* Panel de códigos */}
      <PanelPlaceholders />

      {/* Modales */}
      {modalSubir && (
        <ModalSubirPlantilla
          onClose={() => setModalSubir(false)}
          showToast={showToast}
        />
      )}
      {confirmar && (
        <ModalConfirmar
          plantilla={confirmar.plantilla}
          cursoCount={confirmar.cursoCount}
          onConfirm={confirmarEliminar}
          onClose={() => setConfirmar(null)}
          loading={eliminando}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
