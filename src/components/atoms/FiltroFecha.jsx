import { useState } from 'react'

// Input de fecha con el mismo look que FiltroSelect:
// borde azul cuando hay valor, label opcional a la izquierda.
export default function FiltroFecha({ label, value, onChange, min, max }) {
  const [focused, setFocused] = useState(false)
  const activo = !!value

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      height: 30,
      border: `1px solid ${focused ? 'var(--border-focus)' : activo ? 'var(--brand-300)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      background: activo ? 'var(--brand-50)' : 'var(--bg-surface)',
      overflow: 'hidden',
    }}>
      {label && (
        <span style={{
          paddingLeft: 8, paddingRight: 6, fontSize: 11, fontWeight: 500,
          color: activo ? 'var(--brand-600)' : 'var(--fg-3)',
          whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none',
          borderRight: `1px solid ${activo ? 'var(--brand-200)' : 'var(--border-subtle)'}`,
          alignSelf: 'stretch', display: 'flex', alignItems: 'center',
        }}>
          {label}
        </span>
      )}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: '100%', padding: '0 8px', fontSize: 12,
          color: activo ? 'var(--brand-700)' : 'var(--fg-2)',
          fontWeight: activo ? 600 : 400,
          background: 'transparent', border: 'none', outline: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          colorScheme: 'light',
        }}
      />
    </div>
  )
}
