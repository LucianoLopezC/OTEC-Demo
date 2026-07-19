import { useState } from 'react'

// Colores de fondo, hover, texto y borde para cada variante del botón.
const VARIANTS = {
  primary:    { bg: 'var(--brand-600)',    hbg: 'var(--brand-700)',    color: '#fff',                border: 'none' },
  secondary:  { bg: 'var(--bg-surface)',   hbg: 'var(--neutral-100)', color: 'var(--fg-2)',         border: '1px solid var(--border-default)' },
  ghost:      { bg: 'transparent',         hbg: 'var(--neutral-100)', color: 'var(--fg-2)',         border: 'none' },
  success:    { bg: 'var(--success-500)',  hbg: 'var(--success-600)', color: '#fff',                border: 'none' },
  danger:     { bg: 'var(--danger-500)',   hbg: 'var(--danger-600)',  color: '#fff',                border: 'none' },
  dangerSoft: { bg: 'var(--danger-50)',    hbg: '#fad8d8',            color: 'var(--danger-500)',   border: 'none' },
  dark:       { bg: 'var(--neutral-800)',  hbg: 'var(--neutral-900)', color: '#fff',                border: 'none' },
}

// Altura, font-size, padding lateral, gap entre ícono y texto, y tamaño del ícono.
const SIZES = {
  sm: { h: 30, fs: 12, px: 10, gap: 5, icon: 13 },
  md: { h: 38, fs: 13, px: 14, gap: 6, icon: 14 },
  lg: { h: 44, fs: 14, px: 18, gap: 8, icon: 16 },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  children,
  fullWidth,
  onClick,
  style: extra,
  disabled,
  type = 'button',
}) {
  const [hovered, setHovered] = useState(false)
  const v = VARIANTS[variant] ?? VARIANTS.primary
  const s = SIZES[size] ?? SIZES.md

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 600,
        borderRadius: 'var(--radius-md)',
        border: v.border,
        background: hovered && !disabled ? v.hbg : v.bg,
        color: v.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
        whiteSpace: 'nowrap',
        width: fullWidth ? '100%' : undefined,
        flexShrink: 0,
        ...extra,
      }}
    >
      {Icon && <Icon size={s.icon} strokeWidth={1.75} />}
      {children}
      {IconRight && <IconRight size={s.icon} strokeWidth={1.75} />}
    </button>
  )
}
