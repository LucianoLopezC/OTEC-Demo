// Modal de creación y edición de cursos.
// Las categorías extras creadas por el usuario se persisten en localStorage.
import { useState, useEffect } from 'react'
import { X, Check, Plus } from 'lucide-react'
import Button  from '../../components/atoms/Button'
import { validarCurso, CONDICIONES, cargarCategorias, persistirCategoriaExtra, eliminarCategoriaLs, VIGENCIAS, MODALIDADES } from './utils'
import { useApp } from '../../context/AppContext'

function OverlayCard({ onClose, children }) {
  const [vis, setVis] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setVis(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  const close = () => { setVis(false); setTimeout(onClose, 200) }
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={undefined}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,27,71,0.40)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--modal-pad)',
        opacity: vis ? 1 : 0, transition: 'opacity 200ms',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: 760,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: vis ? 'scale(1)' : 'scale(0.97)',
        transition: 'transform 200ms',
      }}>
        {children(close)}
      </div>
    </div>
  )
}

function Field({ label, error, children, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: 'var(--danger-500)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function StyledInput({ value, onChange, placeholder, style }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', height: 36, padding: '0 10px', fontSize: 13,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'var(--font-sans)',
        boxSizing: 'border-box', ...style,
      }}
    />
  )
}

function StyledSelect({ value, onChange, options }) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', height: 36, paddingLeft: 10, paddingRight: 28,
        fontSize: 13, color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', appearance: 'none',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}
    >
      {options.map(o => (
        <option key={typeof o === 'object' ? o.value : o} value={typeof o === 'object' ? o.value : o}>
          {typeof o === 'object' ? o.label : o}
        </option>
      ))}
    </select>
  )
}

function StyledTextarea({ value, onChange, placeholder, height = 100, mono }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', height, padding: '8px 10px', fontSize: 13,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', resize: 'vertical',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        lineHeight: 1.6, boxSizing: 'border-box',
      }}
    />
  )
}

function parsearContenidosPreview(contenidos) {
  if (!contenidos) return []
  const lineas = contenidos.split('\n').map(l => l.trim()).filter(Boolean)
  const modulos = []
  let actual = null
  lineas.forEach(linea => {
    const esTitulo = /^M[ÓO]DULO\s*\d+:/i.test(linea) ||
                     /^\d+\s*:/.test(linea) ||
                     (linea === linea.toUpperCase() && linea.endsWith(':') && linea.length > 5)
    const esItem   = /^[•\-*]/.test(linea)
    if (esTitulo) {
      actual = { titulo: linea, items: [] }
      modulos.push(actual)
    } else if (esItem) {
      if (!actual) { actual = { titulo: '', items: [] }; modulos.push(actual) }
      actual.items.push(linea.replace(/^[•\-*]\s*/, ''))
    } else {
      if (!actual) { actual = { titulo: linea, items: [] }; modulos.push(actual) }
      else actual.items.push(linea)
    }
  })
  return modulos
}

const EMPTY_FORM = {
  nombre: '', codigoSence: 'NO-APLICA', horas: '', condicion: '',
  modalidad: 'Presencial', estado: 'Activo', categorias: [], objetivos: '', contenidos: '',
  plantillaId: null, vigenciaMeses: 12, precio: '',
  porcentajeAsistencia: 75, porcentajeAprobacion: 60,
}

