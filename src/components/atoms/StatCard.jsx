// Tarjeta de métrica: ícono + número grande + label + tendencia opcional.
// Se usa en el dashboard y en la pantalla de Reportes BI.
const TONES = {
  sky:    { bg: 'var(--accent-sky-50)',    color: 'var(--accent-sky-500)' },
  mint:   { bg: 'var(--accent-mint-50)',   color: 'var(--accent-mint-500)' },
  purple: { bg: 'var(--accent-purple-50)', color: 'var(--accent-purple-500)' },
  amber:  { bg: 'var(--accent-amber-50)',  color: 'var(--accent-amber-500)' },
}

export default function StatCard({ icon: Icon, value, label, tone = 'sky', trend }) {
  const t = TONES[tone] ?? TONES.sky

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-md)',
        background: t.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: t.color,
        flexShrink: 0,
      }}>
        {Icon && <Icon size={20} strokeWidth={1.75} />}
      </div>

      <div>
        <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 4 }}>{label}</div>
        {trend && (
          <div style={{ fontSize: 11, color: 'var(--success-600)', marginTop: 5, fontWeight: 500 }}>
            {trend}
          </div>
        )}
      </div>
    </div>
  )
}
