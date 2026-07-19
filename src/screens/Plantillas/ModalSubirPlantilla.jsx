import { useState, useRef } from 'react'
import { X, FileCheck, Upload } from 'lucide-react'
import Button from '../../components/atoms/Button'
import { useApp } from '../../context/AppContext'
import { subirPlantillaDocx } from '../../services/supabase'

const TIPOS_CERT = ['Aprobación', 'Asistencia', 'Participación']

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--danger-500)' }}>{error}</span>}
    </div>
  )
}

function StyledInput({ value, onChange, placeholder, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 36, padding: '0 10px', fontSize: 13,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none',
        fontFamily: 'var(--font-sans)', width: '100%', boxSizing: 'border-box',
        opacity: disabled ? 0.6 : 1,
      }}
    />
  )
}

function StyledSelect({ value, onChange, options, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 36, paddingLeft: 10, paddingRight: 28, fontSize: 13,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', appearance: 'none',
        cursor: 'pointer', fontFamily: 'var(--font-sans)', width: '100%',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {options.map(o => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  )
}

function StyledTextarea({ value, onChange, placeholder, disabled }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={500}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 80, padding: '8px 10px', fontSize: 13,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical',
        fontFamily: 'var(--font-sans)', lineHeight: 1.6, width: '100%',
        boxSizing: 'border-box', opacity: disabled ? 0.6 : 1,
      }}
    />
  )
}

export default function ModalSubirPlantilla({ onClose, showToast }) {
  const { crearPlantilla } = useApp()
  const fileRef = useRef(null)

  const [form, setForm]       = useState({ nombre: '', tipo: 'Aprobación', descripcion: '' })
  const [archivo, setArchivo] = useState(null)
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [vis, setVis]         = useState(true)

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: null }))
  }

  const handleArchivo = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setErrors(prev => ({ ...prev, archivo: null }))
    if (f.name.toLowerCase().split('.').pop() !== 'docx') {
      setErrors(prev => ({ ...prev, archivo: 'Solo se aceptan archivos .docx' }))
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, archivo: 'El archivo no puede superar los 10 MB' }))
      return
    }
    setArchivo(f)
  }

  const validar = () => {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!archivo)            e.archivo = 'Debes seleccionar un archivo .docx'
    return e
  }

  const handleSubmit = async () => {
    const e = validar()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setLoading(true)
    try {
      const storagePath = await subirPlantillaDocx(archivo, form.nombre.trim())
      await crearPlantilla({
        nombre:        form.nombre.trim(),
        tipo:          form.tipo,
        categoria:     'certificado',
        descripcion:   form.descripcion.trim(),
        storagePath,
        nombreArchivo: archivo.name,
      })
      showToast('Plantilla guardada correctamente', 'success')
      setVis(false)
      setTimeout(onClose, 200)
    } catch (err) {
      showToast(`Error al subir plantilla: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const close = () => { setVis(false); setTimeout(onClose, 200) }

  return (
    <div
      onClick={e => e.target === e.currentTarget && close()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--modal-pad)',
        opacity: vis ? 1 : 0, transition: 'opacity 200ms',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: 500,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: vis ? 'scale(1)' : 'scale(0.97)', transition: 'transform 200ms',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
            Subir Plantilla
          </h2>
          <button onClick={close} style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
          }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Field label="Nombre *" error={errors.nombre}>
            <StyledInput
              value={form.nombre}
              onChange={v => set('nombre', v)}
              placeholder="Ej: Certificado de Aprobación Estándar"
              disabled={loading}
            />
          </Field>

          <Field label="Tipo de certificado">
            <StyledSelect
              value={form.tipo}
              onChange={v => set('tipo', v)}
              options={TIPOS_CERT}
              disabled={loading}
            />
          </Field>

          <Field label="Descripción (opcional)">
            <StyledTextarea
              value={form.descripcion}
              onChange={v => set('descripcion', v)}
              placeholder="Descripción breve de la plantilla..."
              disabled={loading}
            />
          </Field>

          {/* Zona de archivo */}
          <Field label="Archivo Word (.docx) *" error={errors.archivo}>
            <div
              onClick={() => !loading && fileRef.current?.click()}
              style={{
                border: `2px dashed ${errors.archivo ? 'var(--danger-400)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-md)', padding: '20px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                background: archivo ? 'var(--brand-50)' : 'var(--neutral-50)',
                transition: 'background 150ms',
              }}
            >
              {archivo ? (
                <>
                  <FileCheck size={28} style={{ color: 'var(--brand-500)' }} strokeWidth={1.5} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-600)' }}>
                    {archivo.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                    {(archivo.size / 1024).toFixed(1)} KB — Haz clic para cambiar
                  </span>
                </>
              ) : (
                <>
                  <Upload size={28} style={{ color: 'var(--fg-3)' }} strokeWidth={1.5} />
                  <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>
                    Haz clic para seleccionar un archivo .docx
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>Máximo 10 MB</span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              style={{ display: 'none' }}
              onChange={handleArchivo}
            />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)' }}>
          <Button
            variant="primary"
            size="md"
            loading={loading}
            onClick={handleSubmit}
            style={{ width: '100%' }}
          >
            {loading ? 'Subiendo...' : 'Guardar Plantilla'}
          </Button>
        </div>
      </div>
    </div>
  )
}
