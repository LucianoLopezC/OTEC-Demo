// Paso 1 del wizard de emisión: selección de curso, empresa, fechas, lugar y vigencia.
// Guarda un borrador en localStorage (otec_demo_emision_draft) para no perder los datos si se recarga.
import { useState, useEffect } from 'react'
import { Save, ChevronRight } from 'lucide-react'
import Button    from '../../components/atoms/Button'
import FormField from '../../components/atoms/FormField'
import TextInput from '../../components/atoms/TextInput'
import { useApp } from '../../context/AppContext'
import { useEmpresaFiltro } from '../../hooks/useEmpresaFiltro'
import { useResponsive } from '../../hooks/useResponsive'

const CONDICION_OPT = ['TEÓRICO - PRÁCTICO', 'TEÓRICO', 'PRÁCTICO', 'E-LEARNING']
const ESTADO_OPT    = ['Activo', 'Inválido']

function calcFechaFinValidez(fechaEmision, vigenciaMeses) {
  if (!fechaEmision || !vigenciaMeses) return ''
  const d = new Date(fechaEmision)
  d.setMonth(d.getMonth() + Number(vigenciaMeses))
  return d.toISOString().slice(0, 10)
}

function formatFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/* inline date input estilizado */
function StyledDate({ value, onChange, id }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      id={id} type="date" value={value} onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', height: 38, padding: '0 12px', fontSize: 13,
        color: value ? 'var(--fg-2)' : 'var(--neutral-400)',
        fontWeight: value ? '700' : '400',
        background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none',
        boxShadow: focused ? 'var(--shadow-focus)' : 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
        fontFamily: 'var(--font-sans)',
      }}
    />
  )
}

/* inline select estilizado */
function StyledSelect({ value, onChange, options, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value} onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', height: 38, paddingLeft: 12, paddingRight: 28,
          fontSize: 13, color: value ? 'var(--fg-2)' : 'var(--neutral-400)',
          fontWeight: value ? '700' : '400',
          background: 'var(--bg-surface)',
          border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)', outline: 'none', appearance: 'none',
          boxShadow: focused ? 'var(--shadow-focus)' : 'none',
          transition: 'border-color 150ms, box-shadow 150ms',
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--neutral-400)', fontSize: 10 }}>▼</span>
    </div>
  )
}

