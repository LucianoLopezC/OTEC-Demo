// Modal de creación y edición de empresa.
// Valida el RUT antes de guardar y formatea el input en tiempo real.
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Button    from '../../components/atoms/Button'
import FormField from '../../components/atoms/FormField'
import TextInput from '../../components/atoms/TextInput'
import Select    from '../../components/atoms/Select'
import { validarRut, formatearRut } from './utils'

const REGIONES = [
  'Región de Arica y Parinacota',
  'Región de Tarapacá',
  'Región de Antofagasta',
  'Región de Atacama',
  'Región de Coquimbo',
  'Región de Valparaíso',
  'Región Metropolitana',
  "Región del Libertador General Bernardo O'Higgins",
  'Región del Maule',
  'Región de Ñuble',
  'Región del Biobío',
  'Región de La Araucanía',
  'Región de Los Ríos',
  'Región de Los Lagos',
  'Región de Aysén',
  'Región de Magallanes',
]

const ESTADOS = ['Activa', 'En revisión', 'Borrador', 'Inactiva']

const EMPTY = { nombre: '', rut: '', contacto: '', email: '', telefono: '', region: '', estado: 'Activa' }

export default function ModalEmpresa({ empresa, onClose, onSave }) {
  const isEdit = empresa && empresa !== 'nueva'

  const [form,    setForm]    = useState(() => isEdit ? { ...empresa } : { ...EMPTY })
  const [errors,  setErrors]  = useState({})
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const set = (key, val) => {
    setForm(f  => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.nombre.trim())                              errs.nombre   = 'Campo requerido'
    if (!form.rut.trim())                                 errs.rut      = 'Campo requerido'
    else if (!validarRut(form.rut))                       errs.rut      = 'Formato inválido. Ej: 11.111.111-1'
    if (!form.contacto.trim())                            errs.contacto = 'Campo requerido'
    if (!form.email.trim())                               errs.email    = 'Campo requerido'
    else if (!form.email.includes('@'))                   errs.email    = 'Email inválido'
    if (!form.region)                                     errs.region   = 'Campo requerido'
    if (!form.estado)                                     errs.estado   = 'Campo requerido'
    return errs
  }

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const handleSave = () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave(form)
    handleClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={e => e.target === e.currentTarget && handleClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,27,71,0.40)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--modal-pad)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: 600,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: visible ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
              {isEdit ? 'Editar Empresa' : 'Nueva Empresa'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '2px 0 0' }}>
              {isEdit ? 'Modifique los datos de la empresa.' : 'Complete los datos para registrar la empresa.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fg-3)',
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>

            <FormField label="Nombre de la Empresa" required error={errors.nombre} style={{ gridColumn: '1/-1' }}>
              <TextInput
                placeholder="Ej: MINERA EJEMPLO LTDA"
                value={form.nombre}
                onChange={e => set('nombre', e.target.value.toUpperCase())}
                error={!!errors.nombre}
                style={{ fontWeight: form.nombre ? '700' : '400' }}
              />
            </FormField>

            <FormField label="RUT" required error={errors.rut}>
              <TextInput
                placeholder="11.111.111-1"
                value={form.rut}
                onChange={e => set('rut', formatearRut(e.target.value))}
                error={!!errors.rut}
                style={{ fontWeight: form.rut ? '700' : '400' }}
              />
            </FormField>

            <FormField label="Estado" required error={errors.estado}>
              <Select
                options={ESTADOS.map(e => ({ value: e, label: e }))}
                placeholder="Seleccione..."
                value={form.estado}
                onChange={e => set('estado', e.target.value)}
              />
            </FormField>

            <FormField label="Nombre Contacto Principal" required error={errors.contacto}>
              <TextInput
                placeholder="Ej: Juan Pérez"
                value={form.contacto}
                onChange={e => set('contacto', e.target.value)}
                error={!!errors.contacto}
                style={{ fontWeight: form.contacto ? '700' : '400' }}
              />
            </FormField>

            <FormField label="Email Contacto" required error={errors.email}>
              <TextInput
                placeholder="Ej: contacto@empresa.cl"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                error={!!errors.email}
                style={{ fontWeight: form.email ? '700' : '400' }}
              />
            </FormField>

            <FormField label="Teléfono">
              <TextInput
                placeholder="+56 9 XXXX XXXX"
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                style={{ fontWeight: form.telefono ? '700' : '400' }}
              />
            </FormField>

            <FormField label="Región" required error={errors.region} style={{ gridColumn: '1/-1' }}>
              <Select
                options={REGIONES.map(r => ({ value: r, label: r }))}
                placeholder="Seleccione una región..."
                value={form.region}
                onChange={e => set('region', e.target.value)}
              />
            </FormField>

          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 10, padding: '16px 24px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}>
          <Button variant="ghost"   size="md" onClick={handleClose}>Cancelar</Button>
          <Button variant="primary" size="md" onClick={handleSave}>
            {isEdit ? 'Actualizar Empresa' : 'Guardar Empresa'}
          </Button>
        </div>

      </div>
    </div>
  )
}
