// Modal de emisión masiva: acepta un Excel con múltiples cursos/empresas en la misma hoja.
// Agrupa las filas por (Curso + Empresa + Fecha Inicio) y permite emitir varios lotes a la vez.
import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, AlertCircle, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react'
import Button from '../../components/atoms/Button'
import Badge  from '../../components/atoms/Badge'
import { calcularEstado, validarRutPersona, formatearRut, descargarPlantillaEmisionMasiva } from './utils'
import { useApp } from '../../context/AppContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFecha(val) {
  if (val === null || val === undefined || val === '') return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(val).trim()
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return s
}

function validarParticipante(p) {
  const errs = {}
  if (!p.nombre) errs.nombre = true
  if (!validarRutPersona(p.rut)) errs.rut = true
  const a = Number(p.asistencia), e = Number(p.evaluacion)
  if (p.asistencia === '' || isNaN(a) || a < 0 || a > 100) errs.asistencia = true
  if (p.evaluacion  === '' || isNaN(e) || e < 0 || e > 100) errs.evaluacion  = true
  return { ...p, _valido: Object.keys(errs).length === 0, _errores: errs }
}

function agruparFilas(filas, cursos, empresas) {
  const mapa = new Map()

  for (const fila of filas) {
    // Ignorar filas completamente vacías
    if (!fila.cursoNombre && !fila.nombre && !fila.rut) continue

    const key = `${fila.cursoNombre.toLowerCase()}||${fila.empresaNombre.toLowerCase()}||${fila.fechaInicio}`

    if (!mapa.has(key)) {
      const cursoMatch   = cursos.find(c => c.nombre.toLowerCase() === fila.cursoNombre.toLowerCase())
      const empresaMatch = empresas.find(e => e.nombre.toLowerCase() === fila.empresaNombre.toLowerCase())

      const errores = []
      if (!fila.cursoNombre)    errores.push('Falta el nombre del curso')
      else if (!cursoMatch)     errores.push(`Curso "${fila.cursoNombre}" no existe en el sistema`)
      if (!fila.empresaNombre)  errores.push('Falta el nombre de la empresa')
      else if (!empresaMatch)   errores.push(`Empresa "${fila.empresaNombre}" no existe en el sistema`)
      if (!fila.fechaInicio)    errores.push('Falta Fecha Inicio o formato inválido (DD/MM/YYYY)')
      if (!fila.fechaTermino)   errores.push('Falta Fecha Término o formato inválido')
      if (!fila.lugarEjecucion) errores.push('Falta Lugar de Ejecución')
      if (!fila.fechaEmision)   errores.push('Falta Fecha de Emisión o formato inválido')

      const vigenciaMeses = cursoMatch?.vigenciaMeses ?? 12
      let fechaFinValidez = ''
      if (fila.fechaEmision && vigenciaMeses > 0) {
        const d = new Date(fila.fechaEmision)
        d.setMonth(d.getMonth() + vigenciaMeses)
        fechaFinValidez = d.toISOString().slice(0, 10)
      }

      mapa.set(key, {
        key,
        cursoNombre:   fila.cursoNombre,
        empresaNombre: fila.empresaNombre,
        datosCurso: {
          cursoId:        cursoMatch?.id          ?? '',
          cursoNombre:    fila.cursoNombre,
          empresaId:      empresaMatch?.id        ?? '',
          empresaNombre:  fila.empresaNombre,
          codigoSence:    cursoMatch?.codigoSence ?? 'NO-APLICA',
          horas:          String(cursoMatch?.horas ?? ''),
          condicion:      fila.condicion,
          fechaInicio:    fila.fechaInicio,
          fechaTermino:   fila.fechaTermino,
          lugarEjecucion: fila.lugarEjecucion,
          fechaEmision:   fila.fechaEmision,
          fechaFinValidez,
          estado:         'Activo',
          contenidos:          cursoMatch?.contenidos          ?? '',
          vigenciaMeses,
          plantillaId:         cursoMatch?.plantillaId         ?? null,
          porcentajeAsistencia: cursoMatch?.porcentajeAsistencia ?? null,
          porcentajeAprobacion: cursoMatch?.porcentajeAprobacion ?? null,
        },
        participantes: [],
        errores,
      })
    }

    mapa.get(key).participantes.push(validarParticipante({
      nombre:     fila.nombre,
      rut:        fila.rut,
      email:      fila.email,
      asistencia: fila.asistencia,
      evaluacion: fila.evaluacion,
    }))
  }

  const grupos = Array.from(mapa.values())

  // Validaciones adicionales por grupo
  grupos.forEach(g => {
    if (g.errores.length > 0) return
    if (g.participantes.length === 0) {
      g.errores.push('No hay participantes en este grupo')
      return
    }
    const minA = g.datosCurso.porcentajeAsistencia ?? 75
    const minE = g.datosCurso.porcentajeAprobacion ?? 60
    const aprobados = g.participantes.filter(
      p => p._valido && calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Aprobado'
    ).length
    if (aprobados === 0) {
      g.errores.push(`Ningún participante aprobado (asistencia ≥ ${minA}% y evaluación ≥ ${minE}%)`)
    }
  })

  return grupos
}

