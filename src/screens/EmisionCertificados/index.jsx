// Pantalla principal de emisión de certificados.
// Wizard de 2 pasos: Paso 1 define el curso/empresa/fechas, Paso 2 gestiona los participantes.
// Al emitir genera un PDF por participante, los empaqueta en ZIP, sube el snapshot al servidor
// y registra el lote en la BD con un folio único.
import { useState, useCallback, useEffect } from 'react'
import { Award, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react'
import { saveAs } from 'file-saver'
import Stepper            from '../../components/atoms/Stepper'
import Badge              from '../../components/atoms/Badge'
import Button             from '../../components/atoms/Button'
import Paso1Datos         from './Paso1Datos'
import Paso2Participantes from './Paso2Participantes'
import ModalEmisionMasiva from './ModalEmisionMasiva'
import { generarPDF, generarPDFDesdeDocx, generarPDFPropio } from './generarPDF'
import { generarCertificadoDocx, construirDatosPlantilla } from './generarDocx'
import { generarYDescargarZip, crearZipBlob, fusionarZips } from './generarZip'
import { generarCodigoCertificado, limpiarParaNombre, calcularEstado, nombreArchivoCert } from './utils'
import { useApp }  from '../../context/AppContext'
import {
  obtenerFolioNuevo,
  generarCodigosServidor, descargarPlantillaDocx,
} from '../../services/supabase'

const getDatosInicial = () => {
  const hoy = new Date().toISOString().slice(0, 10)
  const finValidez = (() => { const d = new Date(hoy); d.setMonth(d.getMonth() + 12); return d.toISOString().slice(0, 10) })()
  return {
    cursoId: '', cursoNombre: '', empresaId: '', empresaNombre: '',
    codigoSence: '', horas: '', fechaInicio: hoy, fechaTermino: hoy,
    lugarEjecucion: '', condicion: 'TEÓRICO - PRÁCTICO', modalidad: '',
    fechaEmision: hoy, fechaFinValidez: finValidez, estado: 'Activo',
    contenidos: '', vigenciaMeses: 12,
    porcentajeAsistencia: 75, porcentajeAprobacion: 60,
  }
}

/* ── Toast ── */
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

/* ── Progress overlay ── */
function ProgressOverlay({ progreso }) {
  const pct    = progreso.total > 0 ? (progreso.actual / progreso.total) * 100 : 0
  const esMulti = (progreso.lotesTotal ?? 1) > 1
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.55)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <style>{`@keyframes otec-demo-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16, padding: '36px clamp(20px, 6vw, 48px)',
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.25)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        width: 480, maxWidth: '90vw',
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '4px solid var(--neutral-100)', borderTopColor: 'var(--brand-600)', animation: 'otec-demo-spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)' }}>
          Generando certificados...
        </div>
        {esMulti && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-600)', textAlign: 'center' }}>
            Lote {progreso.loteActual} de {progreso.lotesTotal}
            {progreso.cursoActual && (
              <div style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 400, marginTop: 2 }}>
                {progreso.cursoActual}
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
          {esMulti
            ? `Certificado ${progreso.actual} de ${progreso.total}`
            : `Procesando ${progreso.actual} de ${progreso.total} participantes`}
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--neutral-100)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--brand-600)', borderRadius: 999, width: `${pct}%`, transition: 'width 200ms ease' }} />
        </div>
      </div>
    </div>
  )
}

/* ── Success screen ── */
function Exito({ datosCertificado, resultado, zipBlob, nombreZip, onNuevo, onPersonas, formato }) {
  const esMulti = (resultado.lotes?.length ?? 0) > 1
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)', padding: '48px 56px',
        maxWidth: esMulti ? 680 : 560, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: 20,
      }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-50)', color: 'var(--success-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={36} strokeWidth={1.5} />
        </div>

        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 8 }}>
            ¡Certificados generados exitosamente!
          </h2>
          {esMulti ? (
            <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.5 }}>
              Se generaron <strong>{resultado.aprobados}</strong> certificados en{' '}
              <strong>{resultado.lotes.length}</strong> lotes
            </p>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                Se generaron <strong>{resultado.aprobados + resultado.reprobados}</strong> certificados para:
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-600)', marginTop: 4 }}>
                {datosCertificado.cursoNombre}
              </p>
            </>
          )}
        </div>

        <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)' }} />

        {/* Badges single */}
        {!esMulti && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {resultado.folio && <Badge variant="brand" dot={false}>Folio: {resultado.folio}</Badge>}
            <Badge variant="success" dot={false}>{resultado.aprobados} Aprobados</Badge>
            {resultado.reprobados > 0 && <Badge variant="danger" dot={false}>{resultado.reprobados} Reprobados</Badge>}
          </div>
        )}

        {/* Resumen por lote (multi) */}
        {esMulti && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resultado.lotes.map((lote, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderRadius: 'var(--radius-md)', textAlign: 'left',
                background: lote.error ? 'var(--danger-50)' : 'var(--neutral-50)',
                border: `1px solid ${lote.error ? 'var(--danger-200)' : 'var(--border-subtle)'}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: lote.error ? 'var(--danger-700)' : 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lote.cursoNombre}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
                    {lote.empresaNombre}{lote.folio ? ` · Folio ${lote.folio}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  {lote.error
                    ? <Badge variant="danger" dot={false}>{lote.error}</Badge>
                    : <>
                        <Badge variant="success" dot={false}>{lote.aprobados} cert.</Badge>
                        {lote.reprobados > 0 && <Badge variant="neutral" dot={false}>{lote.reprobados} rep.</Badge>}
                      </>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)' }} />

        <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>
          Los certificados se generaron como archivos {(!esMulti && formato === 'word') ? 'Word (.docx)' : 'PDF'}
          {esMulti ? ' organizados en subcarpetas por lote dentro del ZIP' : ' dentro del ZIP'}.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {zipBlob && (
            <Button variant="primary" size="sm" icon={Download} onClick={() => saveAs(zipBlob, `${nombreZip}.zip`)}>
              Descargar ZIP nuevamente
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onNuevo}>Emitir nuevo certificado</Button>
          <Button variant="secondary" size="sm" onClick={onPersonas}>Ir a Personas</Button>
        </div>
      </div>
    </div>
  )
}

/* ── main ── */
export default function EmisionCertificados({ onNav }) {
  const {
    registrarCertificados,
    plantillas, cursos, crearLote, sesion,
  } = useApp()

  const [paso,              setPaso]              = useState(0)
  const [datosCertificado,  setDatosCertificado]  = useState(getDatosInicial())
  const [participantes,     setParticipantes]      = useState([])
  const [generando,         setGenerando]          = useState(false)
  const [progreso,          setProgreso]           = useState({ actual: 0, total: 0 })
  const [completado,        setCompletado]         = useState(false)
  const [resultado,         setResultado]          = useState({ aprobados: 0, reprobados: 0, folio: null })
  const [zipBlob,           setZipBlob]            = useState(null)
  const [nombreZip,         setNombreZip]          = useState('')
  const [toast,             setToast]              = useState(null)
  const [modalMasiva,       setModalMasiva]        = useState(false)
  const [formatoSalida,     setFormatoSalida]      = useState('pdf')  // 'pdf' | 'word'
  const [formatoUsado,      setFormatoUsado]       = useState('pdf')
  const [hasDraft,          setHasDraft]           = useState(false)

  useEffect(() => {
    if (localStorage.getItem('otec_demo_emision_draft')) setHasDraft(true)
  }, [])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const handleGuardarProgreso = useCallback(() => {
    try {
      localStorage.setItem('otec_demo_emision_draft', JSON.stringify({ datosCertificado, participantes, paso }))
      showToast('Progreso guardado correctamente')
    } catch {
      showToast('No se pudo guardar el progreso', 'error')
    }
  }, [datosCertificado, participantes, paso, showToast])

  const handleRestaurarDraft = useCallback(() => {
    try {
      const draft = JSON.parse(localStorage.getItem('otec_demo_emision_draft'))
      const datosGuardados = draft?.datosCertificado ?? draft
      if (datosGuardados)              setDatosCertificado(prev => ({ ...prev, ...datosGuardados }))
      if (draft?.participantes)        setParticipantes(draft.participantes)
      if (typeof draft?.paso === 'number') setPaso(draft.paso)
      showToast('Borrador restaurado')
    } catch {}
    setHasDraft(false)
  }, [showToast])

  const handleDescartarDraft = useCallback(() => {
    localStorage.removeItem('otec_demo_emision_draft')
    setHasDraft(false)
  }, [])

  const handleGenerar = async (datosParam, participantesParam) => {
    const d      = datosParam       ?? datosCertificado
    const ps     = participantesParam ?? participantes
    const formato = formatoSalida  // 'pdf' | 'word' (leído desde el estado del cierre)

    if (datosParam) setDatosCertificado(datosParam)

    const minA = d.porcentajeAsistencia ?? 75
    const minE = d.porcentajeAprobacion ?? 60
    const psValidos      = ps.filter(p => p._valido !== false)
    const aprobados      = psValidos.filter(p => calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Aprobado')
    const reprobados     = psValidos.filter(p => calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Reprobado')
    const todosConEstado = [...aprobados, ...reprobados]

    if (todosConEstado.length === 0) {
      showToast('No hay participantes con nota registrada para generar certificados', 'error')
      return
    }

    const curso = cursos.find(c => String(c.id) === String(d.cursoId) || c.nombre === d.cursoNombre)

    // Word requiere plantilla asignada; PDF siempre está disponible
    let plantilla = null
    if (formato === 'word') {
      plantilla = plantillas.find(p => String(p.id) === String(curso?.plantillaId))
      if (!plantilla) {
        showToast('El curso no tiene plantilla asignada. Asígnala en Gestión de Cursos para generar en Word.', 'error')
        return
      }
    }

    setGenerando(true)
    setProgreso({ actual: 0, total: todosConEstado.length })

    let folio = null
    try { folio = await obtenerFolioNuevo() } catch (e) {
      console.warn('No se pudo obtener folio:', e)
    }

    const archivos = []
    const certs    = []
    const codigosGenerados   = await generarCodigosServidor(todosConEstado.length)
    const datosConContenidos = { ...d, contenidos: d.contenidos || curso?.contenidos || '' }

    // Descargar plantilla solo para Word
    let plantillaBuffer = null
    if (formato === 'word' && plantilla) {
      try {
        const blob = await descargarPlantillaDocx(plantilla.storagePath)
        plantillaBuffer = await blob.arrayBuffer()
      } catch (e) {
        console.warn('No se pudo descargar la plantilla:', e)
        showToast('No se pudo descargar la plantilla Word. Intente nuevamente.', 'error')
        setGenerando(false)
        return
      }
    }

    const ext      = formato === 'word' ? 'docx' : 'pdf'
    const mimeType = formato === 'word'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf'

    for (let i = 0; i < todosConEstado.length; i++) {
      const p      = todosConEstado[i]
      const codigo = codigosGenerados[i] || generarCodigoCertificado()
      const est    = calcularEstado(p.asistencia, p.evaluacion, minA, minE)
      certs.push({ participante: p, codigo, estado: est })

      try {
        let fileBuffer
        if (formato === 'word') {
          const datosPlt = construirDatosPlantilla({ datos: datosConContenidos, participante: p, folio: codigo, curso })
          const docxBlob = generarCertificadoDocx(plantillaBuffer, datosPlt)
          fileBuffer = await docxBlob.arrayBuffer()
        } else {
          // PDF: siempre usa la plantilla propia (no depende de DOCX)
          try {
            fileBuffer = await generarPDFPropio(p, datosConContenidos, codigo)
          } catch (e) {
            console.warn(`PDF propio falló para ${p.nombre}, usando fallback:`, e)
            fileBuffer = await generarPDF(p, datosConContenidos, codigo, null)
          }
        }
        archivos.push({ nombre: `${nombreArchivoCert(d.empresaNombre, d.cursoNombre, p.nombre || `participante_${i}`)}.${ext}`, blob: new Blob([fileBuffer], { type: mimeType }) })
      } catch (err) {
        console.error(`Error generando certificado para ${p.nombre}:`, err)
      }

      setProgreso({ actual: i + 1, total: aprobados.length })
    }

    const cursoCorto    = limpiarParaNombre(d.cursoNombre)
    const fecha         = new Date().toISOString().slice(0, 10)
    const zipNombre     = `certificados-${cursoCorto}-${folio || fecha}`
    const zipBlobResult = await generarYDescargarZip(archivos, zipNombre)

    try {
      await crearLote({
        folio,
        cursoId:           curso?.id ?? d.cursoId,
        plantillaId:       plantilla?.id ?? curso?.plantillaId ?? null,
        tipoCertificado:   plantilla?.tipo || 'Aprobación',
        cantidadEmitida:   todosConEstado.length,
        participantesIds:  todosConEstado.map(p => p.id).filter(Boolean),
        participantesData: [...aprobados, ...reprobados].map(p => ({
          nombre:     p.nombre     ?? '',
          rut:        p.rut        ?? '',
          email:      p.email      ?? '',
          asistencia: p.asistencia ?? '',
          evaluacion: p.evaluacion ?? '',
          estado:     calcularEstado(p.asistencia, p.evaluacion, minA, minE),
        })),
        storagePath:  null,
        emitidoPorId: sesion?.usuario?.id ?? null,
      })
    } catch (e) {
      console.error('Error al registrar lote:', e)
      showToast(`El lote no se registró: ${e?.message ?? e}`, 'error')
    }

    try {
      await registrarCertificados(d, certs, [], folio)
    } catch (e) {
      console.error('Error al registrar certificados:', e)
      showToast(`Los certificados no se guardaron en la BD: ${e?.message ?? e}`, 'error')
    }

    localStorage.removeItem('otec_demo_emision_draft')
    setFormatoUsado(formato)
    setZipBlob(zipBlobResult)
    setNombreZip(zipNombre)
    setResultado({ aprobados: aprobados.length, reprobados: reprobados.length, folio })
    setGenerando(false)
    setCompletado(true)
  }

  /* ── Generación multi-lote (emisión masiva Excel) ── */
  const handleGenerarMultiple = async (grupos) => {
    const gruposValidos = grupos.filter(g => g.errores.length === 0)
    if (gruposValidos.length === 0) {
      showToast('No hay grupos válidos para generar', 'error')
      return
    }

    const totalConEstado = gruposValidos.reduce((sum, g) => {
      const mA = g.datosCurso.porcentajeAsistencia ?? 75
      const mE = g.datosCurso.porcentajeAprobacion ?? 60
      return sum + g.participantes.filter(
        p => p._valido && calcularEstado(p.asistencia, p.evaluacion, mA, mE) !== 'Pendiente'
      ).length
    }, 0)

    if (totalConEstado === 0) {
      showToast('No hay participantes con nota registrada en ningún grupo', 'error')
      return
    }

    setGenerando(true)
    setProgreso({ actual: 0, total: totalConEstado, loteActual: 1, lotesTotal: gruposValidos.length, cursoActual: gruposValidos[0]?.cursoNombre ?? '' })

    // Guardamos solo los mini-ZIPs ya comprimidos (mucho más liviano que acumular
    // todos los .docx individuales). Así la RAM pico = un lote a la vez + mini-ZIPs.
    const miniZips        = []
    const resultadosLotes = []
    let aprobadosTotal  = 0
    let reprobadosTotal = 0

    for (let gi = 0; gi < gruposValidos.length; gi++) {
      const g  = gruposValidos[gi]
      const d  = g.datosCurso
      const ps = g.participantes

      setProgreso(p => ({ ...p, loteActual: gi + 1, cursoActual: g.cursoNombre }))

      const minA = d.porcentajeAsistencia ?? 75
      const minE = d.porcentajeAprobacion ?? 60
      const psValidos  = ps.filter(p => p._valido !== false)
      const aprobados      = psValidos.filter(p => calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Aprobado')
      const reprobados     = psValidos.filter(p => calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Reprobado')
      const todosConEstado = [...aprobados, ...reprobados]

      if (todosConEstado.length === 0) {
        resultadosLotes.push({ cursoNombre: g.cursoNombre, empresaNombre: g.empresaNombre, aprobados: 0, reprobados: reprobados.length, folio: null, error: 'Sin participantes calificados' })
        continue
      }

      const curso     = cursos.find(c => String(c.id) === String(d.cursoId) || c.nombre === d.cursoNombre)
      const plantilla = plantillas.find(p => String(p.id) === String(curso?.plantillaId))

      let folio = null
      try { folio = await obtenerFolioNuevo() } catch {}

      const carpeta       = `Lote-${String(gi + 1).padStart(2, '0')}-${limpiarParaNombre(g.cursoNombre)}`
      const archivosGrupo = []
      const certs         = []

      const codigosLote = await generarCodigosServidor(todosConEstado.length)
      const datosConContenidos = { ...d, contenidos: d.contenidos || curso?.contenidos || '' }

      let plantillaBufferGrupo = null
      if (plantilla) {
        try {
          const blob = await descargarPlantillaDocx(plantilla.storagePath)
          plantillaBufferGrupo = await blob.arrayBuffer()
        } catch (e) {
          console.warn('No se pudo descargar la plantilla del lote, se usará plantilla por defecto:', e)
        }
      }

      for (let i = 0; i < todosConEstado.length; i++) {
        const p      = todosConEstado[i]
        const codigo = codigosLote[i] || generarCodigoCertificado()
        const est    = calcularEstado(p.asistencia, p.evaluacion, minA, minE)
        certs.push({ participante: p, codigo, estado: est })
        try {
          let pdfBuffer
          if (plantillaBufferGrupo) {
            try {
              const datosPlt = construirDatosPlantilla({ datos: datosConContenidos, participante: p, folio: codigo, curso })
              const docxBlob = generarCertificadoDocx(plantillaBufferGrupo, datosPlt)
              pdfBuffer = await generarPDFDesdeDocx(docxBlob)
            } catch (e) {
              console.warn(`DOCX→PDF falló para ${p.nombre}, usando template propio:`, e)
              pdfBuffer = await generarPDFPropio(p, datosConContenidos, codigo)
            }
          } else {
            pdfBuffer = await generarPDFPropio(p, datosConContenidos, codigo)
          }
          archivosGrupo.push({ nombre: `${nombreArchivoCert(g.empresaNombre, g.cursoNombre, p.nombre || `participante_${i}`)}.pdf`, blob: new Blob([pdfBuffer], { type: 'application/pdf' }), carpeta })
        } catch (err) {
          console.error(`Error generando cert para ${p.nombre}:`, err)
        }
        // Ceder el hilo cada 20 certs para que React actualice la barra de progreso
        if (i % 20 === 19) await new Promise(r => setTimeout(r, 0))
        setProgreso(prev => ({ ...prev, actual: prev.actual + 1 }))
      }

      // Crear mini-ZIP del lote (ya incluye la subcarpeta interna)
      let miniZipBlob = null
      if (archivosGrupo.length > 0) {
        try { miniZipBlob = await crearZipBlob(archivosGrupo) } catch {}
      }

      // Guardar el mini-ZIP para el ZIP combinado final; los blobs individuales
      // (archivosGrupo) quedan fuera de scope y el GC puede liberarlos.
      if (miniZipBlob) miniZips.push(miniZipBlob)

      // Registrar lote
      try {
        await crearLote({
          folio,
          cursoId:           curso?.id ?? d.cursoId,
          plantillaId:       plantilla?.id ?? curso?.plantillaId ?? null,
          tipoCertificado:   plantilla?.tipo || 'Aprobación',
          cantidadEmitida:   todosConEstado.length,
          participantesIds:  todosConEstado.map(p => p.id).filter(Boolean),
          participantesData: [...aprobados, ...reprobados].map(p => ({
            nombre: p.nombre ?? '', rut: p.rut ?? '', email: p.email ?? '',
            asistencia: p.asistencia ?? '', evaluacion: p.evaluacion ?? '',
            estado: calcularEstado(p.asistencia, p.evaluacion, minA, minE),
          })),
          storagePath:  null,
          emitidoPorId: sesion?.usuario?.id ?? null,
        })
      } catch (e) { console.error('Error al registrar lote:', e) }

      try {
        await registrarCertificados(d, certs, [], folio)
      } catch (e) {
        console.error('Error al registrar certificados:', e)
        showToast(`Los certificados del lote ${folio} no se guardaron: ${e?.message ?? e}`, 'error')
      }

      aprobadosTotal  += aprobados.length
      reprobadosTotal += reprobados.length
      resultadosLotes.push({ cursoNombre: g.cursoNombre, empresaNombre: g.empresaNombre, aprobados: aprobados.length, reprobados: reprobados.length, folio })
    }

    // ZIP combinado: fusionar mini-ZIPs (evita recargar todos los .docx en memoria)
    const fecha     = new Date().toISOString().slice(0, 10)
    const zipNombre = `emision-masiva-${fecha}`

    let zipBlobResult = null
    if (miniZips.length === 1) {
      // Un solo lote válido: usar directamente su mini-ZIP
      zipBlobResult = miniZips[0]
      saveAs(zipBlobResult, `${zipNombre}.zip`)
    } else if (miniZips.length > 1) {
      // Varios lotes: fusionar en un único ZIP con subcarpetas
      zipBlobResult = await fusionarZips(miniZips, zipNombre)
    }

    localStorage.removeItem('otec_demo_emision_draft')
    setZipBlob(zipBlobResult)
    setNombreZip(zipNombre)
    setResultado({ aprobados: aprobadosTotal, reprobados: reprobadosTotal, folio: null, lotes: resultadosLotes })
    setGenerando(false)
    setCompletado(true)
  }

  const handleConfirmarMasiva = (grupos) => {
    setModalMasiva(false)
    handleGenerarMultiple(grupos)
  }

  const handleNuevo = () => {
    localStorage.removeItem('otec_demo_emision_draft')
    setPaso(0)
    setDatosCertificado(getDatosInicial())
    setParticipantes([])
    setCompletado(false)
    setZipBlob(null)
  }

  if (completado) {
    return (
      <Exito
        datosCertificado={datosCertificado}
        resultado={resultado}
        zipBlob={zipBlob}
        nombreZip={nombreZip}
        onNuevo={handleNuevo}
        onPersonas={() => onNav('personas')}
        formato={formatoUsado}
      />
    )
  }

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header + Stepper unificados */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>

        {/* Franja superior */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0,
              background: 'var(--brand-50)', color: 'var(--brand-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Award size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                Emitir Certificados
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--fg-3)', margin: '3px 0 0' }}>
                Complete el formulario paso a paso o use la emisión masiva por Excel.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="md" icon={FileSpreadsheet} onClick={() => setModalMasiva(true)}>
            Emisión Masiva (Excel)
          </Button>
        </div>

        {/* Stepper */}
        <Stepper steps={['Datos del Certificado', 'Participantes']} active={paso} />
      </div>

      {/* Banner borrador guardado */}
      {hasDraft && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--warning-50)', border: '1px solid var(--warning-400)',
          fontSize: 13, color: 'var(--fg-2)',
        }}>
          <span style={{ flex: 1, fontWeight: 500 }}>Tienes un borrador guardado. ¿Deseas cargarlo?</span>
          <Button variant="secondary" size="sm" onClick={handleRestaurarDraft}>Restaurar</Button>
          <Button variant="ghost"     size="sm" onClick={handleDescartarDraft}>Descartar</Button>
        </div>
      )}

      {/* Step content */}
      {paso === 0 && (
        <Paso1Datos
          datos={datosCertificado}
          setDatos={setDatosCertificado}
          onSiguiente={() => setPaso(1)}
          onGuardar={handleGuardarProgreso}
          showToast={showToast}
        />
      )}
      {paso === 1 && (
        <Paso2Participantes
          participantes={participantes}
          setParticipantes={setParticipantes}
          datosCertificado={datosCertificado}
          onAnterior={() => setPaso(0)}
          onGenerar={handleGenerar}
          formatoSalida={formatoSalida}
          onFormatoChange={setFormatoSalida}
        />
      )}

      {generando && <ProgressOverlay progreso={progreso} />}
      <Toast toast={toast} />

      {modalMasiva && (
        <ModalEmisionMasiva
          onClose={() => setModalMasiva(false)}
          onConfirmar={handleConfirmarMasiva}
        />
      )}
    </div>
  )
}
