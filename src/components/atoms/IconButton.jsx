import { useState } from 'react'

// Botón cuadrado que solo muestra un ícono, sin texto. Se usa en tablas y barras de herramientas.
const VARIANTS = {
  secondary: { bg: 'var(--bg-surface)',  hbg: 'var(--neutral-100)', color: 'var(--fg-3)', border: '1px solid var(--border-default)' },
  ghost:     { bg: 'transparent',        hbg: 'var(--neutral-100)', color: 'var(--fg-3)', border: 'none' },
  dark:      { bg: 'var(--neutral-800)', hbg: 'var(--neutral-700)', color: '#fff',        border: 'none' },
}

export default function IconButton({ icon: Icon, size = 32, variant = 'ghost', onClick, title, style: extra }) {
  const [hovered, setHovered] = useState(false)
  const v = VARIANTS[variant] ?? VARIANTS.ghost

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        border: v.border,
        background: hovered ? v.hbg : v.bg,
        color: v.color,
        cursor: 'pointer',
        transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
        ...extra,
      }}
    >
      <Icon size={Math.round(size * 0.47)} strokeWidth={1.75} />
    </button>
  )
}
