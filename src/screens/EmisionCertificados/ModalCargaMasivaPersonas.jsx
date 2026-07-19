// Modal para importar participantes de un Excel simple (Nombre, RUT, Email, Asistencia, Evaluación).
// Valida los RUTs y el estado de cada fila antes de agregar a la tabla de Paso 2.
import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, CheckCircle2, AlertCircle } from 'lucide-react'
import Button from '../../components/atoms/Button'
import Badge  from '../../components/atoms/Badge'
import { calcularEstado, validarRutPersona, formatearRut, descargarPlantillaPersonas } from './utils'

function mapRow(row) {
  return {
    nombre:     String(row['Nombre']     ?? '').trim(),
    rut:        formatearRut(String(row['RUT'] ?? '').trim()),
    email:      String(row['Email']      ?? '').trim(),
    asistencia: row['Asistencia'] !== undefined ? String(row['Asistencia']).trim() : '',
    evaluacion: row['Evaluación'] !== undefined ? String(row['Evaluación']).trim() : '',
  }
}

function validarFilaPersona(row) {
  const errs = {}
  if (!row.nombre)                 errs.nombre     = 'Nombre requerido'
  if (!validarRutPersona(row.rut)) errs.rut        = 'RUT inválido (debe incluir guión, ej: 12345678-9)'
  const a = Number(row.asistencia), e = Number(row.evaluacion)
  if (row.asistencia === '' || isNaN(a) || a < 0 || a > 100) errs.asistencia = 'Asistencia inválida (número entre 0 y 100)'
  if (row.evaluacion  === '' || isNaN(e) || e < 0 || e > 100) errs.evaluacion  = 'Evaluación inválida (número entre 0 y 100)'
  return { ...row, _valido: Object.keys(errs).length === 0, _errores: errs }
}

const ESTADO_BADGE = { Aprobado: 'success', Reprobado: 'danger', Pendiente: 'neutral' }

