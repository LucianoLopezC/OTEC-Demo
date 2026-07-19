// Modal para agregar o editar un participante individual en la tabla de emisión.
// El estado se calcula automáticamente basado en asistencia y evaluación.
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Button    from '../../components/atoms/Button'
import FormField from '../../components/atoms/FormField'
import TextInput from '../../components/atoms/TextInput'
import Badge     from '../../components/atoms/Badge'
import { calcularEstado, validarRutPersona, formatearRut } from './utils'

const EMPTY = { nombre: '', rut: '', email: '', asistencia: '', evaluacion: '' }

const ESTADO_BADGE = { Aprobado: 'success', Reprobado: 'danger', Pendiente: 'neutral' }

export default function ModalAgregarPersona({ persona, participantes = [], onClose, onSave, minAsistencia = 75, minAprobacion = 60 }) {
  const isEdit = !!persona
  const [form,    setForm]    = useState(() => isEdit ? { ...persona } : { ...EMPTY })
  const [errors,  setErrors]  = useState({})
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })) }

  const estadoCalc = calcularEstado(form.asistencia, form.evaluacion, minAsistencia, minAprobacion)

  const validate = () => {
    const e = {}
    if (!form.nombre.trim())                      e.nombre     = 'Campo requerido'
    if (!form.rut.trim())                         e.rut        = 'Campo requerido'
    else if (!validarRutPersona(form.rut))        e.rut        = 'Formato inválido. Ej: 11.111.111-1'
    else {
      const dupRut = participantes.find(p => p.rut === form.rut.trim() && p.id !== form.id)
      if (dupRut)                                 e.rut        = 'Este RUT ya está en la lista'
    }
    const a = Number(form.asistencia), ev = Number(form.evaluacion)
    if (form.asistencia === '')                   e.asistencia = 'Campo requerido'
    else if (isNaN(a) || a < 0 || a > 100)       e.asistencia = 'Valor entre 0 y 100'
    if (form.evaluacion === '')                   e.evaluacion = 'Campo requerido'
    else if (isNaN(ev) || ev < 0 || ev > 100)    e.evaluacion = 'Valor entre 0 y 100'
    return e
  }

  const handleClose = () => { setVisible(false); setTimeout(onClose, 200) }

  const handleSave = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    onSave({ ...form, id: form.id ?? Date.now().toString() })
    handleClose()
  }

  return (
    <div
      role="dialog" aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--modal-pad)', opacity: visible ? 1 : 0,
        transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: 480, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: visible ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
            {isEdit ? 'Editar Participante' : 'Agregar Participante'}
          </h2>
          <button onClick={handleClose} style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
          }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Nombre completo" required error={errors.nombre}>
            <TextInput
              placeholder="Participante Ejemplo"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              error={!!errors.nombre}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <FormField label="RUT" required error={errors.rut}>
              <TextInput
                placeholder="11.111.111-1"
                value={form.rut}
                onChange={e => set('rut', formatearRut(e.target.value))}
                error={!!errors.rut}
              />
            </FormField>
            <FormField label="Email">
              <TextInput
                placeholder="participante@ejemplo.cl"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
            <FormField label="Asistencia (%)" required error={errors.asistencia}>
              <TextInput
                type="number" placeholder="0–100"
                min={0} max={100}
                value={form.asistencia}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || v === '-') { set('asistencia', ''); return }
                  const n = Math.min(100, Math.max(0, Number(v)))
                  set('asistencia', String(n))
                }}
                error={!!errors.asistencia}
              />
            </FormField>
            <FormField label="Evaluación (%)" required error={errors.evaluacion}>
              <TextInput
                type="number" placeholder="0–100"
                min={0} max={100}
                value={form.evaluacion}
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || v === '-') { set('evaluacion', ''); return }
                  const n = Math.min(100, Math.max(0, Number(v)))
                  set('evaluacion', String(n))
                }}
                error={!!errors.evaluacion}
              />
            </FormField>
          </div>

          {/* Estado calculado */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--neutral-50)', border: '1px solid var(--border-default)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Estado calculado:</span>
            <Badge variant={ESTADO_BADGE[estadoCalc]}>{estadoCalc}</Badge>
            <span style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 4 }}>
              (Aprobado si asistencia ≥ {minAsistencia}% y evaluación ≥ {minAprobacion}%)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, padding: '16px 24px',
          borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <Button variant="ghost"   size="md" onClick={handleClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            {isEdit ? 'Actualizar' : 'Agregar participante'}
          </Button>
        </div>
      </div>
    </div>
  )
}
