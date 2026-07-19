import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Select nativo con estilos del sistema de diseño y flecha personalizada.
// options puede ser array de strings o de objetos { value, label }.
export default function Select({ options = [], value, onChange, placeholder, style: extra }) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value ?? ''}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: 38,
          paddingLeft: 12,
          paddingRight: 32,
          fontSize: 13,
          color: value ? 'var(--fg-2)' : 'var(--neutral-400)',
          background: 'var(--bg-surface)',
          border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          outline: 'none',
          boxShadow: focused ? 'var(--shadow-focus)' : 'none',
          transition: 'border-color 150ms, box-shadow 150ms',
          appearance: 'none',
          cursor: 'pointer',
          ...extra,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
      <span style={{
        position: 'absolute',
        right: 10,
        color: 'var(--neutral-400)',
        pointerEvents: 'none',
        display: 'flex',
      }}>
        <ChevronDown size={15} strokeWidth={1.75} />
      </span>
    </div>
  )
}
