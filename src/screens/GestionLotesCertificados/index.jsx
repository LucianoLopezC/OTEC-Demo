// Historial de lotes de certificados: cada lote corresponde a una emisión completa.
// Los PDFs se generan al vuelo desde los datos almacenados, sin archivos ZIP guardados.
import { useState, useMemo, useCallback, useEffect } from 'react'
import { fmtFechaHora as _fmtFechaHora, ahoraChile } from '../../utils/fecha'
import {
  Archive, Download, Eye, ChevronLeft, ChevronRight,
  CheckCircle2, X as XIcon, Loader2, Search, Pencil, Trash2,
} from 'lucide-react'
import { saveAs }    from 'file-saver'
import Badge         from '../../components/atoms/Badge'
import StatCard      from '../../components/atoms/StatCard'
import Button        from '../../components/atoms/Button'
import FiltroFecha   from '../../components/atoms/FiltroFecha'
import { useApp }    from '../../context/AppContext'
import { useConfirm } from '../../context/ConfirmContext'
import { apiFetch }  from '../../services/apiClient'
import { generarPDFPropio }                    from '../EmisionCertificados/generarPDF'
import { crearZipBlob }                        from '../EmisionCertificados/generarZip'
import { nombreArchivoCert }                   from '../EmisionCertificados/utils'

const PAGE_SIZE = 10

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtFechaHora = _fmtFechaHora

function calcVigenciaMeses(fechaEmision, fechaVencimiento, fallback = 12) {
  if (!fechaVencimiento) return 0
  if (!fechaEmision) return fallback
  const diff = new Date(fechaVencimiento) - new Date(fechaEmision)
  return Math.round(diff / (1000 * 60 * 60 * 24 * 30.44))
}

function buildDatosDesde(cert, curso) {
  return {
    datos: {
      cursoNombre:    cert.curso,
      empresaNombre:  cert.empresaNombre,
      fechaEmision:   cert.fechaEmision,
      fechaFinValidez:cert.fechaVencimiento,
      horas:          cert.horas,
      fechaInicio:    cert.fechaInicioCurso,
      fechaTermino:   cert.fechaTerminoCurso,
      lugarEjecucion: cert.lugarEjecucion  || '',
      condicion:      cert.condicion       || '',
      codigoSence:    curso?.codigoSence   || '',
      contenidos:     curso?.contenidos    || '',
      vigenciaMeses:  calcVigenciaMeses(cert.fechaEmision, cert.fechaVencimiento, curso?.vigenciaMeses),
    },
    participante: {
      nombre:     cert.nombre,
      rut:        cert.rut,
      empresa:    cert.empresaNombre,
      cargo:      cert.cargoParticipante || '',
      asistencia: cert.asistencia,
      evaluacion: cert.evaluacion,
      estado:     cert.estado,
    },
  }
}

function tipoBadge(tipo) {
  const map = { 'Aprobación': 'success', 'Asistencia': 'brand', 'Participación': 'neutral' }
  return <Badge variant={map[tipo] ?? 'neutral'} dot={false}>{tipo}</Badge>
}

function mesActual(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const now = ahoraChile()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      background: toast.type === 'error' ? 'var(--danger-500)' : 'var(--success-500)',
      color: '#fff', borderRadius: 'var(--radius-md)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--shadow-lg)', fontSize: 13, fontWeight: 500,
    }}>
      <CheckCircle2 size={16} strokeWidth={2} />
      {toast.msg}
    </div>
  )
}

// ── EstadoPill ─────────────────────────────────────────────────────────────────

const ESTADO_COLOR = {
  Aprobado:  { bg: 'var(--success-50)',  text: 'var(--success-700)', border: 'var(--success-200)' },
  Reprobado: { bg: 'var(--danger-50)',   text: 'var(--danger-600)',  border: 'var(--danger-200)'  },
  Pendiente: { bg: 'var(--neutral-100)', text: 'var(--fg-3)',        border: 'var(--border-subtle)' },
}

function EstadoPill({ estado }) {
  const c = ESTADO_COLOR[estado] ?? ESTADO_COLOR.Pendiente
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11,
      fontWeight: 700, background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {estado}
    </span>
  )
}

// ── ModalEditarCertificado ────────────────────────────────────────────────────

