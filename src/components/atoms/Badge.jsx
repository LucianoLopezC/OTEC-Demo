// Colores de fondo, texto y punto de estado para cada tono semántico del badge.
const TONES = {
  success: { bg: 'var(--success-50)',        color: 'var(--success-600)',       dot: 'var(--success-500)' },
  warning: { bg: 'var(--warning-50)',        color: 'var(--warning-600)',       dot: 'var(--warning-500)' },
  danger:  { bg: 'var(--danger-50)',         color: 'var(--danger-600)',        dot: 'var(--danger-500)' },
  info:    { bg: 'var(--info-50)',           color: 'var(--info-600)',          dot: 'var(--info-500)' },
  neutral: { bg: 'var(--neutral-100)',       color: 'var(--neutral-600)',       dot: 'var(--neutral-400)' },
  brand:   { bg: 'var(--brand-50)',          color: 'var(--brand-700)',         dot: 'var(--brand-500)' },
  purple:  { bg: 'var(--accent-purple-50)', color: 'var(--accent-purple-500)', dot: 'var(--accent-purple-400)' },
  amber:   { bg: 'var(--accent-amber-50)',  color: 'var(--accent-amber-500)',  dot: 'var(--accent-amber-400)' },
  mint:    { bg: 'var(--accent-mint-50)',   color: 'var(--accent-mint-500)',   dot: 'var(--accent-mint-400)' },
}

const SIZES = {
  sm: { fs: 11, p: '2px 8px',  dot: 5 },
  md: { fs: 12, p: '3px 10px', dot: 6 },
}

export default function Badge({ variant = 'neutral', dot = true, size = 'md', children }) {
  const t = TONES[variant] ?? TONES.neutral
  const s = SIZES[size] ?? SIZES.md

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: t.bg,
      color: t.color,
      borderRadius: 'var(--radius-pill)',
      fontSize: s.fs,
      fontWeight: 600,
      padding: s.p,
      whiteSpace: 'nowrap',
      lineHeight: 1,
    }}>
      {dot && (
        <span style={{
          width: s.dot,
          height: s.dot,
          borderRadius: '50%',
          background: t.dot,
          flexShrink: 0,
          display: 'inline-block',
        }} />
      )}
      {children}
    </span>
  )
}