export default function ModalCargaMasivaPersonas({ onClose, onImportar, participantesExistentes = [], minAsistencia = 75, minAprobacion = 60 }) {
  const [estado,    setEstado]    = useState('idle')
  const [dragging,  setDragging]  = useState(false)
  const [filas,     setFilas]     = useState([])
  const [resultado, setResultado] = useState(null)
  const [fileError, setFileError] = useState(null)
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
        const wb   = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
        setFilas(json.map(mapRow).map(validarFilaPersona))
        setEstado('preview')
      } catch {
        setFileError('No se pudo leer el archivo.')
        setEstado('idle')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImportar = () => {
    const rutsDup   = new Set(participantesExistentes.map(p => p.rut))
    const validas   = filas.filter(f => f._valido)
    const duplicados = validas.filter(f => rutsDup.has(f.rut)).length
    const aImportar = validas.filter(f => !rutsDup.has(f.rut))
    onImportar(aImportar)
    setResultado({ importadas: aImportar.length, duplicados, errores: filas.length - validas.length })
    setEstado('done')
  }

  const validas  = filas.filter(f => f._valido).length
  const errCount = filas.length - validas

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
        width: '100%', maxWidth: 800, maxHeight: '90vh',
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
              Importar Participantes desde Excel
            </h2>
            {estado === 'preview' && (
              <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '3px 0 0' }}>
                <strong>{filas.length}</strong> filas ·{' '}
                <span style={{ color: 'var(--success-600)' }}>{validas} válidas</span>
                {errCount > 0 && <span style={{ color: 'var(--danger-500)' }}> · {errCount} errores</span>}
              </p>
            )}
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
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {estado === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); procesarArchivo(e.dataTransfer.files[0]) }}
                onClick={() => inputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--brand-500)' : 'var(--border-strong)'}`,
                  borderRadius: 12, padding: '40px 24px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  cursor: 'pointer', background: dragging ? 'var(--brand-50)' : 'var(--neutral-25)',
                  textAlign: 'center', transition: 'all 150ms',
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'var(--neutral-100)', color: 'var(--neutral-400)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={24} strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>
                    Arrastre su archivo Excel aquí
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                    o haga clic para seleccionar · máx. 10 MB
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
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', background: 'var(--neutral-50)', borderRadius: 'var(--radius-md)',
                fontSize: 13, color: 'var(--fg-3)',
              }}>
                <span style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--fg-2)' }}>Columnas requeridas:</strong>{' '}
                  Nombre, RUT, Email (opc.), Asistencia, Evaluación
                </span>
                <Button variant="secondary" size="sm" icon={Download}
                  onClick={e => { e.stopPropagation(); descargarPlantillaPersonas() }}>
                  Plantilla
                </Button>
              </div>
            </div>
          )}

          {estado === 'parsing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '40px 0' }}>
              <style>{`@keyframes otec-demo-spin { to { transform: rotate(360deg); } }`}</style>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid var(--neutral-100)', borderTopColor: 'var(--brand-600)',
                animation: 'otec-demo-spin 700ms linear infinite',
              }} />
              <span style={{ fontSize: 13, color: 'var(--fg-3)', fontWeight: 500 }}>Procesando archivo...</span>
            </div>
          )}

          {estado === 'preview' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)' }}>
                    {['#', 'Nombre', 'RUT', 'Asistencia', 'Evaluación', 'Estado', 'Validez'].map(h => (
                      <th key={h} style={{
                        padding: '9px 12px', fontWeight: 600, color: 'var(--fg-3)', textAlign: 'left',
                        whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => {
                    const est = calcularEstado(f.asistencia, f.evaluacion, minAsistencia, minAprobacion)
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', background: f._valido ? '#fff' : 'var(--danger-50)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--fg-4)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, color: f._errores.nombre ? 'var(--danger-500)' : 'var(--fg-1)' }}>{f.nombre || '—'}</td>
                        <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: f._errores.rut ? 'var(--danger-500)' : 'var(--fg-2)' }}>{f.rut || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: f._errores.asistencia ? 'var(--danger-500)' : 'var(--fg-2)' }}>{f.asistencia !== '' ? `${f.asistencia}%` : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: f._errores.evaluacion ? 'var(--danger-500)' : 'var(--fg-2)' }}>{f.evaluacion !== '' ? `${f.evaluacion}%` : '—'}</td>
                        <td style={{ padding: '8px 12px' }}><Badge variant={ESTADO_BADGE[est]}>{est}</Badge></td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <Badge variant={f._valido ? 'success' : 'danger'}>{f._valido ? 'Válido' : 'Error'}</Badge>
                          {!f._valido && (
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {Object.values(f._errores).map((msg, i) => (
                                <span key={i} style={{ fontSize: 11, color: 'var(--danger-600)', lineHeight: 1.4 }}>· {msg}</span>
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
          )}

          {estado === 'done' && resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '36px 0', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-500)' }}>
                <CheckCircle2 size={28} strokeWidth={1.75} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Importación completada</h3>
                <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                  <strong style={{ color: 'var(--success-600)' }}>{resultado.importadas} participantes importados</strong>
                  {resultado.duplicados > 0 && <span> · {resultado.duplicados} duplicados omitidos</span>}
                  {resultado.errores > 0    && <span> · {resultado.errores} errores</span>}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          {estado === 'idle'    && <Button variant="ghost" size="md" onClick={handleClose}>Cancelar</Button>}
          {estado === 'preview' && (
            <>
              <Button variant="ghost" size="md" onClick={() => setEstado('idle')}>Cancelar</Button>
              <Button variant="primary" size="md" onClick={handleImportar} disabled={validas === 0}>
                Importar {validas} registro{validas !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {estado === 'done' && <Button variant="primary" size="md" onClick={handleClose}>Cerrar</Button>}
        </div>
      </div>
    </div>
  )
}
