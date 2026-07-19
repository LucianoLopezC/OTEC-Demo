// Pantalla de personas: listado de participantes con su historial de certificados.
// Los datos ya llegan pre-enriquecidos desde personas.php (JOIN con certificados),
// así que no se hace ningún fetch adicional para ver el detalle.
import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Eye, Download, X as XIcon, FileDown, Trash2, Pencil, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Avatar       from '../../components/atoms/Avatar'
import Badge        from '../../components/atoms/Badge'
import IconButton   from '../../components/atoms/IconButton'
import Button       from '../../components/atoms/Button'
import FiltroSelect from '../../components/atoms/FiltroSelect'
import FiltroFecha  from '../../components/atoms/FiltroFecha'
import { useApp } from '../../context/AppContext'
import { useEmpresaFiltro } from '../../hooks/useEmpresaFiltro'
import { useConfirm } from '../../context/ConfirmContext'
import { generarPDFPropio } from '../EmisionCertificados/generarPDF'
import { obtenerDatosRegeneracion } from '../../services/supabase'
import { nombreArchivoCert } from '../EmisionCertificados/utils'
import { hoyChile } from '../../utils/fecha'

const ESTADO_BADGE = { Aprobado: 'success', Reprobado: 'danger' }

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

function calcVigenciaMeses(fechaEmision, fechaVencimiento, fallback = 12) {
  if (!fechaVencimiento) return 0
  if (!fechaEmision) return fallback
  const diff = new Date(fechaVencimiento) - new Date(fechaEmision)
  return Math.round(diff / (1000 * 60 * 60 * 24 * 30.44))
}

const TH = {
  padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--neutral-50)',
  borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap', textAlign: 'left',
}
const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--fg-2)', verticalAlign: 'middle' }