// ── Tarjeta de grupo (colapsable) ─────────────────────────────────────────────

const ESTADO_BADGE = { Aprobado: 'success', Reprobado: 'danger', Pendiente: 'neutral' }

function GrupoCard({ grupo, index }) {
  const [expanded, setExpanded] = useState(false)

  const minA = grupo.datosCurso.porcentajeAsistencia ?? 75
  const minE = grupo.datosCurso.porcentajeAprobacion ?? 60
  const aprobados  = grupo.participantes.filter(p => p._valido && calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Aprobado').length
  const reprobados = grupo.participantes.filter(p => p._valido && calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Reprobado').length
  const conError   = grupo.participantes.filter(p => !p._valido).length
  const tieneError = grupo.errores.length > 0

  return (
    <div style={{
      border: `1px solid ${tieneError ? 'var(--danger-200)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      {/* Header de la tarjeta */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', cursor: 'pointer',
          background: tieneError ? 'var(--danger-50)' : 'var(--neutral-25)',
          borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
          userSelect: 'none',
        }}
      >
        {/* Número de lote */}
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: tieneError ? 'var(--danger-100)' : 'var(--brand-100)',
          color: tieneError ? 'var(--danger-600)' : 'var(--brand-600)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>
          {index + 1}
        </div>

        {/* Nombre curso / empresa */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: tieneError ? 'var(--danger-700)' : 'var(--fg-1)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {grupo.cursoNombre}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>
            {grupo.empresaNombre}
          </div>
        </div>

        {/* Badges resumen */}
        {tieneError ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger-600)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            <AlertCircle size={13} strokeWidth={2} />
            {grupo.errores.length} error{grupo.errores.length !== 1 ? 'es' : ''}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, fontSize: 12 }}>
            <span style={{ color: 'var(--success-700)', fontWeight: 600 }}>✓ {aprobados} aprobados</span>
            {reprobados > 0 && <span style={{ color: 'var(--danger-500)' }}>✗ {reprobados} reprobados</span>}
            {conError > 0   && <span style={{ color: 'var(--warning-600)' }}>⚠ {conError} con error</span>}
          </div>
        )}

        <div style={{ color: 'var(--fg-4)', flexShrink: 0 }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRightIcon size={16} />}
        </div>
      </div>

      {/* Contenido expandido */}
      {expanded && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fff' }}>

          {/* Errores del grupo */}
          {tieneError && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {grupo.errores.map((e, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--danger-600)', lineHeight: 1.9 }}>{e}</li>
              ))}
            </ul>
          )}

          {/* Datos del lote */}
          {!tieneError && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 20px', fontSize: 12 }}>
              {[
                ['Fecha Inicio',  grupo.datosCurso.fechaInicio],
                ['Fecha Término', grupo.datosCurso.fechaTermino],
                ['Fecha Emisión', grupo.datosCurso.fechaEmision],
                ['Lugar',         grupo.datosCurso.lugarEjecucion],
                ['Condición',     grupo.datosCurso.condicion],
                ['Vigencia',      grupo.datosCurso.vigenciaMeses === 0 ? 'Sin vencimiento' : `${grupo.datosCurso.vigenciaMeses} meses`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ color: 'var(--fg-4)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, marginBottom: 1 }}>{k}</div>
                  <div style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{v || '—'}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla de participantes */}
          {grupo.participantes.length > 0 && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)' }}>
                      {['Nombre', 'RUT', 'Asistencia', 'Evaluación', 'Estado'].map(h => (
                        <th key={h} style={{
                          padding: '7px 10px', textAlign: h === 'Asistencia' || h === 'Evaluación' ? 'center' : 'left',
                          color: 'var(--fg-3)', fontWeight: 700, fontSize: 10,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.participantes.map((p, i) => {
                      const estado = calcularEstado(p.asistencia, p.evaluacion, minA, minE)
                      return (
                        <tr key={i} style={{
                          borderTop: '1px solid var(--border-subtle)',
                          background: !p._valido ? 'var(--danger-50)' : '#fff',
                        }}>
                          <td style={{ padding: '7px 10px', fontWeight: 500, color: p._errores?.nombre ? 'var(--danger-500)' : 'var(--fg-1)' }}>
                            {p.nombre || '—'}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: p._errores?.rut ? 'var(--danger-500)' : 'var(--fg-3)' }}>
                            {p.rut || '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700,
                            color: p._errores?.asistencia ? 'var(--danger-500)' : Number(p.asistencia) >= minA ? 'var(--success-600)' : 'var(--danger-500)' }}>
                            {p.asistencia !== '' ? `${p.asistencia}%` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700,
                            color: p._errores?.evaluacion ? 'var(--danger-500)' : Number(p.evaluacion) >= minE ? 'var(--success-600)' : 'var(--danger-500)' }}>
                            {p.evaluacion !== '' ? `${p.evaluacion}%` : '—'}
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {p._valido
                              ? <Badge variant={ESTADO_BADGE[estado]} dot={false}>{estado}</Badge>
                              : <Badge variant="danger" dot={false}>Error datos</Badge>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal principal ───────────────────────────────────────────────────────────

export default function ModalEmisionMasiva({ onClose, onConfirmar }) {
  const { cursos, empresas } = useApp()

  const [estado,    setEstado]    = useState('idle')
  const [dragging,  setDragging]  = useState(false)
  const [fileError, setFileError] = useState(null)
  const [grupos,    setGrupos]    = useState([])
  const [visible,   setVisible]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  const procesarArchivo = (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setFileError('Solo se aceptan archivos Excel (.xlsx o .xls).'); return }
    if (file.size > 10 * 1024 * 1024)       { setFileError('El archivo supera el límite de 10 MB.'); return }
    setFileError(null)
    setEstado('parsing')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb  = XLSX.read(new Uint8Array(evt.target.result), { type: 'array', cellDates: true })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (raw.length === 0) {
          setFileError('El archivo está vacío o no tiene el formato correcto.')
          setEstado('idle')
          return
        }

        const filas = raw.map(row => ({
          cursoNombre:    String(row['Curso']              ?? '').trim(),
          empresaNombre:  String(row['Empresa']            ?? '').trim(),
          fechaInicio:    parseFecha(row['Fecha Inicio']),
          fechaTermino:   parseFecha(row['Fecha Término']),
          lugarEjecucion: String(row['Lugar de Ejecución'] ?? '').trim(),
          condicion:      String(row['Condición']          ?? 'TEÓRICO - PRÁCTICO').trim(),
          fechaEmision:   parseFecha(row['Fecha de Emisión']),
          nombre:         String(row['Nombre']             ?? '').trim(),
          rut:            formatearRut(String(row['RUT'] ?? '').trim()),
          email:          String(row['Email']             ?? '').trim(),
          asistencia:     row['Asistencia'] !== undefined ? String(row['Asistencia']).trim() : '',
          evaluacion:     row['Evaluación'] !== undefined ? String(row['Evaluación']).trim() : '',
        }))

        const resultado = agruparFilas(filas, cursos, empresas)

        if (resultado.length === 0) {
          setFileError('No se encontraron datos válidos. Verifique el formato de la plantilla.')
          setEstado('idle')
          return
        }

        setGrupos(resultado)
        setEstado('preview')
      } catch {
        setFileError('No se pudo leer el archivo. Verifique que sea la plantilla correcta.')
        setEstado('idle')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Stats globales
  const gruposOk    = grupos.filter(g => g.errores.length === 0).length
  const gruposError = grupos.length - gruposOk
  const totalCerts  = grupos
    .filter(g => g.errores.length === 0)
    .reduce((s, g) => s + g.participantes.filter(
      p => p._valido && calcularEstado(p.asistencia, p.evaluacion) === 'Aprobado'
    ).length, 0)

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
        width: '100%', maxWidth: 860, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: visible ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
              Emisión Masiva de Certificados
            </h2>
            <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '3px 0 0' }}>
              Un Excel, múltiples cursos y empresas — el sistema detecta los grupos automáticamente
            </p>
          </div>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
          }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Idle ── */}
          {estado === 'idle' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); procesarArchivo(e.dataTransfer.files[0]) }}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--brand-500)' : 'var(--border-strong)'}`,
                  borderRadius: 12, padding: '48px 24px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  cursor: 'pointer', background: dragging ? 'var(--brand-50)' : 'var(--neutral-25)',
                  textAlign: 'center', transition: 'all 150ms',
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--neutral-100)', color: 'var(--neutral-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={26} strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>Arrastre su archivo Excel aquí</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>o haga clic para seleccionar · máx. 10 MB</div>
                </div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls"
                  onChange={e => procesarArchivo(e.target.files[0])} style={{ display: 'none' }} />
              </div>

              {fileError && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--danger-50)', color: 'var(--danger-600)', fontSize: 13 }}>
                  <AlertCircle size={15} strokeWidth={2} /> {fileError}
                </div>
              )}

              <div style={{
                padding: '14px 16px', background: 'var(--neutral-50)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20,
              }}>
                <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                  <strong style={{ color: 'var(--fg-2)' }}>Formato: una fila por participante, todos los cursos en el mismo archivo.</strong>
                  <div style={{ marginTop: 6, lineHeight: 1.8, fontSize: 12 }}>
                    Columnas requeridas:{' '}
                    {['Curso','Empresa','Fecha Inicio','Fecha Término','Lugar de Ejecución','Condición','Fecha de Emisión','Nombre','RUT','Email','Asistencia','Evaluación'].map((c, i, arr) => (
                      <span key={c}>
                        <code style={{ fontSize: 11, background: 'var(--neutral-100)', padding: '1px 4px', borderRadius: 3 }}>{c}</code>
                        {i < arr.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-4)' }}>
                    El sistema agrupa las filas por (Curso + Empresa + Fecha Inicio) y genera un lote por cada grupo.
                  </div>
                </div>
                <Button variant="secondary" size="sm" icon={Download}
                  onClick={e => { e.stopPropagation(); descargarPlantillaEmisionMasiva() }}
                  style={{ flexShrink: 0 }}>
                  Descargar Plantilla
                </Button>
              </div>
            </>
          )}

          {/* ── Parsing ── */}
          {estado === 'parsing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
              <style>{`@keyframes otec-demo-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--neutral-100)', borderTopColor: 'var(--brand-600)', animation: 'otec-demo-spin 700ms linear infinite' }} />
              <span style={{ fontSize: 13, color: 'var(--fg-3)', fontWeight: 500 }}>Procesando archivo...</span>
            </div>
          )}

          {/* ── Preview ── */}
          {estado === 'preview' && (
            <>
              {/* Stats globales */}
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Grupos detectados',      val: grupos.length, color: 'var(--fg-1)',        bg: 'var(--neutral-50)'  },
                  { label: 'Listos para emitir',     val: gruposOk,      color: 'var(--success-700)', bg: 'var(--success-50)'  },
                  { label: 'Con errores',             val: gruposError,   color: 'var(--danger-600)',  bg: 'var(--danger-50)'   },
                  { label: 'Certificados a generar', val: totalCerts,    color: 'var(--brand-600)',   bg: 'var(--brand-50)'    },
                ].map(({ label, val, color, bg }) => (
                  <div key={label} style={{ flex: 1, padding: '12px 10px', borderRadius: 'var(--radius-md)', background: bg, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tarjetas por grupo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grupos.map((g, i) => (
                  <GrupoCard key={g.key} grupo={g} index={i} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {estado === 'preview' && gruposOk > 0 && (
              gruposError > 0
                ? `Se emitirán ${gruposOk} de ${grupos.length} lotes — ${gruposError} con errores serán ignorados`
                : `Se generarán ${totalCerts} certificados en ${gruposOk} lote${gruposOk !== 1 ? 's' : ''} · ZIP con subcarpetas por lote`
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {estado === 'idle' && (
              <Button variant="ghost" size="md" onClick={handleClose}>Cancelar</Button>
            )}
            {estado === 'preview' && (
              <>
                <Button variant="ghost" size="md"
                  onClick={() => { setEstado('idle'); setFileError(null); setGrupos([]) }}>
                  Cargar otro archivo
                </Button>
                <Button variant="primary" size="md"
                  disabled={gruposOk === 0}
                  onClick={() => onConfirmar(grupos)}>
                  Confirmar y generar {totalCerts > 0 ? `${totalCerts} certificados` : ''}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
