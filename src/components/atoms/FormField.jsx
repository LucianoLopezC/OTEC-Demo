// Wrapper para inputs de formulario: agrega label, asterisco de requerido y mensaje de error.
export default function FormField({ label, required, children, error, style: extra }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...extra }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', lineHeight: 1 }}>
          {label}
          {required && <span style={{ color: 'var(--danger-500)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <span style={{ fontSize: 11, color: 'var(--danger-500)', marginTop: 1 }}>{error}</span>
      )}
    </div>
  )
}