export default function ModalCurso({ curso, onClose, onSave, onNavPlantilla }) {
  const { plantillas, cursos } = useApp()
  const isEdit = curso && curso !== 'nuevo'

  const [form, setForm] = useState(() => isEdit ? {
    ...curso,
    horas: String(curso.horas ?? ''),
    categorias: [...(curso.categorias ?? [])],
  } : { ...EMPTY_FORM })

  const [errors,        setErrors]        = useState({})
  const [tab,           setTab]           = useState(0)
  const [categoriasDisp, setCategoriasDisp] = useState(() => {
    const base = cargarCategorias()
    const extras = isEdit ? (curso.categorias ?? []).filter(c => !base.includes(c)) : []
    return [...base, ...extras]
  })
  const [nuevaCat,       setNuevaCat]     = useState('')
  const [modoGestion,    setModoGestion]  = useState(false)

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: null }))
  }

  const toggleCat = (cat) => {
    const nuevo = form.categorias.includes(cat)
      ? form.categorias.filter(c => c !== cat)
      : [...form.categorias, cat]
    set('categorias', nuevo)
  }

  const agregarCategoria = () => {
    const cat = nuevaCat.trim()
    if (!cat) return
    if (!categoriasDisp.includes(cat)) {
      setCategoriasDisp(p => [...p, cat])
      persistirCategoriaExtra(cat)
    }
    if (!modoGestion && !form.categorias.includes(cat)) set('categorias', [...form.categorias, cat])
    setNuevaCat('')
  }

  const usosDeCategoria = (cat) =>
    (cursos ?? []).filter(c => c.categorias?.includes(cat)).length

  const handleEliminarCategoria = (cat) => {
    if (usosDeCategoria(cat) > 0) return
    eliminarCategoriaLs(cat)
    setCategoriasDisp(p => p.filter(c => c !== cat))
    if (form.categorias.includes(cat)) set('categorias', form.categorias.filter(c => c !== cat))
  }

  const handleSave = (close) => {
    const errs = validarCurso(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      if (errs.nombre || errs.codigoSence || errs.horas || errs.condicion || errs.categorias) setTab(0)
      return
    }
    const horasNum = parseFloat(String(form.horas).replace(',', '.'))
    onSave({ ...form, horas: horasNum })
    close()
  }

  const TABS = ['Información General', 'Contenido', 'Configuración']

  return (
    <OverlayCard onClose={onClose}>
      {(close) => (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
              {isEdit ? 'Editar Curso' : 'Nuevo Curso'}
            </h2>
            <button onClick={close} style={{
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
            }}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border-subtle)',
            padding: '0 24px', flexShrink: 0, gap: 0,
          }}>
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: tab === i ? 600 : 400,
                  color: tab === i ? 'var(--brand-600)' : 'var(--fg-3)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: tab === i ? '2px solid var(--brand-600)' : '2px solid transparent',
                  marginBottom: -1, transition: 'all 150ms',
                }}
              >{t}</button>
            ))}
          </div>

          {/* Body */}
          <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

            {/* ── Tab 0: Información General ── */}
            {tab === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Nombre del Curso *" error={errors.nombre} fullWidth>
                  <StyledInput
                    value={form.nombre}
                    onChange={v => set('nombre', v)}
                    placeholder="Nombre completo del curso"
                  />
                </Field>

                <Field label="Código SENCE *" error={errors.codigoSence}>
                  <StyledInput
                    value={form.codigoSence}
                    onChange={v => set('codigoSence', v)}
                    placeholder="NO-APLICA o 13 dígitos"
                  />
                </Field>

                <Field label="Horas del Curso *" error={errors.horas}>
                  <StyledInput
                    value={form.horas}
                    onChange={v => set('horas', v.replace(/[^0-9.,]/g, ''))}
                    placeholder="Ej: 8 o 2,5"
                  />
                </Field>

                <Field label="Condición *" error={errors.condicion}>
                  <StyledSelect
                    value={form.condicion}
                    onChange={v => set('condicion', v)}
                    options={[{ value: '', label: '— Seleccionar —' }, ...CONDICIONES]}
                  />
                </Field>

                <Field label="Estado *" error={errors.estado}>
                  <StyledSelect
                    value={form.estado}
                    onChange={v => set('estado', v)}
                    options={['Activo', 'Borrador', 'Archivado']}
                  />
                </Field>

                <Field label="Modalidad *" error={errors.modalidad}>
                  <StyledSelect
                    value={form.modalidad ?? 'Presencial'}
                    onChange={v => set('modalidad', v)}
                    options={MODALIDADES}
                  />
                </Field>

                {/* Categorías */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>
                      Categorías *
                    </label>
                    <button
                      onClick={() => setModoGestion(m => !m)}
                      style={{
                        fontSize: 11, fontWeight: modoGestion ? 600 : 400,
                        color: modoGestion ? 'var(--brand-600)' : 'var(--fg-4)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      {modoGestion ? <><Check size={11} strokeWidth={2.5} /> Listo</> : 'Gestionar lista'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {categoriasDisp.map(cat => {
                      const sel = form.categorias.includes(cat)
                      if (modoGestion) {
                        const usos = usosDeCategoria(cat)
                        const bloqueada = usos > 0
                        return (
                          <div
                            key={cat}
                            title={bloqueada ? `Usada en ${usos} ${usos === 1 ? 'curso' : 'cursos'} — no se puede eliminar` : undefined}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: bloqueada ? '4px 8px 4px 10px' : '4px 6px 4px 10px',
                              borderRadius: 999, fontSize: 12,
                              background: bloqueada ? 'var(--neutral-50)' : 'var(--neutral-100)',
                              border: `1px solid ${bloqueada ? 'var(--border-subtle)' : 'var(--border-default)'}`,
                              color: bloqueada ? 'var(--fg-4)' : 'var(--fg-2)',
                            }}
                          >
                            {cat}
                            {bloqueada ? (
                              <span style={{
                                fontSize: 10, fontWeight: 600, color: 'var(--fg-4)',
                                background: 'var(--neutral-100)', borderRadius: 999,
                                padding: '1px 5px', lineHeight: 1.4,
                              }}>
                                {usos}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleEliminarCategoria(cat)}
                                title="Eliminar de la lista"
                                style={{
                                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--danger-50)', border: 'none', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'var(--danger-500)', padding: 0,
                                }}
                              >
                                <X size={9} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        )
                      }
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleCat(cat)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                            fontSize: 12, fontWeight: sel ? 600 : 400, transition: 'all 150ms',
                            background: sel ? 'var(--brand-50)' : 'var(--neutral-100)',
                            border: sel ? '1px solid var(--brand-200)' : '1px solid transparent',
                            color: sel ? 'var(--brand-600)' : 'var(--fg-2)',
                          }}
                        >
                          {sel && <Check size={11} strokeWidth={2.5} />}
                          {cat}
                        </button>
                      )
                    })}
                  </div>

                  {errors.categorias && !modoGestion && (
                    <div style={{ fontSize: 11, color: 'var(--danger-500)', marginBottom: 8 }}>{errors.categorias}</div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={nuevaCat}
                      onChange={e => setNuevaCat(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && agregarCategoria()}
                      placeholder={modoGestion ? 'Agregar nueva categoría a la lista...' : 'Agregar categoría personalizada...'}
                      style={{
                        flex: 1, height: 32, padding: '0 10px', fontSize: 12,
                        color: 'var(--fg-2)', background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'var(--font-sans)',
                      }}
                    />
                    <button
                      onClick={agregarCategoria}
                      style={{
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--brand-600)', color: '#fff', border: 'none',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} strokeWidth={2.5} />
                    </button>
                  </div>

                  {modoGestion && (
                    <p style={{ fontSize: 11, color: 'var(--fg-4)', margin: '6px 0 0' }}>
                      Las categorías con número de cursos no pueden eliminarse mientras estén en uso.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab 1: Contenido ── */}
            {tab === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Objetivos del Curso">
                  <StyledTextarea
                    value={form.objetivos}
                    onChange={v => set('objetivos', v)}
                    placeholder="Describir los objetivos generales del curso..."
                    height={100}
                  />
                </Field>
                <Field label="Contenidos / Temario">
                  <StyledTextarea
                    value={form.contenidos}
                    onChange={v => set('contenidos', v)}
                    placeholder={'MÓDULO 1: NOMBRE DEL MÓDULO\n- Contenido 1\n- Contenido 2\nMÓDULO 2: NOMBRE DEL MÓDULO\n- Contenido 1'}
                    height={160}
                    mono
                  />
                  <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 4 }}>
                    Títulos: <code>MÓDULO 1:</code>, <code>1:</code> o texto en MAYÚSCULAS terminado en <code>:</code> · sub-contenidos con <code>- </code> al inicio
                  </div>
                  {form.contenidos && (() => {
                    const modulos = parsearContenidosPreview(form.contenidos)
                    if (!modulos.length) return null
                    return (
                      <div style={{
                        marginTop: 8, padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--neutral-50)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fg-4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Vista previa en certificado
                        </div>
                        {modulos.map((m, i) => (
                          <div key={i} style={{ marginBottom: i < modulos.length - 1 ? 8 : 0 }}>
                            {m.titulo && (
                              <div style={{ fontWeight: 700, color: 'var(--fg-1)', fontSize: 12 }}>
                                {m.titulo}
                              </div>
                            )}
                            {m.items.map((item, j) => (
                              <div key={j} style={{ color: 'var(--fg-3)', paddingLeft: 12, fontSize: 12, lineHeight: 1.6 }}>
                                - {item}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </Field>
              </div>
            )}

            {/* ── Tab 2: Configuración ── */}
            {tab === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Plantilla de Certificado">
                  <StyledSelect
                    value={form.plantillaId ?? ''}
                    onChange={v => set('plantillaId', v === '' ? null : v)}
                    options={[
                      { value: '', label: 'Plantilla por defecto (PDF)' },
                      ...(plantillas ?? []).map(p => ({ value: p.id, label: `${p.nombre}  (${p.tipo ?? ''})` })),
                    ]}
                  />
                </Field>

                {form.plantillaId && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--neutral-50)', border: '1px solid var(--border-subtle)',
                    fontSize: 13, color: 'var(--fg-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>
                      Plantilla: <strong>{(plantillas ?? []).find(p => String(p.id) === String(form.plantillaId))?.nombre}</strong>
                    </span>
                    {onNavPlantilla && (
                      <button
                        onClick={() => onNavPlantilla('plantillas')}
                        style={{
                          fontSize: 12, color: 'var(--brand-600)', fontWeight: 500,
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        }}
                      >
                        Ver plantilla →
                      </button>
                    )}
                  </div>
                )}

                <Field label="Vigencia del Certificado">
                  <StyledSelect
                    value={form.vigenciaMeses ?? 12}
                    onChange={v => set('vigenciaMeses', Number(v))}
                    options={[
                      { value: 0, label: 'Sin vencimiento' },
                      ...VIGENCIAS.map(v => {
                        const años = v / 12
                        const añoLabel = años % 1 === 0
                          ? `${años} ${años === 1 ? 'año' : 'años'}`
                          : `${Math.floor(años)} año${Math.floor(años) > 1 ? 's' : ''} y ${v % 12} meses`
                        return { value: v, label: v < 12 ? `${v} meses` : `${v} meses (${añoLabel})` }
                      }),
                    ]}
                  />
                </Field>

                <Field label="Precio (CLP)">
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 13, color: 'var(--fg-3)', pointerEvents: 'none', userSelect: 'none',
                    }}>$</span>
                    <StyledInput
                      value={form.precio}
                      onChange={v => set('precio', v.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      style={{ paddingLeft: 22 }}
                    />
                  </div>
                </Field>

                <div style={{ gridColumn: '1 / -1', height: 1, background: 'var(--border-subtle)' }} />

                <Field label="Asistencia mínima (%)">
                  <div style={{ position: 'relative' }}>
                    <StyledInput
                      value={form.porcentajeAsistencia ?? ''}
                      onChange={v => set('porcentajeAsistencia', v === '' ? '' : Math.min(100, Math.max(0, Number(v.replace(/[^0-9]/g, '')))))}
                      placeholder="75"
                      style={{ paddingRight: 30 }}
                    />
                    <span style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 13, color: 'var(--fg-3)', pointerEvents: 'none', userSelect: 'none',
                    }}>%</span>
                  </div>
                </Field>

                <Field label="Aprobación mínima (%)">
                  <div style={{ position: 'relative' }}>
                    <StyledInput
                      value={form.porcentajeAprobacion ?? ''}
                      onChange={v => set('porcentajeAprobacion', v === '' ? '' : Math.min(100, Math.max(0, Number(v.replace(/[^0-9]/g, '')))))}
                      placeholder="60"
                      style={{ paddingRight: 30 }}
                    />
                    <span style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 13, color: 'var(--fg-3)', pointerEvents: 'none', userSelect: 'none',
                    }}>%</span>
                  </div>
                </Field>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {TABS.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: tab === i ? 'var(--brand-600)' : 'var(--neutral-300)',
                    transition: 'background 150ms',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="md" onClick={close}>Cancelar</Button>
              {tab < 2 && (
                <Button variant="secondary" size="md" onClick={() => setTab(t => t + 1)}>
                  Siguiente →
                </Button>
              )}
              <Button variant="primary" size="md" onClick={() => handleSave(close)}>
                {isEdit ? 'Guardar cambios' : 'Crear curso'}
              </Button>
            </div>
          </div>
        </>
      )}
    </OverlayCard>
  )
}
