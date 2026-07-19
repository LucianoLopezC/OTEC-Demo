import { useState } from 'react'

// Selector de filtro consistente en toda la app.
// options: string[] | {value, label}[] — ambos formatos son válidos.
// label:   texto a mostrar a la izquierda, separado por borde (como en GestionCursos).
export default function FiltroSelect({ value, onChange, options = [], label }) {
  const [focused, setFocused] = useState(false)

  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
  const activo = opts.length > 0 && value !== opts[0].value

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
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: '100%', paddingLeft: 6, paddingRight: 22, fontSize: 12,
          color: activo ? 'var(--brand-700)' : 'var(--fg-2)',
          fontWeight: activo ? 600 : 400,
          background: 'transparent', border: 'none', outline: 'none',
          appearance: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
