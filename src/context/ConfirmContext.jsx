import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import Button from '../components/atoms/Button'

const ConfirmCtx = createContext(null)

// Provee un dialog de confirmación imperativo: await confirm('¿Eliminar?') devuelve true/false.
// Todas las pantallas lo usan antes de operaciones destructivas (eliminar empresa, usuario, etc.)
export function ConfirmProvider({ children }) {
  const [dialog,  setDialog]  = useState(null)
  const [visible, setVisible] = useState(false)
  // Se guarda la función resolve de la Promise para resolverla desde fuera del closure
  const resolveRef = useRef(null)

  // Abre el dialog y devuelve una Promise que resuelve con true (confirmar) o false (cancelar).
  // requestAnimationFrame da un tick para que el DOM monte antes de activar la animación de entrada.
  const confirm = useCallback((message, { confirmLabel = 'Eliminar', subtitle = 'Esta acción no se puede deshacer.' } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({ message, confirmLabel, subtitle })
      requestAnimationFrame(() => setVisible(true))
    })
  }, [])

  // Anima la salida (200ms) y después desmonta el dialog y resuelve la Promise
  const handleClose = (result) => {
    setVisible(false)
    setTimeout(() => {
      setDialog(null)
      resolveRef.current?.(result)
      resolveRef.current = null
    }, 200)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          role="alertdialog"
          aria-modal="true"
          onClick={e => e.target === e.currentTarget && handleClose(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,27,71,0.45)',
            zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
            opacity: visible ? 1 : 0,
            transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 16,
            boxShadow: '0 24px 64px -12px rgba(15,27,71,0.25)',
            width: '100%', maxWidth: 420,
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(8px)',
            transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
          }}>

            {/* Body */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '24px 20px 20px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'var(--danger-50)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={20} strokeWidth={2} color="var(--danger-500)" />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', margin: '0 0 4px', lineHeight: 1.4 }}>
                  {dialog.message}
                </p>
                {dialog.subtitle && (
                  <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0, lineHeight: 1.5 }}>
                    {dialog.subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleClose(false)}
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-md)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--fg-4)', flexShrink: 0,
                }}
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 8,
              padding: '12px 20px 16px',
              borderTop: '1px solid var(--border-subtle)',
            }}>
              <Button variant="ghost" size="md" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button variant="danger" size="md" onClick={() => handleClose(true)}>
                {dialog.confirmLabel}
              </Button>
            </div>

          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export function useConfirm() {
  const fn = useContext(ConfirmCtx)
  if (!fn) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return fn
}