/* ── Detail modal ── */
function ModalDetalle({ persona, onClose }) {
  const { editarCertificado, eliminarCertificado } = useApp()
  const confirm = useConfirm()

  const [visible,      setVisible]      = useState(false)
  const [descargando,  setDescargando]  = useState(null)
  const [errorDesc,    setErrorDesc]    = useState(null)
  // copia local para actualización optimista tras editar/eliminar
  const [certs,        setCerts]        = useState(persona.certificados ?? [])
  const [certEditando, setCertEditando] = useState(null)
  const [cargandoEdit, setCargandoEdit] = useState(null) // codigoCertificado en carga

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  const handleDescargar = async (cert) => {
    setDescargando(cert.codigoCertificado)
    setErrorDesc(null)
    try {
      const datosReg = await obtenerDatosRegeneracion(cert.codigoCertificado)
      if (!datosReg) {
        setErrorDesc(`No se encontraron los datos del certificado ${cert.codigoCertificado}.`)
        return
      }

      const cursoDatos = datosReg.curso_datos ?? {}
      const vigenciaMeses = calcVigenciaMeses(datosReg.fechaEmision, datosReg.fechaVencimiento, cursoDatos.vigenciaMeses)

      const datos = {
        cursoNombre:     datosReg.curso,
        empresaNombre:   datosReg.empresaNombre || datosReg.empresa,
        fechaEmision:    datosReg.fechaEmision,
        fechaFinValidez: datosReg.fechaVencimiento,
        horas:           datosReg.horas,
        fechaInicio:     datosReg.fechaInicioCurso  || datosReg.fechaEmision,
        fechaTermino:    datosReg.fechaTerminoCurso || datosReg.fechaEmision,
        lugarEjecucion:  datosReg.lugarEjecucion   || '',
        condicion:       datosReg.condicion        || cursoDatos.condicion || '',
        codigoSence:     cursoDatos.codigoSence    || '',
        contenidos:      cursoDatos.contenidos     || '',
        vigenciaMeses,
      }

      const participante = {
        nombre:     persona.nombre,
        rut:        persona.rut,
        empresa:    datosReg.empresaNombre || datosReg.empresa,
        cargo:      datosReg.cargoParticipante || '',
        asistencia: datosReg.asistencia,
        evaluacion: datosReg.evaluacion,
        estado:     datosReg.estado,
      }

      const buffer = await generarPDFPropio(participante, datos, cert.codigoCertificado)
      saveAs(new Blob([buffer], { type: 'application/pdf' }), `${nombreArchivoCert(datosReg.empresaNombre || datosReg.empresa, datosReg.curso, persona.nombre)}.pdf`)
    } catch (err) {
      console.error('[descargar cert]', err)
      setErrorDesc('No se pudo descargar el certificado. Intenta de nuevo.')
    } finally {
      setDescargando(null)
    }
  }

  const handleEditar = async (cert) => {
    setCargandoEdit(cert.codigoCertificado)
    setErrorDesc(null)
    try {
      // Obtener datos completos (cargoParticipante, etc.) para el formulario de edición
      const datosReg = await obtenerDatosRegeneracion(cert.codigoCertificado)
      if (!datosReg) { setErrorDesc('No se encontraron datos del certificado.'); return }
      setCertEditando({ ...datosReg, id: cert.id })
    } catch (err) {
      setErrorDesc('No se pudo cargar el certificado para editar.')
    } finally {
      setCargandoEdit(null)
    }
  }

  const handleEliminarCert = async (cert) => {
    const ok = await confirm(
      `¿Eliminar el certificado "${cert.curso}" de ${persona.nombre}? Esta acción no se puede deshacer.`,
      { confirmLabel: 'Eliminar' }
    )
    if (!ok) return
    setErrorDesc(null)
    try {
      await eliminarCertificado(cert.id)
      setCerts(prev => prev.filter(c => c.id !== cert.id))
    } catch (err) {
      setErrorDesc('No se pudo eliminar el certificado.')
    }
  }

  const handleGuardarEdicion = async (certActualizado) => {
    await editarCertificado(certActualizado)
    setCerts(prev => prev.map(c => c.id === certActualizado.id ? {
      ...c,
      curso:           certActualizado.curso,
      asistencia:      parseFloat(certActualizado.asistencia) || 0,
      evaluacion:      parseFloat(certActualizado.evaluacion) || 0,
      estado:          certActualizado.estado,
      fechaEmision:    certActualizado.fechaEmision    || c.fechaEmision,
      fechaVencimiento:certActualizado.fechaVencimiento || c.fechaVencimiento,
      horas:           parseFloat(certActualizado.horas) || c.horas,
    } : c))
  }

  const aprobados = certs.filter(c => c.estado === 'Aprobado').length
  const reprobados = certs.filter(c => c.estado === 'Reprobado').length

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={ev => ev.target === ev.currentTarget && handleClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--modal-pad)', opacity: visible ? 1 : 0,
        transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: 1100, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: visible ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <Avatar name={persona.nombre} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)' }}>{persona.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {persona.rut} · {persona.empresa}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Badge variant={aprobados > 0 ? 'success' : 'neutral'} dot={false}>{aprobados} aprobado{aprobados !== 1 ? 's' : ''}</Badge>
            {reprobados > 0 && <Badge variant="danger" dot={false}>{reprobados} reprobado{reprobados !== 1 ? 's' : ''}</Badge>}
          </div>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
          }}>
            <XIcon size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 14 }}>
            Historial de certificados
          </h3>
          {errorDesc && (
            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-50, #fff5f5)', color: 'var(--danger-600, #b91c1c)', fontSize: 13 }}>
              {errorDesc}
            </div>
          )}
          {certs.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: 0 }}>
              No hay certificados registrados para esta persona.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Curso', 'Empresa', 'F. Emisión', 'Válido hasta', 'Asist.', 'Eval.', 'Estado', 'Código', ''].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: 'var(--fg-3)', background: 'var(--neutral-50)',
                        borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap', textAlign: 'left',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c, i) => {
                    const esReprobado  = c.estado === 'Reprobado'
                    const enDescarga   = descargando === c.codigoCertificado
                    const enCargaEdit  = cargandoEdit === c.codigoCertificado
                    return (
                      <tr key={c.id ?? i} style={{
                        borderTop: '1px solid var(--border-subtle)',
                        background: esReprobado ? 'var(--danger-50, #fff5f5)' : undefined,
                      }}>
                        <td style={{ padding: '9px 12px', fontWeight: 500, color: 'var(--fg-1)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.curso}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-2)' }}>{c.empresa}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{c.fechaEmision}</td>
                        <td style={{ padding: '9px 12px', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{c.fechaVencimiento || '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{c.asistencia}%</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{c.evaluacion}%</td>
                        <td style={{ padding: '9px 12px' }}><Badge variant={ESTADO_BADGE[c.estado] ?? 'neutral'}>{c.estado}</Badge></td>
                        <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{c.codigoCertificado || '—'}</td>
                        <td style={{ padding: '9px 8px' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <IconButton
                              icon={Download} size={26} variant="ghost"
                              title="Descargar certificado (.pdf)"
                              disabled={!!descargando || !!cargandoEdit}
                              onClick={() => handleDescargar(c)}
                              style={{ opacity: enDescarga ? 0.5 : 1 }}
                            />
                            <button
                              title="Editar certificado"
                              disabled={!!descargando || !!cargandoEdit}
                              onClick={() => handleEditar(c)}
                              style={{
                                width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-md)',
                                background: 'var(--neutral-100)', color: 'var(--fg-2)',
                                cursor: cargandoEdit ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {enCargaEdit
                                ? <Loader2 size={12} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} />
                                : <Pencil size={12} strokeWidth={2} />}
                            </button>
                            <button
                              title="Eliminar certificado"
                              disabled={!!descargando || !!cargandoEdit}
                              onClick={() => handleEliminarCert(c)}
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
          )}
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

/* ── Export helper ── */
function exportarExcel(personas, filtros) {
  // Una fila por certificado por persona (más útil para análisis)
  const filas = []
  for (const p of personas) {
    if (p.certificados.length === 0) {
      filas.push({
        'Nombre':              p.nombre,
        'RUT':                 p.rut,
        'Empresa':             p.empresa,
        'Curso':               '',
        'Fecha Emisión':       '',
        'Válido Hasta':        '',
        'Asistencia %':        '',
        'Evaluación %':        '',
        'Estado':              '',
        'Código Certificado':  '',
      })
    } else {
      for (const c of p.certificados) {
        filas.push({
          'Nombre':              p.nombre,
          'RUT':                 p.rut,
          'Empresa':             p.empresa,
          'Curso':               c.curso,
          'Fecha Emisión':       c.fechaEmision  || '',
          'Válido Hasta':        c.fechaVencimiento || '',
          'Asistencia %':        c.asistencia    ?? '',
          'Evaluación %':        c.evaluacion    ?? '',
          'Estado':              c.estado        || '',
          'Código Certificado':  c.codigoCertificado || '',
        })
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(filas)

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 28 }, { wch: 36 },
    { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 13 },
    { wch: 12 }, { wch: 20 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Personas')

  const ts  = hoyChile()
  const tag = [
    filtros.empresa  ? filtros.empresa  : '',
    filtros.curso    ? filtros.curso    : '',
    filtros.estado   ? filtros.estado   : '',
  ].filter(Boolean).join('_')

  const nombre = `personas${tag ? `_${tag}` : ''}_${ts}.xlsx`
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), nombre)
}

/* ── main ── */
export default function Personas() {
  const { personas, eliminarPersonas } = useApp()
  const { esEmpresa, empresaId, empresaNombre } = useEmpresaFiltro()
  const confirm = useConfirm()

  const [seleccionados,  setSeleccionados]  = useState([])
  const headerChkRef = useRef(null)

  const [busqueda,      setBusqueda]      = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [filtroCurso,   setFiltroCurso]   = useState('')
  const [filtroEstado,  setFiltroEstado]  = useState('')
  const [fechaDesde,    setFechaDesde]    = useState('')
  const [fechaHasta,    setFechaHasta]    = useState('')
  const [detalle,       setDetalle]       = useState(null)

  // Subset según rol empresa
  const personasPorRol = useMemo(() => {
    if (esEmpresa && empresaId) {
      return personas.filter(p => p.empresaId === empresaId || p.empresa === empresaNombre)
    }
    return personas
  }, [personas, esEmpresa, empresaId, empresaNombre])

  // Opciones únicas para los selects
  const opcionesEmpresa = useMemo(() => {
    const set = new Set(personasPorRol.map(p => p.empresa).filter(Boolean))
    return [...set].sort()
  }, [personasPorRol])

  const opcionesCurso = useMemo(() => {
    const set = new Set(
      personasPorRol.flatMap(p => p.certificados.map(c => c.curso)).filter(Boolean)
    )
    return [...set].sort()
  }, [personasPorRol])

  // Lista filtrada final
  const filtradas = useMemo(() => {
    return personasPorRol.filter(p => {
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        if (!p.nombre.toLowerCase().includes(q) && !p.rut.toLowerCase().includes(q)) return false
      }
      if (filtroEmpresa && p.empresa !== filtroEmpresa) return false
      if (filtroCurso   && !p.certificados.some(c => c.curso === filtroCurso))   return false
      if (filtroEstado  && !p.certificados.some(c => c.estado === filtroEstado)) return false
      if (fechaDesde    && !p.certificados.some(c => c.fechaEmision >= fechaDesde)) return false
      if (fechaHasta    && !p.certificados.some(c => c.fechaEmision <= fechaHasta)) return false
      return true
    })
  }, [personasPorRol, busqueda, filtroEmpresa, filtroCurso, filtroEstado, fechaDesde, fechaHasta])

  const hayFiltrosActivos = busqueda || filtroEmpresa || filtroCurso || filtroEstado || fechaDesde || fechaHasta

  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroEmpresa(''); setFiltroCurso(''); setFiltroEstado('')
    setFechaDesde(''); setFechaHasta('')
  }

  const idsPagina   = filtradas.map(p => p.id)
  const selEnPagina = seleccionados.filter(id => idsPagina.includes(id))

  useEffect(() => {
    const el = headerChkRef.current
    if (!el) return
    el.checked       = idsPagina.length > 0 && selEnPagina.length === idsPagina.length
    el.indeterminate = selEnPagina.length > 0 && selEnPagina.length < idsPagina.length
  }, [seleccionados, filtradas])  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAll = () => {
    if (selEnPagina.length === idsPagina.length)
      setSeleccionados(p => p.filter(id => !idsPagina.includes(id)))
    else
      setSeleccionados(p => [...new Set([...p, ...idsPagina])])
  }
  const toggleSel = (id) =>
    setSeleccionados(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])

  const handleDeleteSelected = async () => {
    const n = seleccionados.length
    const ok = await confirm(
      `¿Eliminar ${n} persona${n !== 1 ? 's' : ''} seleccionada${n !== 1 ? 's' : ''}? Esta acción también eliminará sus certificados asociados.`,
      { confirmLabel: 'Eliminar' }
    )
    if (!ok) return
    try {
      await eliminarPersonas(seleccionados)
      setSeleccionados([])
    } catch (err) {
      console.error('Error al eliminar personas:', err)
    }
  }

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Toolbar */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)', padding: '10px 16px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {/* Fila principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
          {/* Búsqueda */}
          <div style={{ position: 'relative', width: 170, flexShrink: 0 }}>
            <Search size={14} strokeWidth={1.75} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--neutral-400)', pointerEvents: 'none',
            }} />
            <input
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre o RUT..."
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

          {!esEmpresa && opcionesEmpresa.length > 1 && (
            <FiltroSelect
              label="Empresa"
              value={filtroEmpresa || 'Todas'}
              onChange={v => setFiltroEmpresa(v === 'Todas' ? '' : v)}
              options={['Todas', ...opcionesEmpresa]}
            />
          )}

          {opcionesCurso.length > 1 && (
            <FiltroSelect
              label="Curso"
              value={filtroCurso || 'Todos'}
              onChange={v => setFiltroCurso(v === 'Todos' ? '' : v)}
              options={['Todos', ...opcionesCurso]}
            />
          )}

          <FiltroSelect
            label="Estado"
            value={filtroEstado || 'Todos'}
            onChange={v => setFiltroEstado(v === 'Todos' ? '' : v)}
            options={['Todos', 'Aprobado', 'Reprobado']}
          />

          <FiltroFecha label="Desde" value={fechaDesde} max={fechaHasta || undefined} onChange={setFechaDesde} />
          <FiltroFecha label="Hasta" value={fechaHasta} min={fechaDesde || undefined} onChange={setFechaHasta} />

          <div style={{ flex: 1 }} />

          <span style={{ fontSize: 12, color: 'var(--fg-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {filtradas.length} de {personasPorRol.length} persona{personasPorRol.length !== 1 ? 's' : ''}
          </span>

          <Button
            variant="secondary" size="sm" icon={FileDown}
            disabled={filtradas.length === 0}
            onClick={() => exportarExcel(filtradas, { empresa: filtroEmpresa, curso: filtroCurso, estado: filtroEstado })}
            style={{ flexShrink: 0 }}
          >
            Exportar Excel
          </Button>
        </div>

        {/* Fila de limpiar — solo aparece cuando hay filtros activos */}
        {hayFiltrosActivos && (
          <div>
            <button
              onClick={limpiarFiltros}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 24, padding: '0 8px', fontSize: 11, fontWeight: 500,
                color: 'var(--fg-3)', background: 'transparent',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <XIcon size={11} strokeWidth={2} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Table card */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: 38, padding: '10px 10px' }}>
                  <input type="checkbox" ref={headerChkRef} onChange={toggleAll}
                    style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--brand-600)' }} />
                </th>
                <th style={TH}>Nombre</th>
                <th style={TH}>RUT</th>
                <th style={TH}>Empresa</th>
                <th style={{ ...TH, textAlign: 'center' }}>Certificados</th>
                <th style={TH}>Último certificado</th>
                <th style={TH} />
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 14 }}>
                    {personasPorRol.length === 0
                      ? 'Aún no hay personas registradas. Emita certificados para registrar participantes.'
                      : hayFiltrosActivos
                        ? 'Sin resultados para los filtros aplicados.'
                        : `Sin resultados para "${busqueda}".`
                    }
                  </td>
                </tr>
              ) : (
                filtradas.map(p => (
                  <PersonaRow
                    key={p.id} persona={p}
                    selected={seleccionados.includes(p.id)}
                    onToggle={toggleSel}
                    onDetalle={() => setDetalle(p)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch delete bar */}
      {seleccionados.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 'var(--radius-lg)',
          background: 'var(--brand-50)', boxShadow: 'var(--shadow-sm)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--brand-700)', fontWeight: 500 }}>
            {seleccionados.length} seleccionada{seleccionados.length !== 1 ? 's' : ''}
          </span>
          <Button variant="dangerSoft" size="sm" icon={Trash2} onClick={handleDeleteSelected}>
            Eliminar seleccionadas
          </Button>
          <button
            onClick={() => setSeleccionados([])}
            style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Cancelar selección
          </button>
        </div>
      )}

      {detalle && <ModalDetalle persona={detalle} onClose={() => setDetalle(null)} />}
    </div>
  )
}

