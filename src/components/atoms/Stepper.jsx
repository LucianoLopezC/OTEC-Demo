import { Check } from 'lucide-react'

// Barra de progreso por pasos. Cada paso puede estar pendiente, en progreso o completado.
// Se usa en el wizard de emisión de certificados (Paso 1 y Paso 2).
export default function Stepper({ steps = [], active = 0, onStep }) {
  return (
    <div style={{ display: 'flex' }}>
      {steps.map((step, i) => {
        const done    = i < active
        const current = i === active

        return (
          <div
            key={i}
            onClick={() => onStep?.(i)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '18px 28px',
              cursor: onStep ? 'pointer' : 'default',
              borderRight: i < steps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              background: current ? 'var(--brand-50)' : 'transparent',
              transition: 'background 200ms',
              position: 'relative',
            }}
          >
            {/* Número / check */}
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14,
              background: done    ? 'var(--success-500)'
                        : current ? 'var(--brand-600)'
                        :           'var(--neutral-200)',
              color: done || current ? '#fff' : 'var(--neutral-500)',
              outline: current ? '3px solid var(--brand-200)' : 'none',
              outlineOffset: 2,
              transition: 'all 200ms',
            }}>
              {done ? <Check size={16} strokeWidth={2.5} /> : i + 1}
            </div>

            {/* Texto */}
            <div>
              <div style={{
                fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.6px', marginBottom: 3,
                color: done    ? 'var(--success-600)'
                     : current ? 'var(--brand-600)'
                     :           'var(--fg-4)',
              }}>
                {done ? 'Completado' : current ? 'En progreso' : 'Pendiente'}
              </div>
              <div style={{
                fontSize: 13.5, fontWeight: current ? 600 : 400,
                color: current ? 'var(--fg-1)' : done ? 'var(--fg-2)' : 'var(--fg-4)',
              }}>
                {step}
              </div>
            </div>

            {/* Barra inferior de estado */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
              background: done    ? 'var(--success-500)'
                        : current ? 'var(--brand-500)'
                        :           'transparent',
              transition: 'background 200ms',
            }} />
          </div>
        )
      })}
    </div>
  )
}
