// Modal de importación masiva de cursos desde Excel.
// Valida condición, código SENCE y estado antes de importar, y muestra los errores por fila.
import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import Button from '../../components/atoms/Button'
import Badge  from '../../components/atoms/Badge'
import { descargarPlantillaExcel } from './utils'
import { useApp } from '../../context/AppContext'

const CONDICIONES_VALIDAS = new Set(['TEÓRICO - PRÁCTICO', 'TEÓRICO', 'PRÁCTICO', 'E-LEARNING'])

function mapRow(row) {
  const precioRaw = row['Precio'] !== undefined && row['Precio'] !== '' ? Number(row['Precio']) : null
  return {
    nombre:          String(row['Nombre']           ?? '').trim(),
    codigoSence:     String(row['Código SENCE']     ?? '').trim() || 'NO-APLICA',
    horas:           Number(row['Horas']            ?? 0),
    condicion:       String(row['Condición']        ?? '').trim().toUpperCase(),
    categorias:      String(row['Categorías']       ?? '').split(',').map(c => c.trim()).filter(Boolean),
    estado:          String(row['Estado']           ?? 'Activo').trim(),
    objetivos:       String(row['Objetivos']        ?? '').trim(),
    contenidos:      String(row['Contenidos']       ?? '').trim(),
    modalidad:       String(row['Modalidad']        ?? '').trim() || null,
    vigenciaMeses:        row['Vigencia (meses)'] !== undefined && row['Vigencia (meses)'] !== ''
                            ? Number(row['Vigencia (meses)']) : 12,
    precio:               !isNaN(precioRaw) && precioRaw !== null ? precioRaw : null,
    porcentajeAsistencia: row['Asistencia mínima (%)'] !== undefined && row['Asistencia mínima (%)'] !== ''
                            ? Math.min(100, Math.max(0, Number(row['Asistencia mínima (%)']))) : null,
    porcentajeAprobacion: row['Aprobación mínima (%)'] !== undefined && row['Aprobación mínima (%)'] !== ''
                            ? Math.min(100, Math.max(0, Number(row['Aprobación mínima (%)']))) : null,
    _plantillaNombre: String(row['Plantilla'] ?? '').trim() || null,
  }
}

function validarFila(row) {
  const errs = {}
  const warns = {}
  if (!row.nombre)
    errs.nombre = 'Nombre requerido'
  if (!row.horas || isNaN(row.horas))
    errs.horas = 'Horas requeridas (número)'
  if (!CONDICIONES_VALIDAS.has(row.condicion))
    errs.condicion = `Condición inválida: "${row.condicion || '(vacío)'}". Valores: TEÓRICO, PRÁCTICO, TEÓRICO - PRÁCTICO, E-LEARNING`
  if (!row.codigoSence || row.codigoSence.trim() === '')
    warns.codigoSence = 'Código SENCE requerido'
  return { ...row, _valido: Object.keys(errs).length === 0, _errores: errs, _advertencias: warns }
}

function OverlayCard({ onClose, children }) {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setVis(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  const close = () => { setVis(false); setTimeout(onClose, 200) }
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={e => e.target === e.currentTarget && close()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--modal-pad)',
        opacity: vis ? 1 : 0, transition: 'opacity 200ms',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: 900,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: vis ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms',
      }}>
        {children(close)}
      </div>
    </div>
  )
}