const FIELD_LABEL_STYLE = {
  fontSize: 11, fontWeight: 600, color: 'var(--fg-3)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block',
}
const FIELD_INPUT_STYLE = {
  width: '100%', height: 32, padding: '0 10px', fontSize: 13, color: 'var(--fg-1)',
  background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

function ModalEditarCertificado({ cert, onClose, onGuardar }) {
  const [form, setForm] = useState({
    nombreParticipante: cert.nombreParticipante || cert.nombre || '',
    rutParticipante:    cert.rutParticipante    || cert.rut   || '',
    estado:             cert.estado  || 'Aprobado',
    fechaEmision:       cert.fechaEmision       || '',
    fechaVencimiento:   cert.fechaVencimiento   || '',
    horas:              cert.horas ?? '',
    asistencia:         cert.asistencia ?? '',
    evaluacion:         cert.evaluacion ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const toNum = (v, fb) => { const n = parseFloat(v); return isNaN(n) ? fb : n }
      await onGuardar({
        ...cert,
        ...form,
        horas:      toNum(form.horas,      cert.horas      ?? 0),
        asistencia: toNum(form.asistencia, cert.asistencia ?? 0),
        evaluacion: toNum(form.evaluacion, cert.evaluacion ?? 0),
      })
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const FIELDS = [
    { key: 'nombreParticipante', label: 'Nombre',        type: 'text'   },
    { key: 'rutParticipante',    label: 'RUT',           type: 'text'   },
    { key: 'estado',             label: 'Estado',        type: 'select', options: ['Aprobado','Reprobado'] },
    { key: 'fechaEmision',       label: 'Fecha emisión', type: 'date'   },
    { key: 'fechaVencimiento',   label: 'Válido hasta',  type: 'date'   },
    { key: 'horas',              label: 'Horas',         type: 'number' },
    { key: 'asistencia',         label: 'Asistencia %',  type: 'number' },
    { key: 'evaluacion',         label: 'Evaluación %',  type: 'number' },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.60)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 14, width: '100%', maxWidth: 540,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.24)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Editar certificado</div>
          <button onClick={onClose} disabled={guardando} style={{
            width: 28, height: 28, border: 'none', borderRadius: 6,
            background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <XIcon size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--danger-50)', color: 'var(--danger-600)', fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {FIELDS.map(({ key, label, type, options }) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={FIELD_LABEL_STYLE}>{label}</span>
                  {type === 'select' ? (
                    <select style={FIELD_INPUT_STYLE} value={form[key]} onChange={e => set(key, e.target.value)}>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      style={FIELD_INPUT_STYLE}
                      type={type}
                      min={type === 'number' ? 0 : undefined}
                      max={type === 'number' && (key === 'asistencia' || key === 'evaluacion') ? 100 : undefined}
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          }}>
            <button type="button" onClick={onClose} disabled={guardando} style={{
              height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500,
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              background: 'transparent', cursor: guardando ? 'not-allowed' : 'pointer', color: 'var(--fg-2)',
            }}>Cancelar</button>
            <button type="submit" disabled={guardando} style={{
              height: 32, padding: '0 16px', fontSize: 13, fontWeight: 600,
              border: 'none', borderRadius: 'var(--radius-md)',
              background: 'var(--brand-600)', color: '#fff', cursor: guardando ? 'wait' : 'pointer',
            }}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal detalle de lote ─────────────────────────────────────────────────────

function ModalDetalle({ lote, curso, plantilla, onClose, showToast, onEliminarLote }) {
  const { cursos: todosCursos, editarCertificado, eliminarCertificado } = useApp()
  const confirm = useConfirm()

  const [descargando,  setDescargando]  = useState(null)
  // partes: copia local del snapshot para actualización optimista
  const [partes,       setPartes]       = useState(lote.participantesData ?? [])
  // certsDB: lista completa con IDs desde la API (necesaria para editar/eliminar)
  const [certsDB,      setCertsDB]      = useState(null)
  const [certEditando, setCertEditando] = useState(null)

  // Cargar los certs completos (con id) al abrir el modal
  useEffect(() => {
    if (!lote.folio) return
    apiFetch(`certificados.php?folio=${encodeURIComponent(lote.folio)}`)
      .then(todos => setCertsDB(todos ?? []))
      .catch(() => {})
  }, [lote.folio])

  const aprobados  = partes.filter(p => p.estado === 'Aprobado').length
  const reprobados = partes.filter(p => p.estado === 'Reprobado').length

  const findCert = (p) =>
    certsDB?.find(c => (p.rut && c.rut === p.rut) || c.nombre === p.nombre) ?? null

  const handleDescargarIndividual = async (p) => {
    setDescargando(p.rut || p.nombre)
    try {
      const todos = certsDB ?? await apiFetch(`certificados.php?folio=${encodeURIComponent(lote.folio)}`)
      const cert = (todos ?? []).find(c => c.rut === p.rut || c.nombre === p.nombre)
      if (!cert) { showToast('Certificado no encontrado en la base de datos', 'error'); return }
      const cursoData = todosCursos.find(c => c.id === cert.cursoId)
      const { datos, participante } = buildDatosDesde(cert, cursoData)
      const buffer = await generarPDFPropio(participante, datos, cert.codigoCertificado)
      saveAs(new Blob([buffer], { type: 'application/pdf' }),
             `${nombreArchivoCert(cert.empresaNombre, cert.curso, cert.nombre)}.pdf`)
    } catch (e) {
      showToast(`Error al generar PDF: ${e?.message ?? e}`, 'error')
    } finally {
      setDescargando(null)
    }
  }

  const handleEditar = (p) => {
    const cert = findCert(p)
    if (!cert) { showToast('Cargando datos, intenta en un momento', 'error'); return }
    setCertEditando(cert)
  }

  const handleEliminarCert = async (p) => {
    const cert = findCert(p)
    if (!cert) { showToast('Cargando datos, intenta en un momento', 'error'); return }
    const ok = await confirm(
      `¿Eliminar el certificado de ${p.nombre || p.rut}? Esta acción no se puede deshacer.`,
      { confirmLabel: 'Eliminar' }
    )
    if (!ok) return
    try {
      await eliminarCertificado(cert.id)
      setPartes(prev => prev.filter(x => !(x.rut === p.rut && x.nombre === p.nombre) && x !== p))
      setCertsDB(prev => prev?.filter(c => c.id !== cert.id) ?? null)
      showToast('Certificado eliminado')
    } catch (e) {
      showToast(`Error: ${e?.message ?? e}`, 'error')
    }
  }

  const handleGuardarEdicion = async (certActualizado) => {
    await editarCertificado(certActualizado)
    // Actualización optimista de partes para reflejar cambios en el modal
    setPartes(prev => prev.map(x => {
      const esEste = (x.rut && x.rut === (certActualizado.rutParticipante || certActualizado.rut)) ||
                     x.nombre === (certActualizado.nombreParticipante || certActualizado.nombre)
      if (!esEste) return x
      return {
        ...x,
        nombre:     certActualizado.nombreParticipante || certActualizado.nombre,
        rut:        certActualizado.rutParticipante    || certActualizado.rut,
        estado:     certActualizado.estado,
        asistencia: parseFloat(certActualizado.asistencia) || 0,
        evaluacion: parseFloat(certActualizado.evaluacion) || 0,
      }
    }))
    setCertsDB(prev => prev?.map(c => c.id === certActualizado.id ? { ...c, ...certActualizado } : c) ?? null)
    showToast('Certificado actualizado')
  }

  const handleEliminarEsteLoote = async () => {
    await onEliminarLote(lote)
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 760,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div>
            <code style={{
              fontSize: 15, fontWeight: 700, color: 'var(--brand-600)',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
            }}>
              {lote.folio ?? '—'}
            </code>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
              {fmtFechaHora(lote.emitidoEn)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleEliminarEsteLoote}
              title="Eliminar lote y todos sus certificados"
              style={{
                width: 32, height: 32, borderRadius: 'var(--radius-md)',
                background: 'var(--danger-50)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--danger-600)',
              }}
            >
              <Trash2 size={15} strokeWidth={2} />
            </button>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
            }}>
              <XIcon size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Datos del lote */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)', padding: 16,
          }}>
            {[
              ['Curso',               curso?.nombre ?? `#${lote.cursoId}`],
              ['Plantilla',           plantilla?.nombre ?? 'Plantilla por defecto'],
              ['Tipo',                lote.tipoCertificado],
              ['Certificados emitidos', partes.length > 0 ? partes.length : lote.cantidadEmitida],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Resumen rápido */}
          {partes.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Total',      val: partes.length, color: 'var(--fg-1)',        bg: 'var(--neutral-50)' },
                { label: 'Aprobados',  val: aprobados,     color: 'var(--success-700)', bg: 'var(--success-50)' },
                { label: 'Reprobados', val: reprobados,    color: 'var(--danger-600)',  bg: 'var(--danger-50)'  },
              ].map(({ label, val, color, bg }) => (
                <div key={label} style={{
                  flex: 1, padding: '12px 10px', borderRadius: 'var(--radius-md)',
                  background: bg, border: '1px solid var(--border-subtle)', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla de participantes */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 10 }}>
              Participantes ({partes.length > 0 ? partes.length : lote.cantidadEmitida})
            </div>

            {partes.length > 0 ? (
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)' }}>
                        {['#', 'Nombre', 'RUT', 'Asistencia', 'Evaluación', 'Estado', ''].map(h => (
                          <th key={h} style={{
                            padding: '9px 12px', fontWeight: 700, color: 'var(--fg-3)',
                            textAlign: h === 'Asistencia' || h === 'Evaluación' ? 'center' : 'left',
                            fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
                            whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {partes.map((p, i) => {
                        const enDescarga = descargando === (p.rut || p.nombre)
                        return (
                          <tr key={i} style={{
                            borderTop: '1px solid var(--border-subtle)',
                            background: p.estado === 'Aprobado'
                              ? 'rgba(101,188,123,0.04)'
                              : p.estado === 'Reprobado'
                              ? 'rgba(208,58,58,0.04)'
                              : 'var(--bg-surface)',
                          }}>
                            <td style={{ padding: '9px 12px', color: 'var(--fg-4)', width: 32 }}>{i + 1}</td>
                            <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--fg-1)' }}>
                              {p.nombre || '—'}
                            </td>
                            <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                              {p.rut || '—'}
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{
                                fontWeight: 700,
                                color: Number(p.asistencia) >= 75 ? 'var(--success-600)' : 'var(--danger-500)',
                              }}>
                                {p.asistencia !== '' && p.asistencia !== undefined ? `${p.asistencia}%` : '—'}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{
                                fontWeight: 700,
                                color: Number(p.evaluacion) >= 60 ? 'var(--success-600)' : 'var(--danger-500)',
                              }}>
                                {p.evaluacion !== '' && p.evaluacion !== undefined ? `${p.evaluacion}%` : '—'}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <EstadoPill estado={p.estado} />
                            </td>
                            <td style={{ padding: '9px 8px' }}>
                              <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }}>
                                {p.estado !== 'Pendiente' && (
                                  <button
                                    title="Descargar certificado PDF"
                                    disabled={!!descargando}
                                    onClick={() => handleDescargarIndividual(p)}
                                    style={{
                                      width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-md)',
                                      background: enDescarga ? 'var(--neutral-100)' : p.estado === 'Reprobado' ? 'var(--danger-50)' : 'var(--brand-50)',
                                      color: enDescarga ? 'var(--fg-4)' : p.estado === 'Reprobado' ? 'var(--danger-600)' : 'var(--brand-600)',
                                      cursor: descargando ? 'wait' : 'pointer',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                  >
                                    {enDescarga
                                      ? <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} />
                                      : <Download size={12} strokeWidth={2} />}
                                  </button>
                                )}
                                <button
                                  title="Editar certificado"
                                  disabled={!!descargando}
                                  onClick={() => handleEditar(p)}
                                  style={{
                                    width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-md)',
                                    background: 'var(--neutral-100)', color: 'var(--fg-2)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <Pencil size={12} strokeWidth={2} />
                                </button>
                                <button
                                  title="Eliminar certificado"
                                  disabled={!!descargando}
                                  onClick={() => handleEliminarCert(p)}
                                  style={{
                                    width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-md)',
                                    background: 'var(--danger-50)', color: 'var(--danger-600)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <Trash2 size={12} strokeWidth={2} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: 0 }}>
                Este lote fue generado antes de registrar el resumen de participantes.
              </p>
            )}
          </div>
        </div>
      </div>

      {certEditando && (
        <ModalEditarCertificado
          cert={certEditando}
          onClose={() => setCertEditando(null)}
          onGuardar={handleGuardarEdicion}
        />
      )}
    </div>
  )
}

// ── Tabla de lotes ────────────────────────────────────────────────────────────

function TablaLotes({ rows, cursos, plantillas, onDescargar, onVerDetalle, onEliminarLote, cargandoDetalle, descargandoLote }) {
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr>
              <TH width="170px">Folio</TH>
              <TH>Curso</TH>
              <TH width="140px">Tipo</TH>
              <TH width="80px" align="center">Cantidad</TH>
              <TH width="160px">Fecha</TH>
              <TH width="110px" align="right"></TH>
            </tr>
          </thead>
          <tbody>
            {pagina.map(l => {
              const curso    = cursos.find(c => c.id === l.cursoId)
              const plantilla = plantillas.find(p => p.id === l.plantillaId)
              return (
                <tr key={l.id} style={{ background: 'var(--bg-surface)', transition: 'background 100ms' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-50)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}>
                  <TD>
                    <code style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--brand-600)',
                      fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                    }}>
                      {l.folio ?? '—'}
                    </code>
                  </TD>
                  <TD>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>
                      {curso?.nombre ?? `Curso #${l.cursoId}`}
                    </span>
                  </TD>
                  <TD>{tipoBadge(l.tipoCertificado)}</TD>
                  <TD style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
                    {l.cantidadEmitida}
                  </TD>
                  <TD style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                    {fmtFechaHora(l.emitidoEn)}
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button title="Ver detalle" disabled={cargandoDetalle} onClick={() => onVerDetalle(l, curso, plantilla)} style={{
                        width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-md)',
                        background: 'var(--neutral-100)', color: 'var(--fg-2)',
                        cursor: cargandoDetalle ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {cargandoDetalle
                          ? <Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} />
                          : <Eye size={14} strokeWidth={2} />}
                      </button>
                      <button
                        title="Descargar ZIP del lote"
                        disabled={!!descargandoLote}
                        onClick={() => onDescargar(l)}
                        style={{
                          width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-md)',
                          background: 'var(--brand-50)', color: 'var(--brand-600)',
                          cursor: descargandoLote ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: descargandoLote && descargandoLote !== l.id ? 0.5 : 1,
                        }}>
                        {descargandoLote === l.id
                          ? <Loader2 size={14} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} />
                          : <Download size={14} strokeWidth={2} />}
                      </button>
                      <button
                        title="Eliminar lote y sus certificados"
                        disabled={!!descargandoLote}
                        onClick={() => onEliminarLote(l)}
                        style={{
                          width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-md)',
                          background: 'var(--danger-50)', color: 'var(--danger-600)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {rows.length} lotes — Página {page} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { icon: <ChevronLeft size={14} />, fn: () => setPage(p => p - 1), dis: page === 1 },
              { icon: <ChevronRight size={14} />, fn: () => setPage(p => p + 1), dis: page === totalPages },
            ].map((btn, i) => (
              <button key={i} disabled={btn.dis} onClick={btn.fn} style={{
                width: 28, height: 28, border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', background: '#fff',
                cursor: btn.dis ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: btn.dis ? 'var(--fg-4)' : 'var(--fg-2)',
              }}>
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function GestionLotesCertificados() {
  const { lotesCertificados, cursos, plantillas, eliminarLote } = useApp()
  const confirm = useConfirm()

  const [busqueda,        setBusqueda]       = useState('')
  const [desde,           setDesde]          = useState('')
  const [hasta,           setHasta]          = useState('')
  const [detalle,         setDetalle]        = useState(null)  // { lote, curso, plantilla }
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [descargandoLote, setDescargandoLote] = useState(null)
  const [toast,           setToast]          = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // KPIs
  const totalLotes       = lotesCertificados.length
  const totalCerts       = useMemo(() => lotesCertificados.reduce((s, l) => s + (l.cantidadEmitida || 0), 0), [lotesCertificados])
  const lotesEsteMes     = useMemo(() => lotesCertificados.filter(l => mesActual(l.emitidoEn)).length, [lotesCertificados])
  const plantillasUsadas = useMemo(() => new Set(lotesCertificados.map(l => l.plantillaId).filter(Boolean)).size, [lotesCertificados])

  // Filtros
  const filtrados = useMemo(() => {
    let r = [...lotesCertificados].sort((a, b) => new Date(b.emitidoEn) - new Date(a.emitidoEn))
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(l => {
        const curso = cursos.find(c => c.id === l.cursoId)
        return (l.folio ?? '').toLowerCase().includes(q) ||
          (curso?.nombre ?? '').toLowerCase().includes(q)
      })
    }
    if (desde) r = r.filter(l => l.emitidoEn && l.emitidoEn >= desde)
    if (hasta) r = r.filter(l => l.emitidoEn && l.emitidoEn <= hasta + 'T23:59:59')
    return r
  }, [lotesCertificados, busqueda, desde, hasta, cursos])

  // Descargar ZIP completo del lote
  const handleDescargar = async (lote) => {
    setDescargandoLote(lote.id)
    try {
      const todos = await apiFetch(`certificados.php?folio=${encodeURIComponent(lote.folio)}`)
      const certsLote = todos ?? []
      if (certsLote.length === 0) { showToast('No se encontraron certificados para este lote', 'error'); return }
      const archivos = []
      for (const cert of certsLote) {
        const curso = cursos.find(c => c.id === cert.cursoId)
        const { datos, participante } = buildDatosDesde(cert, curso)
        const buffer = await generarPDFPropio(participante, datos, cert.codigoCertificado)
        archivos.push({
          nombre: `${nombreArchivoCert(cert.empresaNombre, cert.curso, cert.nombre)}.pdf`,
          blob:   new Blob([buffer], { type: 'application/pdf' }),
        })
      }
      const zip = await crearZipBlob(archivos)
      saveAs(zip, `lote-${lote.folio ?? lote.id}.zip`)
    } catch (err) {
      showToast(`Error al generar ZIP: ${err?.message ?? err}`, 'error')
    } finally {
      setDescargandoLote(null)
    }
  }

  const handleVerDetalle = useCallback(async (lote, curso, plantilla) => {
    if (lote.participantesData === null && lote.id) {
      setCargandoDetalle(true)
      try {
        const full = await apiFetch(`lotes.php?id=${lote.id}`)
        setDetalle({ lote: full, curso, plantilla })
      } catch {
        setDetalle({ lote, curso, plantilla })
      } finally {
        setCargandoDetalle(false)
      }
    } else {
      setDetalle({ lote, curso, plantilla })
    }
  }, [])

  const handleEliminarLote = useCallback(async (lote) => {
    const ok = await confirm(
      `¿Eliminar el lote ${lote.folio ?? lote.id}? Se eliminarán todos sus certificados. Esta acción no se puede deshacer.`,
      { confirmLabel: 'Eliminar lote' }
    )
    if (!ok) return
    try {
      await eliminarLote(lote.id)
      if (detalle?.lote.id === lote.id) setDetalle(null)
      showToast(`Lote ${lote.folio} eliminado`)
    } catch (e) {
      showToast(`Error al eliminar: ${e?.message ?? e}`, 'error')
    }
  }, [confirm, eliminarLote, detalle, showToast])

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
          Lotes de Certificados
        </h1>
        <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '4px 0 0' }}>
          Historial de emisiones y trazabilidad por folio.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatCard label="Total lotes emitidos"   value={totalLotes}        icon={Archive}   color="var(--brand-500)" />
        <StatCard label="Total certificados"      value={totalCerts}        icon={Archive}   color="var(--success-500)" />
        <StatCard label="Lotes este mes"          value={lotesEsteMes}      icon={Archive}   color="var(--warning-500)" />
        <StatCard label="Plantillas utilizadas"   value={plantillasUsadas}  icon={Archive}   color="var(--info-500)" />
      </div>

      {/* Filtros */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', padding: '12px 16px',
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={14} strokeWidth={1.75} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--neutral-400)', pointerEvents: 'none',
          }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por folio o curso..."
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

        <FiltroFecha label="Desde" value={desde} max={hasta || undefined} onChange={setDesde} />
        <FiltroFecha label="Hasta" value={hasta} min={desde || undefined} onChange={setHasta} />

        {(busqueda || desde || hasta) && (
          <button
            onClick={() => { setBusqueda(''); setDesde(''); setHasta('') }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 30, padding: '0 10px', fontSize: 12, fontWeight: 500,
              color: 'var(--fg-3)', background: 'transparent',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <XIcon size={12} strokeWidth={2} /> Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
      }}>
        {filtrados.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '64px 24px', color: 'var(--fg-3)',
          }}>
            <Archive size={44} strokeWidth={1.25} style={{ color: 'var(--neutral-300)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>
                {lotesCertificados.length === 0 ? 'Aún no se han generado lotes' : 'Sin resultados'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                {lotesCertificados.length === 0
                  ? 'Los lotes aparecen aquí al emitir certificados.'
                  : 'Prueba con otros filtros.'}
              </div>
            </div>
          </div>
        ) : (
          <TablaLotes
            rows={filtrados}
            cursos={cursos}
            plantillas={plantillas}
            onDescargar={handleDescargar}
            onVerDetalle={handleVerDetalle}
            onEliminarLote={handleEliminarLote}
            cargandoDetalle={cargandoDetalle}
            descargandoLote={descargandoLote}
          />
        )}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <ModalDetalle
          lote={detalle.lote}
          curso={detalle.curso}
          plantilla={detalle.plantilla}
          onClose={() => setDetalle(null)}
          showToast={showToast}
          onEliminarLote={handleEliminarLote}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
