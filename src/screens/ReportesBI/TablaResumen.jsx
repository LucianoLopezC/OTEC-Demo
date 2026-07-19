// Tabla detallada de certificados con búsqueda, ordenamiento por columna, paginación
// y exportación a Excel. Complementa los gráficos de la pantalla de Reportes BI.
import { useState, useMemo } from 'react'
import { Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import Badge from '../../components/atoms/Badge'
import Button from '../../components/atoms/Button'
import { ahoraChile } from '../../utils/fecha'

const ESTADO_BADGE = { Aprobado: 'success', Reprobado: 'danger' }
const POR_PAGINA   = 10

function getPageNumbers(current, total) {
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

function fmtFecha(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function getVencimientoStatus(fechaVencimiento) {
  if (!fechaVencimiento) return null
  const dias = Math.floor((new Date(fechaVencimiento) - ahoraChile()) / 86400000)
  if (dias < 0)    return { label: 'Vencido',            variant: 'danger' }
  if (dias <= 30)  return { label: `${dias}d`,           variant: 'warning' }
  if (dias <= 90)  return { label: fmtFecha(fechaVencimiento), variant: 'neutral' }
  return { label: fmtFecha(fechaVencimiento), variant: 'success' }
}

const TH_BASE = {
  padding: '9px 12px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
  textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--neutral-50)',
  borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap', textAlign: 'left',
  userSelect: 'none',
}
const TD = { padding: '10px 12px', fontSize: 12, color: 'var(--fg-2)', verticalAlign: 'middle' }

const SORT_COLS = ['fechaEmision', 'horas', 'asistencia', 'evaluacion']

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronsUpDown size={12} style={{ opacity: 0.35, marginLeft: 4, verticalAlign: 'middle' }} />
  if (sortDir === 'asc')  return <ChevronUp   size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--brand-600)' }} />
  return <ChevronDown size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--brand-600)' }} />
}

export default function TablaResumen({ datosFiltrados }) {
  const [pagina, setPagina]   = useState(1)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (col) => {
    if (!SORT_COLS.includes(col)) return
    if (sortCol === col) {
      if (sortDir === 'asc')  { setSortDir('desc') }
      else { setSortCol(null); setSortDir('asc') }
    } else {
      setSortCol(col); setSortDir('asc')
    }
    setPagina(1)
  }

  const datosSorted = useMemo(() => {
    if (!sortCol) return datosFiltrados
    return [...datosFiltrados].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (sortCol === 'fechaEmision') {
        va = va ? va : ''; vb = vb ? vb : ''
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      va = Number(va) || 0; vb = Number(vb) || 0
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [datosFiltrados, sortCol, sortDir])

  const totalPaginas = Math.max(1, Math.ceil(datosSorted.length / POR_PAGINA))

  const filas = useMemo(() => {
    const inicio = (pagina - 1) * POR_PAGINA
    return datosSorted.slice(inicio, inicio + POR_PAGINA)
  }, [datosSorted, pagina])

  const handleExportar = () => {
    const rows = datosFiltrados.map(c => ({
      'Código':           c.codigoCertificado,
      'Curso':            c.curso,
      'Empresa':          c.empresa,
      'Fecha Emisión':    fmtFecha(c.fechaEmision),
      'Fecha Vencimiento': fmtFecha(c.fechaVencimiento),
      'Horas':            c.horas,
      'Asistencia %':     c.asistencia,
      'Evaluación %':     c.evaluacion,
      'Estado':           c.estado,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Certificados')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `reporte-certificados-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const thSortable = (col, extra = {}) => ({
    ...TH_BASE, ...extra,
    cursor: SORT_COLS.includes(col) ? 'pointer' : 'default',
    color: sortCol === col ? 'var(--brand-600)' : TH_BASE.color,
  })

  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 14,
      boxShadow: '0 1px 3px rgba(15,27,71,0.06), 0 1px 2px rgba(15,27,71,0.04)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Detalle de Certificados</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>
            Mostrando {datosFiltrados.length} registro{datosFiltrados.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={handleExportar}>
          Exportar tabla
        </Button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH_BASE}>Código</th>
              <th style={TH_BASE}>Curso</th>
              <th style={TH_BASE}>Empresa</th>
              <th style={thSortable('fechaEmision')} onClick={() => handleSort('fechaEmision')}>
                F. Emisión <SortIcon col="fechaEmision" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th style={thSortable('horas', { textAlign: 'center' })} onClick={() => handleSort('horas')}>
                Horas <SortIcon col="horas" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th style={thSortable('asistencia', { textAlign: 'center' })} onClick={() => handleSort('asistencia')}>
                Asistencia <SortIcon col="asistencia" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th style={thSortable('evaluacion', { textAlign: 'center' })} onClick={() => handleSort('evaluacion')}>
                Evaluación <SortIcon col="evaluacion" sortCol={sortCol} sortDir={sortDir} />
              </th>
              <th style={TH_BASE}>Estado</th>
              <th style={TH_BASE}>Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...TD, textAlign: 'center', padding: '40px 24px', color: 'var(--fg-3)' }}>
                  Sin registros para mostrar
                </td>
              </tr>
            ) : filas.map((c, i) => {
              const venc = getVencimientoStatus(c.fechaVencimiento)
              return (
                <tr key={c.id ?? i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                    {c.codigoCertificado}
                  </td>
                  <td style={{ ...TD, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={c.curso}>
                    {c.curso}
                  </td>
                  <td style={{ ...TD, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={c.empresa}>
                    {c.empresa}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap', color: 'var(--fg-3)' }}>{fmtFecha(c.fechaEmision)}</td>
                  <td style={{ ...TD, textAlign: 'center' }}>{c.horas} h</td>
                  <td style={{
                    ...TD, textAlign: 'center', fontWeight: 600,
                    color: Number(c.asistencia) < 75 ? 'var(--danger-500)' : 'var(--fg-1)',
                  }}>
                    {c.asistencia}%
                  </td>
                  <td style={{
                    ...TD, textAlign: 'center', fontWeight: 600,
                    color: Number(c.evaluacion) < 60 ? 'var(--danger-500)' : 'var(--fg-1)',
                  }}>
                    {c.evaluacion}%
                  </td>
                  <td style={TD}>
                    <Badge variant={ESTADO_BADGE[c.estado] ?? 'neutral'}>{c.estado}</Badge>
                  </td>
                  <td style={TD}>
                    {venc ? (
                      <Badge variant={venc.variant}>{venc.label}</Badge>
                    ) : (
                      <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPaginas > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4,
          padding: '14px 22px', borderTop: '1px solid var(--border-subtle)',
        }}>
          {getPageNumbers(pagina, totalPaginas).map((p, i) => (
            p === '...'
              ? <span key={`e${i}`} style={{ padding: '0 6px', color: 'var(--fg-3)', fontSize: 13 }}>…</span>
              : <button
                  key={p}
                  onClick={() => setPagina(p)}
                  style={{
                    width: 32, height: 32, borderRadius: 'var(--radius-md)',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: p === pagina ? 700 : 400,
                    background: p === pagina ? 'var(--brand-600)' : 'transparent',
                    color: p === pagina ? '#fff' : 'var(--fg-2)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {p}
                </button>
          ))}
        </div>
      )}
    </div>
  )
}
