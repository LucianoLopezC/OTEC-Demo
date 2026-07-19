// Utilidades del módulo de emisión: generación de códigos, cálculo de estado,
// formateo de RUT y descarga de plantillas Excel.
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// Genera un código con formato CERT-YYYY-XXXX-0000. La I y la O se omiten del alfabeto
// para evitar confusión visual con 1 y 0.
export function generarCodigoCertificado() {
  const anio  = new Date().getFullYear()
  const letras = Array.from({ length: 4 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]
  ).join('')
  const nums = String(Math.floor(Math.random() * 9000) + 1000)
  return `CERT-${anio}-${letras}-${nums}`
}

// Igual que el anterior pero verifica que no colisione con certificados ya existentes.
// El límite de 100 intentos es una guardia de seguridad — en la práctica nunca lo alcanza.
export function generarCodigoUnico(certificadosExistentes = []) {
  let codigo
  let intentos = 0
  do {
    codigo = generarCodigoCertificado()
    intentos++
  } while (
    certificadosExistentes.some(c => c.codigoCertificado === codigo) &&
    intentos < 100
  )
  return codigo
}

export function limpiarParaNombre(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 30)
}

// Tope de caracteres para el nombre del curso dentro del nombre de archivo del
// certificado emitido: cursos con nombres muy largos quedan truncados por el
// explorador/navegador y no se alcanza a leer nada útil.
const MAX_CURSO_NOMBRE_ARCHIVO = 30

export function nombreArchivoCert(empresa, curso, participante) {
  const limpio = s => (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const cursoLimpio = limpio(curso)
  const cursoCorto  = cursoLimpio.length > MAX_CURSO_NOMBRE_ARCHIVO
    ? cursoLimpio.slice(0, MAX_CURSO_NOMBRE_ARCHIVO).replace(/\s+\S*$/, '')
    : cursoLimpio
  return `${limpio(empresa)} ${cursoCorto} - ${limpio(participante)}`
}

// Devuelve 'Pendiente' si alguno de los dos campos está vacío o no es número.
// minAsistencia y minAprobacion vienen del curso; los defaults (75/60) aplican si no están configurados.
export function calcularEstado(asistencia, evaluacion, minAsistencia = 75, minAprobacion = 60) {
  if (asistencia === '' || asistencia === null || asistencia === undefined) return 'Pendiente'
  if (evaluacion  === '' || evaluacion  === null || evaluacion  === undefined) return 'Pendiente'
  const a = Number(asistencia)
  const e = Number(evaluacion)
  if (isNaN(a) || isNaN(e)) return 'Pendiente'
  return a >= minAsistencia && e >= minAprobacion ? 'Aprobado' : 'Reprobado'
}

export function fmtFecha(f) {
  if (!f) return ''
  if (f.includes('/')) return f
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

export function validarRutPersona(rut) {
  return rut.trim().length >= 5 && rut.includes('-')
}

export function formatearRut(value) {
  const clean = value.replace(/[^0-9kK]/g, '')
  if (clean.length <= 1) return clean.toUpperCase()
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1).toUpperCase()
  let fmt = '', count = 0
  for (let i = body.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) fmt = '.' + fmt
    fmt = body[i] + fmt
    count++
  }
  return `${fmt}-${dv}`
}

