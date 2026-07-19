// Gráfico de barras horizontal: cursos más emitidos, ordenados por cantidad de certificados.
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList, Cell, ResponsiveContainer,
} from 'recharts'
import { CARD_STYLE, getChartTheme } from './utils'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(15,27,71,0.10)',
      fontFamily: 'var(--font-sans)', fontSize: 12, maxWidth: 260,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6, lineHeight: 1.3 }}>{d?.curso}</div>
      <div style={{ color: 'var(--fg-2)', marginTop: 3 }}>Total: <strong style={{ color: 'var(--fg-1)' }}>{d?.total}</strong></div>
      <div style={{ color: 'var(--fg-2)', marginTop: 3 }}>Aprobados: <strong style={{ color: '#1AAE63' }}>{d?.aprobados}</strong></div>
      <div style={{ color: 'var(--fg-2)', marginTop: 3 }}>% Aprobación: <strong style={{ color: 'var(--fg-1)' }}>{d?.pctAprobacion}%</strong></div>
      <div style={{ color: 'var(--fg-2)', marginTop: 3 }}>Horas totales: <strong style={{ color: 'var(--fg-1)' }}>{d?.horas} h</strong></div>
    </div>
  )
}

function getBarColor(pct) {
  if (pct >= 80) return '#1AAE63'
  if (pct >= 60) return '#E69C12'
  return '#D03A3A'
}

export default function GraficoCursos({ datosFiltrados }) {
  const { grid, tickMid, tickDark } = getChartTheme()
  const porCurso = useMemo(() => {
    const mapa = {}
    datosFiltrados.forEach(c => {
      if (!mapa[c.curso]) mapa[c.curso] = { curso: c.curso, total: 0, aprobados: 0, horas: 0 }
      mapa[c.curso].total++
      if (c.estado === 'Aprobado') mapa[c.curso].aprobados++
      mapa[c.curso].horas += (c.horas || 0)
    })
    return Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map(c => ({
        ...c,
        cursoCorto: c.curso.length > 28 ? c.curso.slice(0, 28) + '…' : c.curso,
        pctAprobacion: c.total > 0 ? Math.round(c.aprobados / c.total * 100) : 0,
      }))
  }, [datosFiltrados])

  return (
    <div style={CARD_STYLE}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Top Cursos por Volumen</h3>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Cursos con más certificaciones en el período</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={porCurso} layout="vertical" margin={{ left: 10, right: 60, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: tickMid }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="cursoCorto" width={165} tick={{ fontSize: 11, fill: tickDark }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar dataKey="total" name="Total" radius={[0, 6, 6, 0]} animationDuration={400}>
            {porCurso.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.pctAprobacion)} />
            ))}
            <LabelList dataKey="pctAprobacion" position="right" formatter={v => v + '%'} style={{ fontSize: 11, fill: tickMid, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Color legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        {[
          { color: '#1AAE63', label: '≥ 80% aprobación' },
          { color: '#E69C12', label: '60-79% aprobación' },
          { color: '#D03A3A', label: '< 60% aprobación' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
