// Gráfico de línea: evolución mensual de certificados emitidos.
// Agrupa los datos por mes y muestra la tendencia comparada con el período anterior.
import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { formatMes, CARD_STYLE, getChartTheme } from './utils'

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const ALL_SERIES = [
  { key: 'total',           label: 'Total',              color: '#3B7BEB' },
  { key: 'aprobados',       label: 'Aprobados',          color: '#1AAE63' },
  { key: 'reprobados',      label: 'Reprobados',         color: '#D03A3A' },
  { key: 'tasaAprobacion',  label: 'Tasa Aprobación %',  color: '#F59E0B', dashed: true, yAxis: 'pct' },
]

function PillToggle({ activas, toggle }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ALL_SERIES.map(s => {
        const on = activas.includes(s.key)
        return (
          <button key={s.key} onClick={() => toggle(s.key)} style={{
            height: 28, padding: '0 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, transition: 'background 150ms, color 150ms',
            background: on ? s.color : 'var(--neutral-100)',
            color: on ? '#fff' : 'var(--fg-2)',
            fontFamily: 'var(--font-sans)',
          }}>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

function AgrupToggle({ value, onChange }) {
  const opts = [{ v: 'mensual', l: 'Mensual' }, { v: 'trimestral', l: 'Trimestral' }]
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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(15,27,71,0.10)',
      fontFamily: 'var(--font-sans)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'var(--fg-2)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>
            {p.dataKey === 'tasaAprobacion' ? `${p.value}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function getQuarter(mesStr) {
  const [anio, mes] = mesStr.split('-')
  const q = Math.ceil(parseInt(mes) / 3)
  return `Q${q} ${anio}`
}

export default function GraficoCertificados({ datosFiltrados }) {
  const [activas, setActivas] = useState(['total', 'aprobados', 'reprobados'])
  const [agrupacion, setAgrupacion] = useState('mensual')
  const { grid, tickMid } = getChartTheme()

  const toggle = (key) => {
    setActivas(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    )
  }

  const porMes = useMemo(() => {
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
        ...m,
        mesLabel: formatMes(m.mes),
        tasaAprobacion: m.total > 0 ? Math.round(m.aprobados / m.total * 100) : 0,
      }))
  }, [datosFiltrados])

  const porTrimestre = useMemo(() => {
    const mapa = {}
    datosFiltrados.forEach(c => {
      const mes = c.fechaEmision.slice(0, 7)
      const q = getQuarter(mes)
      if (!mapa[q]) mapa[q] = { label: q, total: 0, aprobados: 0, reprobados: 0, _key: mes.slice(0, 4) + '-' + mes.slice(5, 7) }
      mapa[q].total++
      if (c.estado === 'Aprobado') mapa[q].aprobados++
      else mapa[q].reprobados++
    })
    return Object.values(mapa)
      .sort((a, b) => a._key.localeCompare(b._key))
      .map(q => ({
        ...q,
        mesLabel: q.label,
        tasaAprobacion: q.total > 0 ? Math.round(q.aprobados / q.total * 100) : 0,
      }))
  }, [datosFiltrados])

  const datos = agrupacion === 'mensual' ? porMes : porTrimestre

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Evolución de Certificados Emitidos</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Comparativo del período seleccionado</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <AgrupToggle value={agrupacion} onChange={setAgrupacion} />
          <PillToggle activas={activas} toggle={toggle} />
        </div>
      </div>
      {datos.length === 0 ? (
        <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--fg-3)' }}>
          <TrendingUp size={36} strokeWidth={1.25} />
          <span style={{ fontSize: 13 }}>Sin datos para el período seleccionado</span>
        </div>
      ) : (
        <>
          {datos.length === 1 && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--warning-50)', border: '1px solid var(--warning-200)', borderRadius: 8, fontSize: 12, color: 'var(--warning-700, #92400E)' }}>
              Solo hay datos de <strong>1 período</strong>. Amplía el rango de tiempo para ver la evolución de la línea.
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={datos} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: tickMid }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: tickMid }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: tickMid }} axisLine={false} tickLine={false} width={36} tickFormatter={v => v + '%'} />
              <Tooltip content={<CustomTooltip />} />
              {ALL_SERIES.filter(s => activas.includes(s.key)).map(s => (
                <Line
                  key={s.key}
                  yAxisId={s.yAxis || 'left'}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: datos.length === 1 ? 6 : 3, fill: s.color, strokeWidth: 0 }}
                  activeDot={{ r: 7 }}
                  strokeDasharray={s.dashed ? '5 3' : (s.key === 'reprobados' ? '4 2' : undefined)}
                  animationDuration={400}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}
