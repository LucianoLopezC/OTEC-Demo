import { useState } from 'react'

// Input de texto con soporte para ícono izquierdo, ícono derecho y estado de error.
// El borde cambia a rojo si viene error, y a azul si está enfocado.
export default function TextInput({
  icon: Icon,
  iconRight: IconRight,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,
  style: extra,
  height = 38,
  ...props
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {Icon && (
        <span style={{
          position: 'absolute',
          left: 10,
          color: 'var(--neutral-400)',
          display: 'flex',
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          <Icon size={15} strokeWidth={1.75} />
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height,
          paddingLeft: Icon ? 34 : 12,
          paddingRight: IconRight ? 34 : 12,
          fontSize: 13,
          color: 'var(--fg-2)',
          background: 'var(--bg-surface)',
          border: `1px solid ${error ? 'var(--danger-500)' : focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          outline: 'none',
          boxShadow: focused ? 'var(--shadow-focus)' : 'none',
          transition: 'border-color 150ms, box-shadow 150ms',
          ...extra,
        }}
        {...props}
      />
      {IconRight && (
        <span style={{
          position: 'absolute',
          right: 10,
          color: 'var(--neutral-400)',
          display: 'flex',
          pointerEvents: 'none',
        }}>
          <IconRight size={15} strokeWidth={1.75} />
        </span>
      )}
    </div>
  )
}