function PersonaRow({ persona: p, onDetalle, selected, onToggle }) {
  const [hov, setHov] = useState(false)
  const ultimo = p.certificados[p.certificados.length - 1]
  const aprobadosCount  = p.certificados.filter(c => c.estado === 'Aprobado').length
  const reprobadosCount = p.certificados.filter(c => c.estado === 'Reprobado').length
  return (
    <tr
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderTop: '1px solid var(--border-subtle)', background: selected ? 'var(--brand-50)' : hov ? 'var(--neutral-25)' : 'var(--bg-surface)' }}
    >
      <td style={{ padding: '12px 10px', verticalAlign: 'middle', width: 38 }}>
        <input type="checkbox" checked={!!selected} onChange={() => onToggle(p.id)}
          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--brand-600)' }} />
      </td>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={p.nombre} size={32} />
          <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{p.nombre}</span>
        </div>
      </td>
      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>{p.rut}</td>
      <td style={TD}>{p.empresa}</td>
      <td style={{ ...TD, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Badge variant={aprobadosCount > 0 ? 'success' : 'neutral'} dot={false}>{aprobadosCount} aprob.</Badge>
          {reprobadosCount > 0 && <Badge variant="danger" dot={false}>{reprobadosCount} reprob.</Badge>}
        </div>
      </td>
      <td style={TD}>
        {ultimo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--fg-1)', lineHeight: 1.3, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ultimo.curso}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>{ultimo.fechaEmision}</div>
            </div>
            <Badge variant={ESTADO_BADGE[ultimo.estado] ?? 'neutral'}>{ultimo.estado}</Badge>
          </div>
        ) : '—'}
      </td>
      <td style={{ ...TD, textAlign: 'right' }}>
        <IconButton icon={Eye} size={30} variant="ghost" title="Ver detalle" onClick={onDetalle} />
      </td>
    </tr>
  )
}
