const COLORS = [
  'var(--brand-600)',
  'var(--accent-mint-500)',
  'var(--accent-purple-500)',
  'var(--accent-amber-500)',
  'var(--accent-sky-500)',
]

// Asigna siempre el mismo color a un nombre dado (determinístico).
// Mismo nombre = mismo color, sin importar cuántas veces se renderice.
function hashColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return COLORS[Math.abs(h) % COLORS.length]
}

// Extrae las iniciales: primera y última palabra si hay varias, solo la primera si es una sola.
function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ name = '', size = 32, style: extra }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: '50%',
      background: hashColor(name || '?'),
      color: '#fff',
      fontSize: Math.max(10, Math.round(size * 0.38)),
      fontWeight: 700,
      flexShrink: 0,
      userSelect: 'none',
      letterSpacing: '-0.01em',
      ...extra,
    }}>
      {initials(name)}
    </span>
  )
}
