// Exporta todo el dashboard de Reportes BI a un único Excel con una hoja por
// gráfico (mismo orden en que aparecen en pantalla), más el detalle de certificados.
// Cada hoja con gráfico lleva arriba una captura de imagen (tal como se ve en
// pantalla, capturada con html2canvas desde index.jsx) y debajo la tabla con los
// datos agregados — sin los recortes de "top N" que existen solo por espacio visual
// en el gráfico. Usa ExcelJS (a diferencia del resto del proyecto, que usa la
// librería `xlsx`) porque `xlsx` community no soporta insertar imágenes.
import { saveAs } from 'file-saver'
import { formatMes } from './utils'
import { ahoraChile } from '../../utils/fecha'

const ROW_PX = 20 // alto aproximado de una fila de Excel, para calcular dónde empieza la tabla debajo de la imagen

function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function clasificarVencimiento(fechaVencimiento) {
  const dias = Math.floor((new Date(fechaVencimiento) - ahoraChile()) / 86400000)
  if (dias < 0)    return 'vencidos'
  if (dias <= 30)  return 'critico'
  if (dias <= 90)  return 'proximo'
  if (dias <= 180) return 'vigente'
  return 'ok'
}

function hojaResumen(datosFiltrados, totalEmpresas, filtros) {
  const aprobados  = datosFiltrados.filter(c => c.estado === 'Aprobado').length
  const reprobados = datosFiltrados.filter(c => c.estado === 'Reprobado').length
  const total      = datosFiltrados.length
  const horas      = datosFiltrados.reduce((s, c) => s + (c.horas || 0), 0)
  const empresasActivas = new Set(datosFiltrados.map(c => c.empresa)).size
  const tasaAprobacion  = total > 0 ? Math.round(aprobados / total * 100) : 0

  return [
    { Filtro: 'Empresa',  Valor: filtros.empresa },
    { Filtro: 'Curso',    Valor: filtros.curso },
    { Filtro: 'Estado',   Valor: filtros.estado },
    { Filtro: 'Período',  Valor: filtros.periodo },
    { Filtro: 'Año',      Valor: filtros.anio },
    { Filtro: '', Valor: '' },
    { Filtro: 'Total Certificados',      Valor: total },
    { Filtro: 'Aprobados',               Valor: aprobados },
    { Filtro: 'Reprobados',              Valor: reprobados },
    { Filtro: 'Tasa de Aprobación (%)',  Valor: tasaAprobacion },
    { Filtro: 'Horas Capacitadas',       Valor: horas },
    { Filtro: 'Empresas con Actividad',  Valor: empresasActivas },
    { Filtro: 'Empresas Registradas',    Valor: totalEmpresas },
  ]
}

function hojaEvolucionMensual(datosFiltrados) {
  const mapa = {}
  datosFiltrados.forEach(c => {
    const mes = c.fechaEmision.slice(0, 7)
    if (!mapa[mes]) mapa[mes] = { mes, total: 0, aprobados: 0, reprobados: 0 }
    mapa[mes].total++
    if (c.estado === 'Aprobado') mapa[mes].aprobados++
    else mapa[mes].reprobados++
  })
  return Object.values(mapa)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(m => ({
      'Mes':               formatMes(m.mes),
      'Total':             m.total,
      'Aprobados':         m.aprobados,
      'Reprobados':        m.reprobados,
      'Tasa Aprobación %': m.total > 0 ? Math.round(m.aprobados / m.total * 100) : 0,
    }))
}

function hojaPorEmpresa(datosFiltrados) {
  const mapa = {}
  datosFiltrados.forEach(c => {
    if (!mapa[c.empresa]) mapa[c.empresa] = { empresa: c.empresa, total: 0, aprobados: 0, reprobados: 0 }
    mapa[c.empresa].total++
    if (c.estado === 'Aprobado') mapa[c.empresa].aprobados++
    else mapa[c.empresa].reprobados++
  })
  return Object.values(mapa)
    .sort((a, b) => b.total - a.total)
    .map(e => ({
      'Empresa':           e.empresa,
      'Total':             e.total,
      'Aprobados':         e.aprobados,
      'Reprobados':        e.reprobados,
      'Tasa Aprobación %': e.total > 0 ? Math.round(e.aprobados / e.total * 100) : 0,
    }))
}

