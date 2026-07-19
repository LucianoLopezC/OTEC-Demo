// Utilidades de Gestión de Cursos: exportar, importar desde Excel, validar formulario
// y gestionar categorías personalizadas (guardadas en localStorage del navegador).
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// Exporta el listado completo de cursos como Excel, incluyendo objetivos y contenidos.
export function exportarCursos(datos, nombre = 'cursos-demo') {
  const filas = datos.map(c => ({
    'Nombre':                  c.nombre,
    'Código SENCE':            c.codigoSence,
    'Horas':                   c.horas,
    'Condición':               c.condicion,
    'Modalidad':               c.modalidad ?? '',
    'Categorías':              (c.categorias ?? []).join(', '),
    'Vigencia (meses)':        c.vigenciaMeses ?? '',
    'Precio':                  c.precio ?? '',
    'Asistencia mínima (%)':   c.porcentajeAsistencia ?? '',
    'Aprobación mínima (%)':   c.porcentajeAprobacion ?? '',
    'Estado':                  c.estado,
    'Objetivos':               c.objetivos ?? '',
    'Contenidos':              c.contenidos ?? '',
    'Emisiones':               c.totalEmisiones ?? 0,
    'Creado':                  c.creadoEn ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = [
    { wch: 55 }, { wch: 18 }, { wch: 8 }, { wch: 22 },
    { wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 12 },
    { wch: 20 }, { wch: 20 },
    { wch: 12 }, { wch: 60 }, { wch: 60 }, { wch: 10 }, { wch: 14 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cursos')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buffer], { type: 'application/octet-stream' }),
    `${nombre}-${new Date().toISOString().slice(0, 10)}.xlsx`
  )
}

export function descargarPlantillaExcel() {
  const ws = XLSX.utils.aoa_to_sheet([
    [
      'Nombre', 'Código SENCE', 'Horas', 'Condición', 'Modalidad',
      'Categorías', 'Vigencia (meses)', 'Precio',
      'Asistencia mínima (%)', 'Aprobación mínima (%)',
      'Estado', 'Plantilla', 'Objetivos', 'Contenidos',
    ],
    [
      'Curso Ejemplo de Capacitación en Seguridad Industrial',
      'NO-APLICA', 8, 'TEÓRICO - PRÁCTICO', 'Presencial',
      'Seguridad Industrial', 12, 0,
      75, 60,
      'Activo',
      '',
      'Objetivo de ejemplo: describir aquí los objetivos del curso.',
      'MÓDULO 1: SEGURIDAD BÁSICA\n- Identificación de peligros\n- Uso correcto de EPP\nMÓDULO 2: PROCEDIMIENTOS DE EMERGENCIA\n- Evacuación\n- Primeros auxilios',
    ],
  ])
  ws['!cols'] = [
    { wch: 55 }, { wch: 18 }, { wch: 8 }, { wch: 24 }, { wch: 14 },
    { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 22 },
    { wch: 12 }, { wch: 35 }, { wch: 50 }, { wch: 50 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buffer], { type: 'application/octet-stream' }),
    'plantilla-cursos-demo.xlsx'
  )
}

// Valida el formulario de curso. Retorna un objeto con los campos que tienen error.
export function validarCurso(form) {
  const errs = {}
  if (!form.nombre || !form.nombre.trim())
    errs.nombre = 'El nombre es requerido'
  if (!form.codigoSence || form.codigoSence.trim() === '')
    errs.codigoSence = 'Campo requerido'
  const horasNum = parseFloat(String(form.horas ?? '').replace(',', '.'))
  if (!form.horas && form.horas !== 0)
    errs.horas = 'Campo requerido'
  else if (isNaN(horasNum) || horasNum <= 0)
    errs.horas = 'Ingrese un número válido mayor a 0 (ej: 8 o 2,5)'
  if (!form.condicion)
    errs.condicion = 'Campo requerido'
  if (!form.categorias || form.categorias.length === 0)
    errs.categorias = 'Seleccione al menos una categoría'
  return errs
}

export function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  const wStart = Math.max(2, current - 1)
  const wEnd   = Math.min(total - 1, current + 1)
  if (wStart > 2) pages.push('...')
  for (let i = wStart; i <= wEnd; i++) pages.push(i)
  if (wEnd < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

export const CONDICIONES = ['TEÓRICO - PRÁCTICO', 'TEÓRICO', 'PRÁCTICO', 'E-LEARNING']


export const CATEGORIAS_BASE = [
  'Seguridad Industrial', 'Trabajos en Altura', 'Maquinaria Pesada',
  'Prevención de Riesgos', 'Operación Forestal', 'Manejo Eléctrico',
  'Emergencias', 'Inducción Hombre Nuevo', 'Primeros Auxilios',
  'Manejo Defensivo', 'Medio Ambiente', 'Calidad',
]

// Las categorías se extienden con adiciones y eliminaciones locales guardadas en localStorage.
// otec_demo_categorias_extra: categorías nuevas creadas por el usuario
// otec_demo_categorias_eliminadas: categorías base que el usuario ocultó
const LS_EXTRA  = 'otec_demo_categorias_extra'
const LS_ELIM   = 'otec_demo_categorias_eliminadas'

// Combina las categorías base con las extras del usuario, excluyendo las eliminadas.
export function cargarCategorias() {
  try {
    const extra    = JSON.parse(localStorage.getItem(LS_EXTRA) || '[]')
    const eliminadas = new Set(JSON.parse(localStorage.getItem(LS_ELIM) || '[]'))
    return [...CATEGORIAS_BASE, ...extra].filter(c => !eliminadas.has(c))
  } catch {
    return [...CATEGORIAS_BASE]
  }
}

export function persistirCategoriaExtra(cat) {
  try {
    const extra = JSON.parse(localStorage.getItem(LS_EXTRA) || '[]')
    if (!extra.includes(cat)) localStorage.setItem(LS_EXTRA, JSON.stringify([...extra, cat]))
  } catch {}
}

export function eliminarCategoriaLs(cat) {
  try {
    const extra = JSON.parse(localStorage.getItem(LS_EXTRA) || '[]')
    localStorage.setItem(LS_EXTRA, JSON.stringify(extra.filter(c => c !== cat)))
    if (CATEGORIAS_BASE.includes(cat)) {
      const elim = JSON.parse(localStorage.getItem(LS_ELIM) || '[]')
      if (!elim.includes(cat)) localStorage.setItem(LS_ELIM, JSON.stringify([...elim, cat]))
    }
  } catch {}
}

export function cargarCategoriasExtra() {
  try {
    const extra = JSON.parse(localStorage.getItem(LS_EXTRA) || '[]')
    const elim  = new Set(JSON.parse(localStorage.getItem(LS_ELIM) || '[]'))
    return extra.filter(c => !elim.has(c))
  } catch {
    return []
  }
}

export const VIGENCIAS = [6, 12, 18, 24, 36, 48, 60]

export const MODALIDADES = ['Presencial', 'Online', 'Híbrido']