export default function Paso1Datos({ datos, setDatos, onSiguiente, onGuardar, showToast }) {
  const { cursos, empresas } = useApp()
  const { esEmpresa, empresaId, empresaNombre } = useEmpresaFiltro()
  const { isMobile } = useResponsive()
  const [errores, setErrores] = useState({})

  /* Si el rol es empresa y aún no hay empresa prellenada, preseleccionarla */
  useEffect(() => {
    if (esEmpresa && empresaId && !datos.empresaId) {
      const empresa = empresas.find(e => String(e.id) === String(empresaId))
      setDatos(prev => ({ ...prev, empresaId, empresaNombre: empresa?.nombre ?? empresaNombre ?? '' }))
    }
  }, [esEmpresa, empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (changes) => setDatos(prev => ({ ...prev, ...changes }))
  const set    = (k, v)    => {
    if (k === 'fechaEmision') {
      update({ fechaEmision: v, fechaFinValidez: calcFechaFinValidez(v, datos.vigenciaMeses) })
    } else {
      update({ [k]: v })
    }
    setErrores(e => ({ ...e, [k]: null }))
  }

  const handleCursoChange = (e) => {
    const id    = e.target.value
    const curso = cursos.find(c => String(c.id) === id)
    if (curso) {
      const meses = curso.vigenciaMeses ?? 12
      update({
        cursoId: id, cursoNombre: curso.nombre,
        codigoSence: curso.codigoSence,
        horas: String(curso.horas),
        condicion: curso.condicion,
        modalidad: curso.modalidad || '',
        contenidos: curso.contenidos || '',
        vigenciaMeses: meses,
        fechaFinValidez: calcFechaFinValidez(datos.fechaEmision, meses),
        porcentajeAsistencia: curso.porcentajeAsistencia ?? 75,
        porcentajeAprobacion: curso.porcentajeAprobacion ?? 60,
      })
    } else {
      update({ cursoId: '', cursoNombre: '', modalidad: '', contenidos: '', vigenciaMeses: 12, fechaFinValidez: '', porcentajeAsistencia: 75, porcentajeAprobacion: 60 })
    }
    setErrores(e => ({ ...e, cursoId: null }))
  }

  const handleEmpresaChange = (e) => {
    const id      = e.target.value
    const empresa = empresas.find(em => String(em.id) === id)
    update({ empresaId: id, empresaNombre: empresa?.nombre ?? '' })
    setErrores(e => ({ ...e, empresaId: null }))
  }

  const validate = () => {
    const e = {}
    if (!datos.cursoId)                                          e.cursoId        = 'Seleccione un curso'
    if (!datos.empresaId)                                        e.empresaId      = 'Seleccione una empresa'
    if (!datos.fechaInicio)                                      e.fechaInicio    = 'Ingrese la fecha de inicio'
    if (!datos.fechaTermino)                                     e.fechaTermino   = 'Ingrese la fecha de término'
    else if (datos.fechaTermino < datos.fechaInicio)             e.fechaTermino   = 'Debe ser igual o posterior al inicio'
    if (!datos.condicion)                                        e.condicion      = 'Seleccione la condición'
    if (!datos.fechaEmision)                                     e.fechaEmision   = 'Ingrese la fecha de emisión'
    return e
  }

  const handleSiguiente = () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrores(e)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    onSiguiente()
  }

  const handleGuardar = () => {
    onGuardar()
  }

  const empresasActivas = empresas.filter(e => e.estado === 'Activa')
  const cursosActivos   = cursos.filter(c => c.estado === 'Activo')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Formulario */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 14,
        boxShadow: 'var(--shadow-sm)', padding: '26px 28px',
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '18px 24px',
      }}>
        {/* Curso — full width */}
        <FormField label="Nombre del Curso" required error={errores.cursoId} style={{ gridColumn: '1/-1' }}>
          <StyledSelect
            value={datos.cursoId}
            onChange={handleCursoChange}
            placeholder="— Seleccione un curso —"
            options={cursosActivos.map(c => ({ value: c.id, label: c.nombre }))}
          />
        </FormField>

        {/* Empresa — full width; readonly si el usuario tiene scope de empresa */}
        <FormField label="Empresa" required error={errores.empresaId} style={{ gridColumn: '1/-1' }}>
          {esEmpresa ? (
            <TextInput value={datos.empresaNombre || empresaNombre || ''} disabled readOnly />
          ) : (
            <StyledSelect
              value={datos.empresaId}
              onChange={handleEmpresaChange}
              placeholder="— Seleccione una empresa —"
              options={empresasActivas.map(e => ({ value: e.id, label: e.nombre }))}
            />
          )}
        </FormField>

        {/* Código SENCE */}
        <FormField label="Código SENCE" error={errores.codigoSence} style={{ gridColumn: '1/-1' }}>
          <TextInput
            placeholder="NO-APLICA"
            value={datos.codigoSence}
            onChange={e => set('codigoSence', e.target.value)}
          />
        </FormField>

        {/* Fechas inicio / término */}
        <FormField label="Fecha de Inicio" required error={errores.fechaInicio}>
          <StyledDate value={datos.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
        </FormField>
        <FormField label="Fecha de Término" required error={errores.fechaTermino}>
          <StyledDate value={datos.fechaTermino} onChange={e => set('fechaTermino', e.target.value)} />
        </FormField>

        {/* Lugar — full width */}
        <FormField label="Lugar de Ejecución" error={errores.lugarEjecucion} style={{ gridColumn: '1/-1' }}>
          <TextInput
            placeholder="INSTALACIONES CLIENTE / DEPENDENCIAS EMPRESA"
            value={datos.lugarEjecucion}
            onChange={e => set('lugarEjecucion', e.target.value)}
            error={!!errores.lugarEjecucion}
          />
        </FormField>

        {/* Condición / Estado */}
        <FormField label="Condición" required error={errores.condicion}>
          <StyledSelect
            value={datos.condicion}
            onChange={e => set('condicion', e.target.value)}
            options={CONDICION_OPT}
          />
        </FormField>
        <FormField label="Estado" required error={errores.estado}>
          <StyledSelect
            value={datos.estado}
            onChange={e => set('estado', e.target.value)}
            options={ESTADO_OPT}
          />
        </FormField>

        {/* Fecha de emisión — la fecha fin de validez se calcula automáticamente */}
        <FormField label="Fecha de Emisión" required error={errores.fechaEmision} style={{ gridColumn: '1/-1' }}>
          <StyledDate value={datos.fechaEmision} onChange={e => set('fechaEmision', e.target.value)} />
          {datos.vigenciaMeses === 0 ? (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-3)' }}>
              Certificado <strong style={{ color: 'var(--fg-2)' }}>sin vencimiento</strong>
            </div>
          ) : datos.fechaFinValidez ? (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--fg-3)' }}>
              Vence el <strong style={{ color: 'var(--fg-2)' }}>{formatFecha(datos.fechaFinValidez)}</strong>
              {' '}({datos.vigenciaMeses} meses
              {datos.vigenciaMeses >= 12
                ? ` — ${datos.vigenciaMeses % 12 === 0
                    ? `${datos.vigenciaMeses / 12} ${datos.vigenciaMeses / 12 === 1 ? 'año' : 'años'}`
                    : `${Math.floor(datos.vigenciaMeses / 12)} año${Math.floor(datos.vigenciaMeses / 12) > 1 ? 's' : ''} y ${datos.vigenciaMeses % 12} meses`}`
                : ''})
            </div>
          ) : null}
        </FormField>

        {/* Condiciones de aprobación */}
        <FormField label="% Mínimo de Asistencia">
          <TextInput
            type="number" min="0" max="100"
            value={datos.porcentajeAsistencia ?? 75}
            onChange={e => set('porcentajeAsistencia', Number(e.target.value))}
          />
        </FormField>
        <FormField label="% Mínimo de Aprobación">
          <TextInput
            type="number" min="0" max="100"
            value={datos.porcentajeAprobacion ?? 60}
            onChange={e => set('porcentajeAprobacion', Number(e.target.value))}
          />
        </FormField>
        <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--fg-3)', marginTop: -10 }}>
          Si no se modifican, se utilizarán los porcentajes preestablecidos dentro del curso seleccionado. Estos valores determinan el estado Aprobado / Reprobado de los participantes.
        </div>

      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="secondary" size="md" icon={Save} onClick={handleGuardar}>
          Guardar progreso
        </Button>
        <Button variant="primary" size="md" iconRight={ChevronRight} onClick={handleSiguiente}>
          Siguiente: Participantes
        </Button>
      </div>
    </div>
  )
}
