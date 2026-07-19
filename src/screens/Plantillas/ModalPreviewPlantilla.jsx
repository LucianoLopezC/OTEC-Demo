// Vista previa de una plantilla .docx: rellena los datos de ejemplo, sube un archivo temporal
// al servidor y abre el visor de Microsoft Office Online para mostrarlo.
// Al cerrar el modal, elimina el archivo temporal del servidor.
import { useState, useEffect, useRef } from 'react'
import { X, Eye, AlertTriangle, Download, Info, ExternalLink } from 'lucide-react'
import { saveAs } from 'file-saver'
import Button from '../../components/atoms/Button'
import { descargarPlantillaDocx, subirPreviewTemp, eliminarPreviewTemp } from '../../services/supabase'
import { generarCertificadoDocx, DATOS_EJEMPLO } from '../EmisionCertificados/generarDocx'
import { useApp } from '../../context/AppContext'

/**
 * Previsualización de plantilla .docx con datos de ejemplo.
 *
 * EN PRODUCCIÓN (dominio público):
 *   1. Descarga la plantilla via PHP API
 *   2. La rellena con DATOS_EJEMPLO
 *   3. Sube el .docx relleno a /uploads/previews/ (carpeta pública)
 *   4. Pasa la URL pública al visor de Microsoft Office Online (iframe)
 *      → renderizado idéntico a Word: imágenes, encabezados, colores, todo
 *   5. Al cerrar, elimina el archivo temporal del servidor
 *
 * EN LOCAL (localhost / 127.0.0.1):
 *   Microsoft no puede alcanzar localhost. Se sube igual a XAMPP
 *   y se ofrece abrir directamente en Word via el esquema ms-word:
 *   (requiere Word instalado) + botón de descarga como respaldo.
 */

const isLocalhost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)