function hojaPorEstado(datosFiltrados) {
  const aprobados  = datosFiltrados.filter(c => c.estado === 'Aprobado').length
  const reprobados = datosFiltrados.filter(c => c.estado === 'Reprobado').length
  const total = datosFiltrados.length
  const asistencias  = datosFiltrados.map(c => Number(c.asistencia) || 0).filter(v => v > 0)
  const evaluaciones = datosFiltrados.map(c => Number(c.evaluacion) || 0).filter(v => v > 0)
  const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0

  return [
    { Estado: 'Aprobados',  Cantidad: aprobados,  'Porcentaje %': total ? Math.round(aprobados / total * 100) : 0 },
    { Estado: 'Reprobados', Cantidad: reprobados, 'Porcentaje %': total ? Math.round(reprobados / total * 100) : 0 },
    { Estado: '', Cantidad: '', 'Porcentaje %': '' },
    { Estado: 'Promedio Asistencia %', Cantidad: avg(asistencias), 'Porcentaje %': '' },
    { Estado: 'Promedio Evaluación %', Cantidad: avg(evaluaciones), 'Porcentaje %': '' },
  ]
}

function hojaHorasPorMes(datosFiltrados) {
  const mapa = {}
  datosFiltrados.forEach(c => {
    const mes = c.fechaEmision.slice(0, 7)
    if (!mapa[mes]) mapa[mes] = { mes, horas: 0, certificados: 0 }
    mapa[mes].horas += (c.horas || 0)
    mapa[mes].certificados++
  })
  let acum = 0
  return Object.values(mapa)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(m => {
      acum += m.horas
      return {
        'Mes':               formatMes(m.mes),
        'Horas':             m.horas,
        'Certificados':      m.certificados,
        'Horas Acumuladas':  acum,
      }
    })
}

function hojaPorCurso(datosFiltrados) {
  const mapa = {}
  datosFiltrados.forEach(c => {
    if (!mapa[c.curso]) mapa[c.curso] = { curso: c.curso, total: 0, aprobados: 0, horas: 0 }
    mapa[c.curso].total++
    if (c.estado === 'Aprobado') mapa[c.curso].aprobados++
    mapa[c.curso].horas += (c.horas || 0)
  })
  return Object.values(mapa)
    .sort((a, b) => b.total - a.total)
    .map(c => ({
      'Curso':             c.curso,
      'Total':             c.total,
      'Aprobados':         c.aprobados,
      'Tasa Aprobación %': c.total > 0 ? Math.round(c.aprobados / c.total * 100) : 0,
      'Horas Totales':     c.horas,
    }))
}

function hojaTopPersonas(personas, filtroEmpresa, filtroPeriodo) {
  const mesesMap   = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }
  const mesesCount = mesesMap[filtroPeriodo] ?? null
  let corte = null
  if (mesesCount !== null) {
    corte = new Date()
    corte.setMonth(corte.getMonth() - mesesCount)
  }

  return personas
    .filter(p => filtroEmpresa === 'Todas' || p.empresa === filtroEmpresa)
    .map(p => {
      const certsDelPeriodo = corte
        ? p.certificados.filter(c => c.fechaEmision && new Date(c.fechaEmision) >= corte)
        : p.certificados
      const total     = certsDelPeriodo.length
      const aprobados = certsDelPeriodo.filter(c => c.estado === 'Aprobado').length
      const horas     = certsDelPeriodo.reduce((s, c) => s + (c.horas || 0), 0)
      return {
        'Nombre':            p.nombre,
        'RUT':               p.rut,
        'Empresa':           p.empresa,
        'Certificados':      total,
        'Horas':             horas,
        'Tasa Aprobación %': total > 0 ? Math.round(aprobados / total * 100) : 0,
      }
    })
    .filter(p => p['Certificados'] > 0)
    .sort((a, b) => b['Certificados'] - a['Certificados'])
}

