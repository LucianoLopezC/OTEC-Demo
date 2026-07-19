// Gráfico de vencimientos: agrupa los certificados en vencidos, por vencer (30 días) y vigentes.
// Usa ahoraChile() para la comparación para respetar la zona horaria del usuario.
import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Clock } from 'lucide-react'
import { CARD_STYLE, getChartTheme } from './utils'
import { ahoraChile } from '../../utils/fecha'

const CATEGORIAS = [
  { key: 'vencidos',  label: 'Vencidos',        color: '#D03A3A', bgColor: '#FEE2E2', textColor: '#B91C1C' },
  { key: 'critico',   label: 'Crítico (<30d)',   color: '#F97316', bgColor: '#FFEDD5', textColor: '#C2410C' },
  { key: 'proximo',   label: 'Próximo (30-90d)', color: '#E69C12', bgColor: '#FEF3C7', textColor: '#92400E' },
  { key: 'vigente',   label: 'Vigente (90-180d)',color: '#14b4c9', bgColor: '#E0F7FA', textColor: '#076878' },
  { key: 'ok',        label: 'OK (>180d)',       color: '#1AAE63', bgColor: '#DCFCE7', textColor: '#166534' },
]

function clasificar(fechaVencimiento) {
  const dias = Math.floor((new Date(fechaVencimiento) - ahoraChile()) / 86400000)
  if (dias < 0)   return 'vencidos'
  if (dias <= 30)  return 'critico'
  if (dias <= 90)  return 'proximo'
  if (dias <= 180) return 'vigente'
  return 'ok'
}

function Badge({ children, bgColor, textColor }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: bgColor, color: textColor,
    }}>
      {children}
    </span>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(15,27,71,0.10)',
      fontFamily: 'var(--font-sans)', fontSize: 12, minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, flexShrink: 0 }} />
            <span style={{ color: 'var(--fg-2)' }}>{p.name}</span>
          </div>
          <span style={{ fontWeight: 700, color: 'var(--fg-1)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ViewToggle({ value, onChange }) {
  const opts = [{ v: 'periodo', l: 'Por período' }, { v: 'empresa', l: 'Por empresa' }]
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

export default function GraficoVencimientos({ datosFiltrados }) {
  const [vista, setVista] = useState('periodo')
  const { grid, tickMid, tickDark } = getChartTheme()

  const { resumen, porPeriodo, porEmpresa } = useMemo(() => {
    const conVenc = datosFiltrados.filter(c => c.fechaVencimiento && c.estado === 'Aprobado')

    const conteos = { vencidos: 0, critico: 0, proximo: 0, vigente: 0, ok: 0 }
    conVenc.forEach(c => { conteos[clasificar(c.fechaVencimiento)]++ })

    // Por periodo view
    const dataPeriodo = CATEGORIAS.map(cat => ({
      name: cat.label,
      value: conteos[cat.key],
      color: cat.color,
      key: cat.key,
    }))

    // Por empresa — top 8 by critico+proximo
    const mapaEmp = {}
    conVenc.forEach(c => {
      const cat = clasificar(c.fechaVencimiento)
      if (cat !== 'critico' && cat !== 'proximo') return
      if (!mapaEmp[c.empresa]) mapaEmp[c.empresa] = { empresa: c.empresa, critico: 0, proximo: 0 }
      mapaEmp[c.empresa][cat]++
    })
    const dataEmpresa = Object.values(mapaEmp)
      .sort((a, b) => (b.critico + b.proximo) - (a.critico + a.proximo))
      .slice(0, 8)
      .map(e => ({
        ...e,
        empresaCorta: e.empresa.length > 24 ? e.empresa.slice(0, 24) + '…' : e.empresa,
      }))

    return { resumen: conteos, porPeriodo: dataPeriodo, porEmpresa: dataEmpresa }
  }, [datosFiltrados])

  const hayAlerta = resumen.vencidos > 0 || resumen.critico > 0

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hayAlerta && (
            <AlertTriangle size={18} color="#D03A3A" strokeWidth={2} />
          )}
          <div>
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--fg-1)' }}>Vencimientos de Certificados</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-3)' }}>Estado de vigencia de certificados aprobados</p>
          </div>
        </div>
        <ViewToggle value={vista} onChange={setVista} />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {resumen.vencidos > 0 && (
          <Badge bgColor="#FEE2E2" textColor="#B91C1C">
            {resumen.vencidos} vencido{resumen.vencidos !== 1 ? 's' : ''}
          </Badge>
        )}
        {resumen.critico > 0 && (
          <Badge bgColor="#FFEDD5" textColor="#C2410C">
            <Clock size={12} />
            {resumen.critico} crítico{resumen.critico !== 1 ? 's' : ''} (&lt;30d)
          </Badge>
        )}
        {resumen.proximo > 0 && (
          <Badge bgColor="#FEF3C7" textColor="#92400E">
            {resumen.proximo} próximo{resumen.proximo !== 1 ? 's' : ''} (30-90d)
          </Badge>
        )}
        {resumen.vencidos === 0 && resumen.critico === 0 && resumen.proximo === 0 && (
          <Badge bgColor="#DCFCE7" textColor="#166534">
            Sin vencimientos urgentes
          </Badge>
        )}
      </div>

      {vista === 'periodo' ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={porPeriodo} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: tickMid }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: tickDark }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="value" name="Certificados" radius={[0, 6, 6, 0]} animationDuration={400}>
              {porPeriodo.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : porEmpresa.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          No hay renovaciones urgentes (dentro de 90 días) en el período actual.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, porEmpresa.length * 42 + 30)}>
          <BarChart data={porEmpresa} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: tickMid }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="empresaCorta" width={160} tick={{ fontSize: 11, fill: tickDark }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="critico"  name="Crítico (<30d)"   stackId="a" fill="#F97316" animationDuration={400} />
            <Bar dataKey="proximo"  name="Próximo (30-90d)" stackId="a" fill="#E69C12" radius={[0, 4, 4, 0]} animationDuration={400} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