// Genera y descarga el Excel de plantilla para emisión masiva.
// El archivo incluye ejemplos de 3 grupos distintos (curso + empresa + fecha)
// para que el usuario entienda cómo agrupar las filas.
export function descargarPlantillaEmisionMasiva() {
  const wb = XLSX.utils.book_new()

  // Una sola hoja: tabla plana — una fila por participante.
  // El sistema agrupa automáticamente por (Curso + Empresa + Fecha Inicio).
  const ws = XLSX.utils.aoa_to_sheet([
    [
      'Curso', 'Empresa',
      'Fecha Inicio', 'Fecha Término', 'Lugar de Ejecución', 'Condición', 'Fecha de Emisión',
      'Nombre', 'RUT', 'Email', 'Asistencia', 'Evaluación',
    ],
    // ── Grupo 1: Inducción / Empresa Uno ───────────────────────────────────────
    ['Curso Ejemplo de Inducción Hombre Nuevo',        'EMPRESA EJEMPLO UNO SPA',  '05/05/2026', '05/05/2026', 'Instalaciones Cliente, Santiago',       'TEÓRICO',            '06/05/2026', 'Persona Ejemplo Uno',   '11.111.111-1', 'correoejemplo1@ejemplo.cl', 100, 85],
    ['Curso Ejemplo de Inducción Hombre Nuevo',        'EMPRESA EJEMPLO UNO SPA',  '05/05/2026', '05/05/2026', 'Instalaciones Cliente, Santiago',       'TEÓRICO',            '06/05/2026', 'Persona Ejemplo Dos',   '22.222.222-2', 'correoejemplo2@ejemplo.cl',  80, 70],
    ['Curso Ejemplo de Inducción Hombre Nuevo',        'EMPRESA EJEMPLO UNO SPA',  '05/05/2026', '05/05/2026', 'Instalaciones Cliente, Santiago',       'TEÓRICO',            '06/05/2026', 'Persona Ejemplo Tres',  '33.333.333-3', 'correoejemplo3@ejemplo.cl',  60, 45],
    // ── Grupo 2: Primeros Auxilios / Empresa Dos ──────────────────────────────
    ['Curso Ejemplo de Primeros Auxilios Básicos',     'EMPRESA EJEMPLO DOS LTDA', '10/05/2026', '11/05/2026', 'Dependencias Empresa, Antofagasta',     'TEÓRICO - PRÁCTICO', '12/05/2026', 'Persona Ejemplo Cuatro','44.444.444-4', 'correoejemplo4@ejemplo.cl', 100, 90],
    ['Curso Ejemplo de Primeros Auxilios Básicos',     'EMPRESA EJEMPLO DOS LTDA', '10/05/2026', '11/05/2026', 'Dependencias Empresa, Antofagasta',     'TEÓRICO - PRÁCTICO', '12/05/2026', 'Persona Ejemplo Cinco', '55.555.555-5', 'correoejemplo5@ejemplo.cl',  75, 62],
    // ── Grupo 3: Trabajo en Altura / Empresa Tres ─────────────────────────────
    ['Curso Ejemplo de Trabajo en Altura Nivel Básico','EMPRESA EJEMPLO TRES SA',  '15/05/2026', '16/05/2026', 'Faena Minera, Región de Atacama',       'TEÓRICO - PRÁCTICO', '17/05/2026', 'Persona Ejemplo Uno',   '11.111.111-1', 'correoejemplo1@ejemplo.cl', 100, 95],
    ['Curso Ejemplo de Trabajo en Altura Nivel Básico','EMPRESA EJEMPLO TRES SA',  '15/05/2026', '16/05/2026', 'Faena Minera, Región de Atacama',       'TEÓRICO - PRÁCTICO', '17/05/2026', 'Persona Ejemplo Seis',  '66.666.666-6', 'correoejemplo6@ejemplo.cl',  80, 65],
  ])

  ws['!cols'] = [
    { wch: 52 }, // Curso
    { wch: 28 }, // Empresa
    { wch: 14 }, // Fecha Inicio
    { wch: 14 }, // Fecha Término
    { wch: 40 }, // Lugar de Ejecución
    { wch: 22 }, // Condición
    { wch: 16 }, // Fecha de Emisión
    { wch: 28 }, // Nombre
    { wch: 16 }, // RUT
    { wch: 30 }, // Email
    { wch: 12 }, // Asistencia
    { wch: 12 }, // Evaluación
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Emisión Masiva')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buf], { type: 'application/octet-stream' }),
    'plantilla-emision-masiva-demo.xlsx',
  )
}

export function descargarPlantillaPersonas() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre', 'RUT', 'Email', 'Asistencia', 'Evaluación'],
    ['Participante Ejemplo', '11.111.111-1', 'participante@ejemplo.cl', 100, 85],
  ])
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'plantilla-participantes-demo.xlsx')
}
