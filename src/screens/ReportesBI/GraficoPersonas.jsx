// Ranking de personas con más certificados, ordenable también por horas acumuladas.
import { useState, useMemo } from 'react'
import Avatar from '../../components/atoms/Avatar'
import { CARD_STYLE } from './utils'

function SortToggle({ value, onChange }) {
  const opts = [
    { v: 'certs',  l: 'Más certificados' },
    { v: 'horas',  l: 'Más horas' },
    { v: 'tasa',   l: 'Mayor tasa' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--neutral-100)', borderRadius: 20, padding: 3 }}>
      {opts.map(o => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            height: 26, padding: '0 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600,
            background: on ? 'var(--brand-600, #14b4c9)' : 'transparent',
            color: on ? '#fff' : 'var(--fg-2)',
            fontFamily: 'var(--font-sans)',
          }}>
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

export default function GraficoPersonas({ personas, filtroEmpresa, filtroPeriodo }) {
  const [sortMode, setSortMode] = useState('certs')

  const topPersonas = useMemo(() => {
    const mesesMap = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }
    const mesesCount = mesesMap[filtroPeriodo] ?? null

    let corte = null
    if (mesesCount !== null) {
      corte = new Date()
      corte.setMonth(corte.getMonth() - mesesCount)
    }

    const lista = personas
      .filter(p => filtroEmpresa === 'Todas' || p.empresa === filtroEmpresa)
      .map(p => {
        const certsDelPeriodo = corte
          ? p.certificados.filter(c => c.fechaEmision && new Date(c.fechaEmision) >= corte)
          : p.certificados

        const total     = certsDelPeriodo.length
        const aprobados = certsDelPeriodo.filter(c => c.estado === 'Aprobado').length
        const horas     = certsDelPeriodo.reduce((s, c) => s + (c.horas || 0), 0)
        const tasa      = total > 0 ? Math.round(aprobados / total * 100) : 0

        return {
          nombre:   p.nombre,
          rut:      p.rut,
          empresa:  p.empresa,
          total,
          aprobados,
          horas,
          tasa,
        }
      })
      .filter(p => p.total > 0)

    if (sortMode === 'horas')  return lista.sort((a, b) => b.horas  - a.horas ).slice(0, 8)
    if (sortMode === 'tasa')   return lista.sort((a, b) => b.tasa   - a.tasa  ).slice(0, 8)
    return lista.sort((a, b) => b.total - a.total).slice(0, 8)
  }, [personas, filtroEmpresa, filtroPeriodo, sortMode])

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Top Personas Certificadas</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Participantes del período seleccionado</p>
        </div>
        <SortToggle value={sortMode} onChange={setSortMode} />
      </div>

      {topPersonas.length === 0 ? (
        <div style={{
          padding: '32px 16px', textAlign: 'center',
          color: 'var(--fg-3)', fontSize: 13,
        }}>
          Las personas aparecerán aquí al emitir certificados.
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '22px 30px 1fr 44px 44px 40px',
            gap: 6, alignItems: 'center',
            padding: '0 0 6px', marginBottom: 4,
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600, textTransform: 'uppercase' }}>#</span>
            <span />
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600, textTransform: 'uppercase' }}>Persona</span>
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600, textAlign: 'right', textTransform: 'uppercase' }}>Certs</span>
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600, textAlign: 'right', textTransform: 'uppercase' }}>Horas</span>
            <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600, textAlign: 'right', textTransform: 'uppercase' }}>Tasa</span>
          </div>
          {topPersonas.map((p, i) => (
            <div key={p.rut} style={{
              display: 'grid',
              gridTemplateColumns: '22px 30px 1fr 44px 44px 40px',
              gap: 6, alignItems: 'center',
              padding: '9px 0',
              borderBottom: i < topPersonas.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: i < 3 ? 'var(--brand-50, #EEF1FF)' : 'var(--neutral-100)',
                color: i < 3 ? 'var(--brand-600)' : 'var(--fg-3)',
                fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center',
              }}>
                {i + 1}
              </span>
              <Avatar name={p.nombre} size={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--fg-1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.nombre}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.empresa}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>{p.total}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#7E58D6' }}>{p.horas}h</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: p.tasa >= 80 ? 'var(--success-500)' : p.tasa >= 60 ? '#E69C12' : 'var(--danger-500)',
                }}>
                  {p.tasa}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
