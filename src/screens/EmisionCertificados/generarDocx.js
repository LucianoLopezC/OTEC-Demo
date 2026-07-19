// Genera certificados .docx usando docxtemplater (motor de plantillas Word).
// El flujo es: descargar el .docx plantilla → rellenar variables → devolver Blob para descarga o ZIP.
import Docxtemplater from 'docxtemplater'
import PizZip        from 'pizzip'
import { calcularEstado } from './utils'
import { fmtFechaLarga } from '../../utils/fecha'

// Convierte meses a texto legible: 12 → "1 año", 6 → "6 meses"
function fmtVigencia(meses) {
  if (!meses) return ''
  const m = Number(meses)
  if (m >= 12 && m % 12 === 0) {
    const a = m / 12
    return `${a} ${a === 1 ? 'año' : 'años'}`
  }
  return `${m} ${m === 1 ? 'mes' : 'meses'}`
}

/**
 * Genera un .docx rellenando la plantilla con los datos del participante.
 * @param {ArrayBuffer} plantillaBuffer - contenido del .docx plantilla
 * @param {Object}      datos           - variables a sustituir (resultado de construirDatosPlantilla)
 * @returns {Blob} .docx generado
 */
export function generarCertificadoDocx(plantillaBuffer, datos) {
  // Clonar el buffer para que PizZip no lo consuma en iteraciones sucesivas
  const zip = new PizZip(plantillaBuffer.slice(0))
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    nullGetter:    () => '',   // placeholder sin valor → cadena vacía
  })
  doc.render(datos)
  return doc.getZip().generate({
    type:        'blob',
    mimeType:    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
}

/**
 * Construye el objeto de variables que docxtemplater inyectará en la plantilla.
 * Todos los valores son strings listos para Word.
 *
 * Códigos disponibles en la plantilla:
 *   {curso_nombre}           {curso_codigo_sence}    {curso_horas}
 *   {curso_modalidad}        {curso_condicion}       {curso_vigencia}
 *   {curso_fecha_inicio}     {curso_fecha_termino}   {curso_lugar_ejecucion}
 *   {curso_contenidos}       {fecha_emision}         {folio}
 *   {alumno_nombre_completo} {alumno_rut}            {alumno_empresa}
 *   {alumno_cargo}           {nota_final}            {porcentaje_asistencia}
 *   {resultado}
 *
 * @param {{ datos: object, participante: object, folio: string|null, curso?: object }} param0
 * @returns {Record<string,string>}
 */
export function construirDatosPlantilla({ datos, participante, folio, curso }) {
  const nota = (n) =>
    (n != null && n !== '') ? String(n).replace('.', ',') : ''

  const aprobado =
    calcularEstado(participante.asistencia, participante.evaluacion, datos.porcentajeAsistencia ?? 75, datos.porcentajeAprobacion ?? 60) === 'Aprobado'

  return {
    // ── Datos del curso ──────────────────────────────────────────────────────
    curso_nombre:           datos.cursoNombre                                  || '',
    curso_codigo_sence:     datos.codigoSence                                  || '',
    curso_horas:            String(datos.horas                                 || ''),
    // Modalidad de ejecución: Presencial / Híbrido / Online
    curso_modalidad:        datos.modalidad          ?? curso?.modalidad        ?? '',
    // Condición pedagógica: Teórico-Práctico / E-Learning / etc.
    curso_condicion:        datos.condicion                                    || '',
    curso_fecha_inicio:     fmtFechaLarga(datos.fechaInicio),
    curso_fecha_termino:    fmtFechaLarga(datos.fechaTermino),
    curso_lugar_ejecucion:  datos.lugarEjecucion                               || '',
    // Vigencia formateada: "12 meses" ó "2 años"
    curso_vigencia:         fmtVigencia(datos.vigenciaMeses ?? curso?.vigenciaMeses),
    // Contenidos / temario del curso
    curso_contenidos:       datos.contenidos          ?? curso?.contenidos      ?? '',
    fecha_emision:          fmtFechaLarga(datos.fechaEmision || new Date().toISOString()),
    folio:                  folio                                              || '',
    codigo_certificado:     folio                                              || '',

    // ── Datos del participante ───────────────────────────────────────────────
    alumno_nombre_completo: participante.nombre                                || '',
    alumno_rut:             participante.rut                                   || '',
    alumno_empresa:         participante.empresa                               || '',
    alumno_cargo:           participante.cargo                                 || '',
    nota_final:             nota(participante.evaluacion) ? `${nota(participante.evaluacion)}%` : '',
    porcentaje_asistencia:  participante.asistencia != null
                              ? `${participante.asistencia}%` : '',
    resultado:              aprobado ? 'APROBADO' : 'REPROBADO',
  }
}

/**
 * Datos de ejemplo usados en la previsualización de plantillas.
 * Cubren todos los códigos disponibles con valores realistas.
 */
export const DATOS_EJEMPLO = {
  curso_nombre:           'Curso de Ejemplo 1',
  curso_codigo_sence:     '12-39-0000-00',
  curso_horas:            '00',
  curso_modalidad:        'Modalidad Ejemplo',
  curso_condicion:        'Condición Ejemplo',
  curso_fecha_inicio:     '01 de enero de 2026',
  curso_fecha_termino:    '01 de enero de 2026',
  curso_lugar_ejecucion:  'Lugar Ejemplo 1',
  curso_vigencia:         '12 meses',
  curso_contenidos:
    'Contenido 1\n' +
    '   - Ejemplo 1\n' +
    '   - Ejemplo 2\n' +
    'Contenido 2\n' +
    '   - Ejemplo 1\n' +
    '   - Ejemplo 2',
  fecha_emision:          '01 de enero de 2026',
  folio:                  'CERT-0000-EJEM-0000',
  codigo_certificado:     'CERT-0000-EJEM-0000',
  alumno_nombre_completo: 'Nombre Ejemplo 1',
  alumno_rut:             '11.111.111-1',
  alumno_empresa:         'Empresa Ejemplo 1',
  alumno_cargo:           'Cargo Ejemplo 1',
  nota_final:             '00%',
  porcentaje_asistencia:  '00%',
  resultado:              'APROBADO',
}
