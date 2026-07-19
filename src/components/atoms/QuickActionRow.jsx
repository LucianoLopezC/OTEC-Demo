import { useState } from 'react'
import { Plus } from 'lucide-react'

// Fila de acción rápida con ícono + label, usada en el dashboard para accesos directos.
const TONES = {
  sky:    { bg: 'var(--accent-sky-50)',    hbg: 'var(--accent-sky-100)',    color: 'var(--accent-sky-500)' },
  mint:   { bg: 'var(--accent-mint-50)',   hbg: 'var(--accent-mint-100)',   color: 'var(--accent-mint-500)' },
  purple: { bg: 'var(--accent-purple-50)', hbg: 'var(--accent-purple-100)', color: 'var(--accent-purple-500)' },
  amber:  { bg: 'var(--accent-amber-50)',  hbg: 'var(--accent-amber-100)',  color: 'var(--accent-amber-500)' },
}

export default function QuickActionRow({ label, tone = 'sky', onClick }) {
  const [hovered, setHovered] = useState(false)
  const t = TONES[tone] ?? TONES.sky

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        background: hovered ? t.hbg : t.bg,
        cursor: 'pointer',
        transition: 'background 150ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: t.color,
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 150ms cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}>
        <Plus size={16} strokeWidth={2} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}>{label}</span>
    </div>
  )
}