export default function ModalPreviewPlantilla({ plantilla, onClose }) {
  const { sesion } = useApp()
  const [estado,     setEstado]     = useState('cargando') // 'cargando' | 'viendo' | 'local' | 'error'
  const [error,      setError]      = useState(null)
  const [viewerUrl,  setViewerUrl]  = useState(null)  // URL del iframe MS viewer (producción)
  const [wordUrl,    setWordUrl]    = useState(null)   // URL ms-word: para abrir en local
  const [filledBlob, setFilledBlob] = useState(null)   // blob para descarga

  // Al desmontar → eliminar archivo temporal del servidor
  useEffect(() => {
    return () => { eliminarPreviewTemp() }
  }, [])

  // ── Carga principal ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false

    async function cargar() {
      try {
        // 1. Descargar la plantilla original
        const blob   = await descargarPlantillaDocx(plantilla.storagePath)
        const buffer = await blob.arrayBuffer()

        // 2. Rellenar con datos de ejemplo
        const filled = generarCertificadoDocx(buffer, DATOS_EJEMPLO)
        if (!cancelado) setFilledBlob(filled)

        // 3. Subir al servidor como archivo temporal público
        const userId    = sesion?.usuario?.id || 'guest'
        const publicUrl = await subirPreviewTemp(filled, userId)
        if (cancelado) return

        if (isLocalhost) {
          // 4a. Local: no se puede usar MS viewer (localhost no es público)
          //     Ofrecer abrir en Word con el esquema ms-word:
          const msWordScheme = `ms-word:ofe|u|${publicUrl}`
          setWordUrl(msWordScheme)
          setEstado('local')
        } else {
          // 4b. Producción: visor de Microsoft Office Online
          const msViewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`
          setViewerUrl(msViewer)
          setEstado('viendo')
        }

      } catch (e) {
        if (!cancelado) {
          setError(e?.message?.includes('tag')
            ? 'La plantilla tiene un código mal escrito. Corrígelo en Word y vuelve a subir el archivo.'
            : (e.message || 'Error desconocido al preparar la previsualización.'))
          setEstado('error')
        }
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [plantilla.storagePath]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDescargar = () => {
    if (filledBlob) saveAs(filledBlob, `preview-${plantilla.nombre}.docx`)
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.55)',
        zIndex: 130, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, width: '100%', maxWidth: 1040,
        height: '92vh', boxShadow: '0 28px 64px -12px rgba(15,27,71,0.30)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 22px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: 'var(--brand-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Eye size={17} style={{ color: 'var(--brand-600)' }} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--fg-1)' }}>
                Previsualización — {plantilla.nombre}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 1 }}>
                Motor de Word real · datos de ejemplo ingresados
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {filledBlob && (
              <Button variant="ghost" size="sm" icon={Download} onClick={handleDescargar}>
                Descargar .docx
              </Button>
            )}
            <button
              onClick={onClose}
              title="Cerrar"
              style={{
                width: 32, height: 32, border: 'none', borderRadius: 8,
                background: 'var(--neutral-100)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--fg-3)',
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── Cuerpo ── */}

        {/* Spinner de carga */}
        {estado === 'cargando' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            background: 'var(--neutral-50)',
          }}>
            <style>{`@keyframes prev-spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              border: '4px solid var(--neutral-200)', borderTopColor: 'var(--brand-600)',
              animation: 'prev-spin 0.8s linear infinite',
            }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4 }}>
                Preparando previsualización…
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                Rellenando datos de ejemplo y preparando el visor
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {estado === 'error' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 18,
            padding: 32, background: 'var(--neutral-50)',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', background: 'var(--danger-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={26} strokeWidth={1.75} style={{ color: 'var(--danger-500)' }} />
            </div>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>
                No se pudo cargar la previsualización
              </div>
              <div style={{
                fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.6,
                background: 'var(--danger-50)', border: '1px solid var(--danger-100)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                {error}
              </div>
            </div>
            {filledBlob && (
              <Button variant="secondary" size="sm" icon={Download} onClick={handleDescargar}>
                Descargar .docx con datos de ejemplo
              </Button>
            )}
          </div>
        )}

        {/* Local: abrir en Word */}
        {estado === 'local' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
            padding: 32, background: 'var(--neutral-50)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Eye size={28} strokeWidth={1.5} style={{ color: 'var(--brand-600)' }} />
            </div>

            <div style={{ textAlign: 'center', maxWidth: 460 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>
                Entorno local detectado
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.65 }}>
                El visor embebido requiere una URL pública para funcionar.
                En local, abre el archivo directamente en <strong>Microsoft Word</strong>
                para ver la previsualización exacta.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {/* Abrir en Word (ms-word: URI scheme) */}
              <a
                href={wordUrl}
                onClick={onClose}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'var(--brand-600)', color: '#fff', fontWeight: 600,
                  fontSize: 13.5, borderRadius: 9, padding: '10px 22px',
                  textDecoration: 'none', transition: 'background 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--brand-700)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--brand-600)'}
              >
                <ExternalLink size={15} strokeWidth={2} />
                Abrir en Word
              </a>

              {/* Descarga como respaldo */}
              <Button variant="ghost" size="sm" icon={Download} onClick={handleDescargar}>
                Descargar .docx
              </Button>
            </div>

            <div style={{
              fontSize: 11.5, color: 'var(--fg-4)', textAlign: 'center', maxWidth: 380,
              marginTop: 4,
            }}>
              En producción la previsualización se muestra embebida automáticamente.
            </div>
          </div>
        )}

        {/* Producción: visor Microsoft Office Online */}
        {estado === 'viendo' && (
          <>
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 9,
              padding: '8px 22px', background: 'var(--brand-50)',
              borderBottom: '1px solid var(--brand-100)', flexShrink: 0,
            }}>
              <Info size={13} style={{ color: 'var(--brand-600)', marginTop: 1.5, flexShrink: 0 }} strokeWidth={2} />
              <span style={{ fontSize: 11.5, color: 'var(--brand-700)', lineHeight: 1.5 }}>
                Vista generada por el visor de <strong>Microsoft Office Online</strong> — imágenes,
                encabezados, márgenes y colores se muestran exactamente igual que en Word.
              </span>
            </div>
            <iframe
              src={viewerUrl}
              title={`Previsualización de ${plantilla.nombre}`}
              style={{ flex: 1, border: 'none', width: '100%', display: 'block' }}
              allow="fullscreen"
            />
          </>
        )}
      </div>
    </div>
  )
}
