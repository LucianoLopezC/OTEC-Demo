// Gráfico de torta: distribución de certificados por estado (Aprobado / Reprobado).
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'
import { CARD_STYLE } from './utils'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(15,27,71,0.10)',
      fontFamily: 'var(--font-sans)', fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.payload.fill, display: 'inline-block' }} />
        <span style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{d.name}</span>
      </div>
      <div style={{ color: 'var(--fg-2)', marginTop: 4 }}>
        Cantidad: <strong style={{ color: 'var(--fg-1)' }}>{d.value}</strong>
      </div>
      <div style={{ color: 'var(--fg-2)', marginTop: 2 }}>
        Porcentaje: <strong style={{ color: 'var(--fg-1)' }}>{d.payload.pct}%</strong>
      </div>
    </div>
  )
}

function avg(arr) {
  if (!arr.length) return 0
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
}

function MiniProgressBar({ value, max = 100, color, threshold, label, pctLabel }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const thresholdPct = Math.min(100, Math.round((threshold / max) * 100))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: value < threshold ? 'var(--danger-500)' : color }}>
          {pctLabel}
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--fg-3)', marginLeft: 4 }}>(umbral {threshold}%)</span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 4, background: 'var(--neutral-100)' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, borderRadius: 4, background: color,
          transition: 'width 400ms ease',
        }} />
        {/* Threshold marker */}
        <div style={{
          position: 'absolute', top: -3, left: `${thresholdPct}%`,
          width: 2, height: 12, background: '#475569', borderRadius: 1,
          transform: 'translateX(-50%)',
        }} />
      </div>
    </div>
  )
}

export default function GraficoEstados({ datosFiltrados }) {
  const { distribucion, total, avgAsistencia, avgEvaluacion } = useMemo(() => {
    const aprobados  = datosFiltrados.filter(c => c.estado === 'Aprobado').length
    const reprobados = datosFiltrados.filter(c => c.estado === 'Reprobado').length
    const tot = datosFiltrados.length
    const asistencias = datosFiltrados.map(c => Number(c.asistencia) || 0).filter(v => v > 0)
    const evaluaciones = datosFiltrados.map(c => Number(c.evaluacion) || 0).filter(v => v > 0)
    return {
      total: tot,
      avgAsistencia: avg(asistencias),
      avgEvaluacion: avg(evaluaciones),
      distribucion: [
        { name: 'Aprobados',  value: aprobados,  pct: tot ? Math.round(aprobados / tot * 100)  : 0, fill: '#1AAE63' },
        { name: 'Reprobados', value: reprobados, pct: tot ? Math.round(reprobados / tot * 100) : 0, fill: '#D03A3A' },
      ],
    }
  }, [datosFiltrados])

  return (
    <div style={CARD_STYLE}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Distribución por Estado</h3>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Aprobados vs. reprobados</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={distribucion}
            cx="50%" cy="50%"
            innerRadius={60} outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            animationDuration={400}
          >
            {distribucion.map((entry, i) => (
              <Cell key={i} fill={entry.fill} stroke="none" />
            ))}
            <Label content={({ viewBox }) => {
              const { cx, cy } = viewBox
              return (
                <g>
                  <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 26, fontWeight: 700, fill: 'var(--fg-1)' }}>
                    {total}
                  </text>
                  <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 10, fill: 'var(--fg-3)' }}>
                    certificados
                  </text>
                </g>
              )
            }} position="center" />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Leyenda custom */}
      <div style={{ marginTop: 16 }}>
        {distribucion.map(d => (
          <div key={d.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{d.name}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{d.value}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-3)', minWidth: 36, textAlign: 'right' }}>{d.pct}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Promedios del período */}
      {total > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Promedios del Período
          </div>
          <MiniProgressBar
            value={avgAsistencia}
            color="#14b4c9"
            threshold={75}
            label="Promedio Asistencia"
            pctLabel={`${avgAsistencia}%`}
          />
          <MiniProgressBar
            value={avgEvaluacion}
            color="#7E58D6"
            threshold={60}
            label="Promedio Evaluación"
            pctLabel={`${avgEvaluacion}%`}
          />
        </div>
      )}
    </div>
  )
}
