// Interruptor on/off estilo iOS. Llama onChange con el valor invertido al hacer click.
export default function Toggle({ value, onChange, disabled = false }) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 999, position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: value ? 'var(--brand-600)' : 'var(--neutral-300)',
        transition: 'background 150ms ease',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 150ms ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}
