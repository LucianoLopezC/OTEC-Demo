import { Component } from 'react'

/**
 * ErrorBoundary — captura excepciones de render en el árbol de componentes
 * y muestra una pantalla de recuperación en lugar de un blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Loguear el error (en producción conectar a un servicio de monitoreo)
    console.error('[ErrorBoundary] Error capturado:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app, #f5f6fa)',
        padding: 24,
      }}>
        <div style={{
          background: 'var(--bg-surface, #fff)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          borderRadius: 12,
          padding: '40px 48px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>
          {/* Ícono */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--danger-50, #fef2f2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 26,
          }}>
            ⚠️
          </div>

          <h2 style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--fg-1, #1a2332)',
          }}>
            Algo salió mal
          </h2>

          <p style={{
            margin: '0 0 28px',
            fontSize: 14,
            color: 'var(--fg-3, #64748b)',
            lineHeight: 1.5,
          }}>
            Ocurrió un error inesperado en la aplicación.
            Puedes intentar recargar la página o volver al inicio.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle, #e2e8f0)',
                background: 'var(--bg-surface, #fff)',
                color: 'var(--fg-2, #374151)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Volver al inicio
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--brand-600, #14b4c9)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Recargar página
            </button>
          </div>

          {/* Detalle técnico colapsable (solo en dev) */}
          {import.meta.env.DEV && this.state.error && (
            <details style={{ marginTop: 20, textAlign: 'left' }}>
              <summary style={{ fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer' }}>
                Detalle técnico
              </summary>
              <pre style={{
                marginTop: 8,
                padding: 12,
                background: 'var(--neutral-50, #f8fafc)',
                borderRadius: 6,
                fontSize: 11,
                color: 'var(--danger-700, #b91c1c)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