function hojasVencimientos(datosFiltrados) {
  const CATEGORIAS = [
    { key: 'vencidos', label: 'Vencidos' },
    { key: 'critico',  label: 'Crítico (<30d)' },
    { key: 'proximo',  label: 'Próximo (30-90d)' },
    { key: 'vigente',  label: 'Vigente (90-180d)' },
    { key: 'ok',       label: 'OK (>180d)' },
  ]
  const conVenc = datosFiltrados.filter(c => c.fechaVencimiento && c.estado === 'Aprobado')
  const conteos = { vencidos: 0, critico: 0, proximo: 0, vigente: 0, ok: 0 }
  conVenc.forEach(c => { conteos[clasificarVencimiento(c.fechaVencimiento)]++ })

  const porPeriodo = CATEGORIAS.map(cat => ({ Categoría: cat.label, Cantidad: conteos[cat.key] }))

  const mapaEmp = {}
  conVenc.forEach(c => {
    const cat = clasificarVencimiento(c.fechaVencimiento)
    if (cat !== 'critico' && cat !== 'proximo') return
    if (!mapaEmp[c.empresa]) mapaEmp[c.empresa] = { empresa: c.empresa, critico: 0, proximo: 0 }
    mapaEmp[c.empresa][cat]++
  })
  const porEmpresa = Object.values(mapaEmp)
    .sort((a, b) => (b.critico + b.proximo) - (a.critico + a.proximo))
    .map(e => ({
      'Empresa':             e.empresa,
      'Crítico (<30d)':      e.critico,
      'Próximo (30-90d)':    e.proximo,
    }))

  return { porPeriodo, porEmpresa }
}

function hojaDetalleCertificados(datosFiltrados) {
  return datosFiltrados.map(c => ({
    'Código':            c.codigoCertificado,
    'Curso':             c.curso,
    'Empresa':           c.empresa,
    'Fecha Emisión':     fmtFecha(c.fechaEmision),
    'Fecha Vencimiento': fmtFecha(c.fechaVencimiento),
    'Horas':             c.horas,
    'Asistencia %':      c.asistencia,
    'Evaluación %':      c.evaluacion,
    'Estado':            c.estado,
  }))
}

// Agrega una hoja con una imagen opcional arriba (captura del gráfico) y la
// tabla de datos debajo. Si no hay imagen, la tabla empieza en la fila 1.
function agregarHoja(wb, nombre, rows, imagen) {
  const ws = wb.addWorksheet(nombre)
  let startRow = 1

  if (imagen?.dataUrl) {
    const imageId = wb.addImage({ base64: imagen.dataUrl, extension: 'png' })
    ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: imagen.width, height: imagen.height } })
    startRow = Math.ceil(imagen.height / ROW_PX) + 2
  }

  if (rows.length === 0) return
  const headers = Object.keys(rows[0])

  const headerRow = ws.getRow(startRow)
  headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h })
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F5' } }
  })

  rows.forEach((row, ri) => {
    const r = ws.getRow(startRow + 1 + ri)
    headers.forEach((h, i) => { r.getCell(i + 1).value = row[h] })
  })

  headers.forEach((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length))
    ws.getColumn(i + 1).width = Math.min(42, Math.max(10, maxLen + 2))
  })
}

export async function exportarReporteCompleto({
  datosFiltrados, personas, totalEmpresas, filtroEmpresa, filtroPeriodo, filtros, imagenes = {},
}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()

  agregarHoja(wb, 'Resumen',              hojaResumen(datosFiltrados, totalEmpresas, filtros))
  agregarHoja(wb, 'Evolucion Mensual',    hojaEvolucionMensual(datosFiltrados),           imagenes.certificados)
  agregarHoja(wb, 'Por Empresa',          hojaPorEmpresa(datosFiltrados),                 imagenes.empresas)
  agregarHoja(wb, 'Por Estado',           hojaPorEstado(datosFiltrados),                  imagenes.estados)
  agregarHoja(wb, 'Horas por Mes',        hojaHorasPorMes(datosFiltrados),                imagenes.horas)
  agregarHoja(wb, 'Por Curso',            hojaPorCurso(datosFiltrados),                   imagenes.cursos)
  agregarHoja(wb, 'Top Personas',         hojaTopPersonas(personas, filtroEmpresa, filtroPeriodo), imagenes.personas)

  const { porPeriodo, porEmpresa } = hojasVencimientos(datosFiltrados)
  agregarHoja(wb, 'Vencim. por Periodo',  porPeriodo, imagenes.vencimientos)
  agregarHoja(wb, 'Vencim. por Empresa',  porEmpresa.length > 0 ? porEmpresa : [{ Empresa: 'Sin renovaciones urgentes', 'Crítico (<30d)': 0, 'Próximo (30-90d)': 0 }])

  agregarHoja(wb, 'Detalle Certificados', hojaDetalleCertificados(datosFiltrados))

  const buf = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `reporte-bi-completo-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
