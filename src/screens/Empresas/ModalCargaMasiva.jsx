// Modal de importación masiva de empresas desde Excel.
// Muestra una previsualización antes de confirmar para que el usuario pueda revisar los datos.
import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react'
import Button from '../../components/atoms/Button'
import Badge  from '../../components/atoms/Badge'
import { validarRut, formatearRut, descargarPlantilla } from './utils'

/* ── helpers ── */
function mapRow(row) {
  return {
    nombre:   String(row['Nombre de la Empresa'] ?? row['Razón Social'] ?? '').trim().toUpperCase(),
    rut:      formatearRut(String(row['RUT'] ?? '').trim()),
    contacto: String(row['Contacto']     ?? '').trim(),
    email:    String(row['Email']        ?? '').trim(),
    telefono: String(row['Teléfono']     ?? '').trim(),
    region:   String(row['Región']       ?? '').trim(),
    estado:   String(row['Estado']       ?? 'Activa').trim(),
  }
}

function validarFila(row) {
  const errs = {}
  if (!row.nombre)                           errs.nombre = 'Nombre requerido'
  if (!row.rut || !validarRut(row.rut))      errs.rut    = 'RUT inválido (ej: 12.345.678-9)'
  if (!row.email || !row.email.includes('@')) errs.email  = 'Email inválido'
  return { ...row, _valido: Object.keys(errs).length === 0, _errores: errs }
}

/* ── sub-components ── */
function OverlayCard({ children, maxWidth = 860, onClose }) {
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
        position: 'fixed', inset: 0,
        background: 'rgba(15,27,71,0.40)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--modal-pad)',
        opacity: vis ? 1 : 0,
        transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: vis ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {children(close)}
      </div>
    </div>
  )
}

/* ── main component ── */
export default function ModalCargaMasiva({ onClose, onImportar, empresasExistentes = [] }) {
  const [estado,   setEstado]   = useState('idle')  // idle | parsing | preview | done
  const [archivo,  setArchivo]  = useState(null)
  const [dragging, setDragging] = useState(false)
  const [filas,    setFilas]    = useState([])
  const [resultado, setResultado] = useState(null)
  const [fileError, setFileError] = useState(null)
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
    e.preventDefault()
    setDragging(false)
    procesarArchivo(e.dataTransfer.files[0])
  }

  const handleImportar = () => {
    const rutsDup   = new Set(empresasExistentes.map(e => e.rut))
    const validas   = filas.filter(f => f._valido)
    const aNoimp    = validas.filter(f => rutsDup.has(f.rut))
    const aImportar = validas.filter(f => !rutsDup.has(f.rut))
    const errores   = filas.length - validas.length

    onImportar(aImportar)
    setResultado({ importadas: aImportar.length, duplicados: aNoimp.length, errores })
    setEstado('done')
  }

  const validas  = filas.filter(f => f._valido).length
  const errCount = filas.length - validas

  return (
    <OverlayCard maxWidth={860} onClose={onClose}>
      {(close) => (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                Carga Masiva desde Excel
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
                    borderRadius: 12,
                    padding: '48px 24px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                    background: dragging ? 'var(--brand-50)' : 'var(--neutral-25)',
                    transition: 'all 150ms',
                    textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: 58, height: 58, borderRadius: '50%',
                    background: dragging ? 'var(--accent-mint-50)' : 'var(--neutral-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: dragging ? 'var(--accent-mint-500)' : 'var(--neutral-400)',
                    transition: 'all 150ms',
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
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={e => procesarArchivo(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                </div>

                {fileError && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center',
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--danger-50)', color: 'var(--danger-600)', fontSize: 13,
                  }}>
                    <AlertCircle size={15} strokeWidth={2} />
                    {fileError}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--neutral-50)', fontSize: 13, color: 'var(--fg-3)',
                }}>
                  <span style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--fg-2)' }}>Columnas requeridas:</strong>{' '}
                    Nombre de la Empresa, RUT, Contacto, Email, Teléfono, Región, Estado
                  </span>
                  <Button variant="secondary" size="sm" icon={Download} onClick={(e) => { e.stopPropagation(); descargarPlantilla() }}>
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
                  border: '3px solid var(--neutral-100)',
                  borderTopColor: 'var(--brand-600)',
                  animation: 'otec-demo-spin 700ms linear infinite',
                }} />
                <span style={{ fontSize: 14, color: 'var(--fg-3)', fontWeight: 500 }}>
                  Procesando archivo...
                </span>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {estado === 'preview' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)' }}>
                      {['#', 'Nombre de la Empresa', 'RUT', 'Contacto', 'Email', 'Estado', 'Validez'].map(h => (
                        <th key={h} style={{
                          padding: '9px 12px', fontWeight: 600, color: 'var(--fg-3)',
                          textAlign: 'left', whiteSpace: 'nowrap',
                          letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} style={{
                        borderTop: '1px solid var(--border-subtle)',
                        background: f._valido ? '#fff' : 'var(--danger-50)',
                      }}>
                        <td style={{ padding: '8px 12px', color: 'var(--fg-4)' }}>{i + 1}</td>
                        <td style={{
                          padding: '8px 12px', fontWeight: 500,
                          color: f._errores.nombre ? 'var(--danger-500)' : 'var(--fg-1)',
                          maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{f.nombre || '—'}</td>
                        <td style={{
                          padding: '8px 12px', fontFamily: 'var(--font-mono)',
                          color: f._errores.rut ? 'var(--danger-500)' : 'var(--fg-2)',
                        }}>{f.rut || '—'}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--fg-2)' }}>{f.contacto || '—'}</td>
                        <td style={{
                          padding: '8px 12px',
                          color: f._errores.email ? 'var(--danger-500)' : 'var(--fg-2)',
                        }}>{f.email || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{f.estado}</td>
                        <td style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          <Badge variant={f._valido ? 'success' : 'danger'}>
                            {f._valido ? 'Válido' : 'Error'}
                          </Badge>
                          {!f._valido && (
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {Object.values(f._errores).map((msg, i) => (
                                <span key={i} style={{ fontSize: 11, color: 'var(--danger-600)', lineHeight: 1.4 }}>
                                  · {msg}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    <strong style={{ color: 'var(--success-600)' }}>{resultado.importadas} empresas importadas</strong>
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
            gap: 10, padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            {estado === 'idle' && (
              <Button variant="ghost" size="md" onClick={close}>Cancelar</Button>
            )}
            {estado === 'preview' && (
              <>
                <Button variant="ghost"   size="md" onClick={() => { setEstado('idle'); setArchivo(null) }}>
                  Cancelar
                </Button>
                <Button
                  variant="primary" size="md"
                  onClick={handleImportar}
                  disabled={validas === 0}
                >
                  Importar {validas} registro{validas !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {estado === 'done' && (
              <>
                <Button variant="ghost"   size="md" onClick={close}>Ver empresas importadas</Button>
                <Button variant="primary" size="md" onClick={close}>Cerrar</Button>
              </>
            )}
          </div>
        </>
      )}
    </OverlayCard>
  )
}
