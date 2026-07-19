// Gráfico de barras: horas totales de capacitación por mes.
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatMes, CARD_STYLE, getChartTheme } from './utils'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(15,27,71,0.10)',
      fontFamily: 'var(--font-sans)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{label}</div>
      <div style={{ color: 'var(--fg-2)', marginTop: 3 }}>
        Horas del mes: <strong style={{ color: '#14b4c9' }}>{d?.horas} h</strong>
      </div>
      <div style={{ color: 'var(--fg-2)', marginTop: 3 }}>
        Certificados: <strong style={{ color: 'var(--fg-1)' }}>{d?.certificados}</strong>
      </div>
    </div>
  )
}

export default function GraficoHoras({ datosFiltrados }) {
  const { grid, tickMid } = getChartTheme()
  const { horasPorMes, promedioMensual } = useMemo(() => {
    const mapa = {}
    datosFiltrados.forEach(c => {
      const mes = c.fechaEmision.slice(0, 7)
      if (!mapa[mes]) mapa[mes] = { mes, horas: 0, certificados: 0 }
      mapa[mes].horas += (c.horas || 0)
      mapa[mes].certificados++
    })
    let acum = 0
    const lista = Object.values(mapa)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => {
        acum += m.horas
        return { ...m, horasAcumuladas: acum, mesLabel: formatMes(m.mes) }
      })
    const totalMeses = lista.length
    const totalHoras = lista.reduce((s, m) => s + m.horas, 0)
    return {
      horasPorMes: lista,
      promedioMensual: totalMeses > 0 ? Math.round(totalHoras / totalMeses) : 0,
    }
  }, [datosFiltrados])

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Horas de Capacitación</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Mensual en el período</p>
        </div>
        <div style={{
          background: 'rgba(20,180,201,0.08)', borderRadius: 10, padding: '6px 14px',
          fontSize: 12, color: 'var(--brand-600, #14b4c9)', fontWeight: 600,
        }}>
          Promedio mensual: {promedioMensual} h
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={horasPorMes} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: tickMid }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: tickMid }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <Bar
            dataKey="horas"
            name="Horas mensuales"
            fill="#14b4c9"
            fillOpacity={0.7}
            radius={[4, 4, 0, 0]}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
