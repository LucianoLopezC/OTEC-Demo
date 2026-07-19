// Tarjetas KPI de la pantalla de Reportes BI: total, aprobados, reprobados, empresas activas, etc.
// Cada KPI incluye la tendencia comparada con el período anterior si hay datos suficientes.
import { Award, CheckCircle2, XCircle, Clock, Building2, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { calcularTendenciaMetrica } from './utils'

function Tendencia({ tendencia, invertida = false }) {
  if (!tendencia) return (
    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-3)' }}>sin datos previos</span>
  )
  const { porcentaje, direccion } = tendencia
  if (direccion === 'igual') {
    return <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 3 }}><Minus size={11} /> 0%</span>
  }
  const subiendo = direccion === 'up'
  const positivo = invertida ? !subiendo : subiendo
  const color    = positivo ? 'var(--success-500)' : 'var(--danger-500)'
  const Icon     = subiendo ? TrendingUp : TrendingDown
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, display: 'flex', alignItems: 'center', gap: 3 }}>
      <Icon size={12} />
      {subiendo ? '+' : '-'}{porcentaje}% vs período anterior
    </span>
  )
}

function KPICard({ icon: Icon, iconBg, iconColor, valor, label, subtexto, tendencia, invertida }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 14, padding: '20px 22px',
      boxShadow: '0 1px 3px rgba(15,27,71,0.06), 0 1px 2px rgba(15,27,71,0.04)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <Tendencia tendencia={tendencia} invertida={invertida} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1 }}>{valor}</div>
        <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 4 }}>{label}</div>
        {subtexto && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{subtexto}</div>}
      </div>
    </div>
  )
}

function fmtHoras(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K h` : `${n} h`
}

export default function KPICards({ datosFiltrados, todosDatos, filtroPeriodo, totalEmpresas }) {
  const aprobados  = datosFiltrados.filter(c => c.estado === 'Aprobado').length
  const reprobados = datosFiltrados.filter(c => c.estado === 'Reprobado').length
  const total      = datosFiltrados.length
  const horas      = datosFiltrados.reduce((s, c) => s + (c.horas || 0), 0)
  const empresasActivas = new Set(datosFiltrados.map(c => c.empresa)).size
  const tasaAprobacion  = total > 0 ? Math.round(aprobados / total * 100) : 0

  const tendTotal = calcularTendenciaMetrica(
    total, todosDatos, filtroPeriodo,
    arr => arr.length
  )

  const tendTasa = calcularTendenciaMetrica(
    tasaAprobacion, todosDatos, filtroPeriodo,
    arr => arr.length > 0 ? Math.round(arr.filter(c => c.estado === 'Aprobado').length / arr.length * 100) : 0
  )

  const tendHoras = calcularTendenciaMetrica(
    horas, todosDatos, filtroPeriodo,
    arr => arr.reduce((s, c) => s + (c.horas || 0), 0)
  )

  const tendAprobados = calcularTendenciaMetrica(
    aprobados, todosDatos, filtroPeriodo,
    arr => arr.filter(c => c.estado === 'Aprobado').length
  )

  const tendReprobados = calcularTendenciaMetrica(
    reprobados, todosDatos, filtroPeriodo,
    arr => arr.filter(c => c.estado === 'Reprobado').length
  )

  return (
    <div className="resp-grid-3">
      <KPICard
        icon={Award}
        iconBg="rgba(20,180,201,0.12)" iconColor="var(--brand-600, #14b4c9)"
        valor={total} label="Total Certificados"
        tendencia={tendTotal}
      />
      <KPICard
        icon={Target}
        iconBg="var(--success-50)" iconColor="var(--success-500)"
        valor={`${tasaAprobacion}%`} label="Tasa de Aprobación"
        subtexto={`${aprobados} aprobados / ${total} total`}
        tendencia={tendTasa}
      />
      <KPICard
        icon={Clock}
        iconBg="#F3EEFF" iconColor="#7E58D6"
        valor={fmtHoras(horas)} label="Horas Capacitadas"
        tendencia={tendHoras}
      />
      <KPICard
        icon={CheckCircle2}
        iconBg="var(--success-50)" iconColor="var(--success-500)"
        valor={aprobados} label="Aprobados"
        subtexto={`${tasaAprobacion}% tasa de aprobación`}
        tendencia={tendAprobados}
      />
      <KPICard
        icon={XCircle}
        iconBg="var(--danger-50)" iconColor="var(--danger-500)"
        valor={reprobados} label="Reprobados"
        subtexto={total > 0 ? `${Math.round(reprobados / total * 100)}% tasa de reprobación` : '—'}
        invertida
        tendencia={tendReprobados}
      />
      <KPICard
        icon={Building2}
        iconBg="rgba(20,180,201,0.12)" iconColor="var(--brand-600, #14b4c9)"
        valor={empresasActivas} label="Empresas con Actividad"
        subtexto={`de ${totalEmpresas} registradas`}
      />
    </div>
  )
}
