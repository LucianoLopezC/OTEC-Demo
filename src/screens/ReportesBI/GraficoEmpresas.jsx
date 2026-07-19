// Gráfico de barras: top N empresas por certificados emitidos.
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LabelList, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { CARD_STYLE, getChartTheme } from './utils'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total     = payload.reduce((s, p) => s + (typeof p.value === 'number' ? p.value : 0), 0)
  const aprobados = payload.find(p => p.dataKey === 'aprobados')?.value ?? 0
  const pct       = total > 0 ? Math.round(aprobados / total * 100) : 0
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(15,27,71,0.10)',
      fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 200,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6, lineHeight: 1.3 }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2)', marginTop: 4 }}>
        <span>Total</span><span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{total}</span>
      </div>
      {payload.filter(p => p.dataKey !== 'pctAprobacion').map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2)', marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, display: 'inline-block' }} />
            <span>{p.name}</span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>
            {p.value} — {total > 0 ? Math.round(p.value / total * 100) : 0}%
          </span>
        </div>
      ))}
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--fg-3)', borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
        Aprobación: {pct}%
      </div>
    </div>
  )
}

function SortToggle({ value, onChange }) {
  const opts = [{ v: 'volumen', l: 'Por volumen' }, { v: 'tasa', l: 'Por tasa aprobación' }]
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--neutral-100)', borderRadius: 20, padding: 3 }}>
      {opts.map(o => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            height: 26, padding: '0 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
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

export default function GraficoEmpresas({ datosFiltrados }) {
  const [sortMode, setSortMode] = useState('volumen')
  const { grid, tickMid, tickDark } = getChartTheme()

  const porEmpresa = useMemo(() => {
    const mapa = {}
    datosFiltrados.forEach(c => {
      if (!mapa[c.empresa]) mapa[c.empresa] = { empresa: c.empresa, total: 0, aprobados: 0, reprobados: 0 }
      mapa[c.empresa].total++
      if (c.estado === 'Aprobado') mapa[c.empresa].aprobados++
      else mapa[c.empresa].reprobados++
    })
    const lista = Object.values(mapa).map(e => ({
      ...e,
      empresaCorta: e.empresa.length > 22 ? e.empresa.slice(0, 22) + '…' : e.empresa,
      pctAprobacion: e.total > 0 ? Math.round(e.aprobados / e.total * 100) : 0,
    }))
    if (sortMode === 'tasa') {
      return lista.sort((a, b) => b.pctAprobacion - a.pctAprobacion).slice(0, 10)
    }
    return lista.sort((a, b) => b.total - a.total).slice(0, 10)
  }, [datosFiltrados, sortMode])

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Certificados por Empresa</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Top 10 empresas en el período</p>
        </div>
        <SortToggle value={sortMode} onChange={setSortMode} />
      </div>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={porEmpresa} layout="vertical" margin={{ left: 10, right: sortMode === 'tasa' ? 60 : 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: tickMid }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="empresaCorta" width={140} tick={{ fontSize: 11, fill: tickDark }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          {sortMode !== 'tasa' && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {sortMode === 'tasa' ? (
            <>
              <ReferenceLine x={80} stroke="#D03A3A" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: '80%', position: 'insideTopRight', fontSize: 10, fill: '#D03A3A' }} />
              <Bar dataKey="pctAprobacion" name="Tasa Aprobación %" fill="#14b4c9" radius={[0, 4, 4, 0]} animationDuration={400}>
                <LabelList dataKey="pctAprobacion" position="right" formatter={v => v + '%'} style={{ fontSize: 11, fill: tickMid, fontWeight: 600 }} />
              </Bar>
            </>
          ) : (
            <>
              <Bar dataKey="aprobados"  name="Aprobados"  stackId="a" fill="#1AAE63" animationDuration={400} />
              <Bar dataKey="reprobados" name="Reprobados" stackId="a" fill="#E69C12" radius={[0, 4, 4, 0]} animationDuration={400} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