export default function ModalImportarCursos({ onClose, onImportar }) {
  const { plantillas } = useApp()
  const [estado,      setEstado]      = useState('idle')
  const [archivo,     setArchivo]     = useState(null)
  const [dragging,    setDragging]    = useState(false)
  const [filas,       setFilas]       = useState([])
  const [resultado,   setResultado]   = useState(null)
  const [fileError,   setFileError]   = useState(null)
  const [plantillaId, setPlantillaId] = useState('')   // plantilla a aplicar a todos los cursos importados
  const inputRef = useRef(null)

  const procesarArchivo = (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Solo se aceptan archivos Excel (.xlsx o .xls).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('El archivo supera el límite de 10 MB.')
      return
    }
    setFileError(null)
    setArchivo(file)
    setEstado('parsing')
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        const rows = json.map(mapRow).map(validarFila)
        setFilas(rows)
        setEstado('preview')
      } catch {
        setFileError('No se pudo leer el archivo. Asegúrese de que sea un Excel válido.')
        setEstado('idle')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    procesarArchivo(e.dataTransfer.files[0])
  }

  const handleImportar = () => {
    const validas  = filas.filter(f => f._valido)
    const errores  = filas.length - validas.length
    const conWarns = validas.filter(f => Object.keys(f._advertencias).length > 0).length

    // Resolver plantillaId: primero por nombre en la fila Excel, luego por selector global
    const resolverPlantilla = (nombreFila) => {
      if (nombreFila) {
        const match = (plantillas ?? []).find(
          p => p.nombre.toLowerCase() === nombreFila.toLowerCase()
        )
        if (match) return match.id
      }
      return plantillaId || null
    }

    onImportar(validas.map(f => ({
      nombre:               f.nombre,
      codigoSence:          f.codigoSence,
      horas:                f.horas,
      condicion:            f.condicion,
      categorias:           f.categorias,
      estado:               f.estado,
      objetivos:            f.objetivos,
      contenidos:           f.contenidos,
      modalidad:            f.modalidad            ?? null,
      vigenciaMeses:        f.vigenciaMeses        ?? 12,
      precio:               f.precio               ?? null,
      porcentajeAsistencia: f.porcentajeAsistencia ?? null,
      porcentajeAprobacion: f.porcentajeAprobacion ?? null,
      plantillaId:          resolverPlantilla(f._plantillaNombre),
    })))
    setResultado({ importadas: validas.length, errores, conWarns })
    setEstado('done')
  }

  const validas  = filas.filter(f => f._valido).length
  const errCount = filas.length - validas

  return (
    <OverlayCard onClose={onClose}>
      {(close) => (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                Importar Cursos desde Excel
              </h2>
              {estado === 'preview' && (
                <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '3px 0 0' }}>
                  {archivo?.name} · <strong>{filas.length}</strong> filas detectadas ·{' '}
                  <span style={{ color: 'var(--success-600)' }}>{validas} válidas</span>
                  {errCount > 0 && <span style={{ color: 'var(--danger-500)' }}> · {errCount} con errores</span>}
                </p>
              )}
            </div>
            <button onClick={close} style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
            }}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

            {/* ── IDLE ── */}
            {estado === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? 'var(--brand-500)' : 'var(--border-strong)'}`,
                    borderRadius: 12, padding: '48px 24px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                    background: dragging ? 'var(--brand-50)' : 'var(--neutral-25)',
                    transition: 'all 150ms', textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: 58, height: 58, borderRadius: '50%',
                    background: dragging ? 'var(--brand-50)' : 'var(--neutral-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: dragging ? 'var(--brand-500)' : 'var(--neutral-400)', transition: 'all 150ms',
                  }}>
                    <Upload size={26} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>
                      Arrastre su archivo Excel aquí
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>
                      o haga clic para buscar en su equipo · máx. 10 MB
                    </div>
                  </div>
                  <input ref={inputRef} type="file" accept=".xlsx,.xls"
                    onChange={e => procesarArchivo(e.target.files[0])} style={{ display: 'none' }} />
                </div>

                {fileError && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--danger-50)', color: 'var(--danger-600)', fontSize: 13,
                  }}>
                    <AlertCircle size={15} strokeWidth={2} />{fileError}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--neutral-50)', fontSize: 13, color: 'var(--fg-3)',
                }}>
                  <span style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--fg-2)' }}>Columnas:</strong>{' '}
                    Nombre, Código SENCE, Horas, Condición, Modalidad, Categorías, Vigencia (meses), Precio,{' '}
                    <strong style={{ color: 'var(--brand-700)' }}>Asistencia mínima (%)</strong>,{' '}
                    <strong style={{ color: 'var(--brand-700)' }}>Aprobación mínima (%)</strong>,{' '}
                    Estado, Plantilla, Objetivos, Contenidos
                  </span>
                  <Button variant="secondary" size="sm" icon={Download}
                    onClick={e => { e.stopPropagation(); descargarPlantillaExcel() }}>
                    Descargar plantilla
                  </Button>
                </div>
              </div>
            )}

            {/* ── PARSING ── */}
            {estado === 'parsing' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '48px 0' }}>
                <style>{`@keyframes otec-demo-spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  border: '3px solid var(--neutral-100)', borderTopColor: 'var(--brand-600)',
                  animation: 'otec-demo-spin 700ms linear infinite',
                }} />
                <span style={{ fontSize: 14, color: 'var(--fg-3)', fontWeight: 500 }}>Procesando archivo...</span>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {estado === 'preview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Selector de plantilla */}
                <div style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)', background: 'var(--neutral-25)',
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>
                      Plantilla de certificado
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
                      Se asignará a todos los cursos importados. Podés cambiarla curso por curso después.
                    </div>
                  </div>
                  <select
                    value={plantillaId}
                    onChange={e => setPlantillaId(e.target.value)}
                    style={{
                      height: 36, borderRadius: 8, border: '1px solid var(--border-default)',
                      padding: '0 10px', fontSize: 13, color: 'var(--fg-1)',
                      background: '#fff', cursor: 'pointer', minWidth: 220,
                    }}
                  >
                    <option value="">Plantilla por defecto (PDF)</option>
                    {(plantillas ?? []).map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)' }}>
                      {['#', 'Nombre', 'Código SENCE', 'Horas', 'Condición', 'Estado', 'Validez'].map(h => (
                        <th key={h} style={{
                          padding: '9px 12px', fontWeight: 600, color: 'var(--fg-3)',
                          textAlign: 'left', whiteSpace: 'nowrap',
                          letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => {
                      const tieneWarn = Object.keys(f._advertencias).length > 0
                      return (
                        <tr key={i} style={{
                          borderTop: '1px solid var(--border-subtle)',
                          background: f._valido ? (tieneWarn ? '#fffbeb' : '#fff') : 'var(--danger-50)',
                        }}>
                          <td style={{ padding: '8px 12px', color: 'var(--fg-4)' }}>{i + 1}</td>
                          <td style={{
                            padding: '8px 12px', fontWeight: 500,
                            color: f._errores.nombre ? 'var(--danger-500)' : 'var(--fg-1)',
                            maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{f.nombre || '—'}</td>
                          <td style={{
                            padding: '8px 12px', fontFamily: 'var(--font-mono)',
                            color: f._advertencias.codigoSence ? 'var(--warning-600)' : 'var(--fg-2)',
                          }}>
                            {f.codigoSence || '—'}
                            {f._advertencias.codigoSence && (
                              <AlertTriangle size={11} strokeWidth={2} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                            )}
                          </td>
                          <td style={{
                            padding: '8px 12px',
                            color: f._errores.horas ? 'var(--danger-500)' : 'var(--fg-2)',
                          }}>{f.horas || '—'}</td>
                          <td style={{
                            padding: '8px 12px',
                            color: f._errores.condicion ? 'var(--danger-500)' : 'var(--fg-2)',
                          }}>{f.condicion || '—'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--fg-2)' }}>{f.estado}</td>
                          <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                            <Badge variant={f._valido ? (tieneWarn ? 'warning' : 'success') : 'danger'}>
                              {f._valido ? (tieneWarn ? 'Advertencia' : 'Válido') : 'Error'}
                            </Badge>
                            {!f._valido && (
                              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {Object.values(f._errores).map((msg, i) => (
                                  <span key={i} style={{ fontSize: 11, color: 'var(--danger-600)', lineHeight: 1.4 }}>· {msg}</span>
                                ))}
                              </div>
                            )}
                            {f._valido && tieneWarn && (
                              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {Object.values(f._advertencias).map((msg, i) => (
                                  <span key={i} style={{ fontSize: 11, color: 'var(--warning-600)', lineHeight: 1.4 }}>· {msg}</span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            )}

            {/* ── DONE ── */}
            {estado === 'done' && resultado && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 16, padding: '40px 0', textAlign: 'center',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'var(--success-50)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--success-500)',
                }}>
                  <CheckCircle2 size={32} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>
                    Importación completada
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                    <strong style={{ color: 'var(--success-600)' }}>{resultado.importadas} cursos importados</strong>
                    {resultado.conWarns > 0 && <span> · {resultado.conWarns} con advertencias de código SENCE</span>}
                    {resultado.errores > 0   && <span style={{ color: 'var(--danger-500)' }}> · {resultado.errores} omitidos por errores</span>}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10, padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            {estado === 'idle' && (
              <Button variant="ghost" size="md" onClick={close}>Cancelar</Button>
            )}
            {estado === 'preview' && (
              <>
                <Button variant="ghost" size="md" onClick={() => { setEstado('idle'); setArchivo(null) }}>
                  Cancelar
                </Button>
                <Button variant="primary" size="md" onClick={handleImportar} disabled={validas === 0}>
                  Importar {validas} registro{validas !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {estado === 'done' && (
              <Button variant="primary" size="md" onClick={close}>Cerrar</Button>
            )}
          </div>
        </>
      )}
    </OverlayCard>
  )
}
