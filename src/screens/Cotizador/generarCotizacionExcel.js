// Rellena una plantilla Excel con los datos de una cotización.
// La plantilla usa marcadores {{variable}} en celdas individuales.
// Una fila que contenga {{item.*}} se repite automáticamente por cada ítem.
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

function fmtNum(n) {
  return Math.round(n).toLocaleString('es-CL')
}

export async function generarCotizacionExcel(templateBlob, { empresa, items, numero, fecha, notas }) {
  const ab = await templateBlob.arrayBuffer()
  const wb = XLSX.read(ab, { type: 'array' })
  const wsName = wb.SheetNames[0]
  const ws = wb.Sheets[wsName]

  const ref = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1')

  const subtotal = items.reduce((s, i) => s + (Number(i.precio) || 0) * (i.cantidad || 1), 0)
  const iva   = subtotal * 0.19
  const total = subtotal + iva

  const vars = {
    '{{numero}}':         numero || '',
    '{{fecha}}':          fecha  || '',
    '{{empresa_nombre}}': empresa?.nombre  || '',
    '{{empresa_rut}}':    empresa?.rut     || '',
    '{{empresa_email}}':  empresa?.email   || '',
    '{{empresa_region}}': empresa?.region  || '',
    '{{subtotal}}':       fmtNum(subtotal),
    '{{iva}}':            fmtNum(iva),
    '{{total}}':          fmtNum(total),
    '{{notas}}':          notas || '',
  }

  // Encontrar la fila plantilla de ítems (primera con {{item. en alguna celda)
  let itemRow = -1
  outer: for (let r = ref.s.r; r <= ref.e.r; r++) {
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell?.v && String(cell.v).includes('{{item.')) {
        itemRow = r
        break outer
      }
    }
  }

  // Reemplazar variables escalares en filas que no sean la fila de ítems
  for (let r = ref.s.r; r <= ref.e.r; r++) {
    if (r === itemRow) continue
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (!cell || typeof cell.v !== 'string') continue
      let v = cell.v
      for (const [ph, val] of Object.entries(vars)) v = v.replaceAll(ph, val)
      if (v !== cell.v) ws[addr] = { ...cell, v, w: undefined }
    }
  }

  // Expandir fila de ítems si existe
  if (itemRow !== -1 && items.length > 0) {
    // Capturar la fila plantilla y borrarla del worksheet
    const tmpl = []
    for (let c = ref.s.c; c <= ref.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: itemRow, c })
      tmpl.push({ c, cell: ws[addr] ? { ...ws[addr] } : null })
      delete ws[addr]
    }

    // Desplazar filas inferiores para hacer hueco a los ítems extra
    const shift = items.length - 1
    if (shift > 0) {
      for (let r = ref.e.r; r > itemRow; r--) {
        for (let c = ref.s.c; c <= ref.e.c; c++) {
          const src = XLSX.utils.encode_cell({ r, c })
          const dst = XLSX.utils.encode_cell({ r: r + shift, c })
          if (ws[src]) { ws[dst] = ws[src]; delete ws[src] }
        }
      }
    }

    // Escribir una fila por ítem
    items.forEach((item, idx) => {
      const linea = (Number(item.precio) || 0) * (item.cantidad || 1)
      const iv = {
        '{{item.numero}}':          String(idx + 1),
        '{{item.nombre}}':          item.nombre    || '',
        '{{item.horas}}':           item.horas     ? `${item.horas}h` : '',
        '{{item.modalidad}}':       item.modalidad || '',
        '{{item.cantidad}}':        String(item.cantidad || 1),
        '{{item.precio_unitario}}': fmtNum(Number(item.precio) || 0),
        '{{item.subtotal}}':        fmtNum(linea),
      }
      tmpl.forEach(({ c, cell }) => {
        if (!cell) return
        let v = typeof cell.v === 'string' ? cell.v : cell.v
        if (typeof v === 'string') {
          for (const [ph, val] of Object.entries(iv)) v = v.replaceAll(ph, val)
        }
        ws[XLSX.utils.encode_cell({ r: itemRow + idx, c })] = { ...cell, v, w: undefined }
      })
    })

    // Actualizar el rango del worksheet
    ws['!ref'] = XLSX.utils.encode_range({
      s: ref.s,
      e: { r: ref.e.r + shift, c: ref.e.c },
    })
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const nombreEmp = empresa.nombre.replace(/[\\/:*?"<>|]/g, '').trim()
  saveAs(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `COT-N° ${numero.replace('COT-', '')}-${nombreEmp}.xlsx`
  )
}
