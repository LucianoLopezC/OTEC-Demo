// Utilidades de la pantalla de Empresas: exportar a Excel, descargar plantilla de importación,
// validar y formatear RUT, y calcular números de página para la paginación.
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// Exporta el listado de empresas filtrado como Excel con columnas pre-dimensionadas.
export function exportarExcel(datos, nombreArchivo = 'empresas-demo') {
  const filas = datos.map(e => ({
    'Nombre de la Empresa': e.nombre,
    'RUT':          formatearRut(e.rut || ''),
    'Contacto':     e.contacto,
    'Email':        e.email,
    'Teléfono':     e.telefono,
    'Región':       e.region,
    'Usuarios':     e.usuarios,
    'Cursos':       e.cursos,
    'Estado':       e.estado,
  }))

  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = [
    { wch: 45 }, { wch: 16 }, { wch: 25 }, { wch: 32 },
    { wch: 20 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Empresas')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buffer], { type: 'application/octet-stream' }),
    `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.xlsx`
  )
}

export function descargarPlantilla() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nombre de la Empresa', 'RUT', 'Contacto', 'Email', 'Teléfono', 'Región', 'Estado'],
    ['EMPRESA EJEMPLO LTDA', '11.111.111-1', 'Contacto Ejemplo', 'contacto@ejemplo.cl', '+56 9 1111 1111', 'Región Metropolitana', 'Activa'],
  ])
  ws['!cols'] = [
    { wch: 40 }, { wch: 16 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 36 }, { wch: 14 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(
    new Blob([buffer], { type: 'application/octet-stream' }),
    'plantilla-empresas-demo.xlsx'
  )
}

export function validarRut(rut) {
  return /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rut.trim())
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

// Genera la secuencia de números de página con "..." para la paginación visual.
// Siempre incluye la primera y la última, y muestra una ventana de ±1 alrededor de la actual.
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
