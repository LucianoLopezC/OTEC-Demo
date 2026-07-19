// Paso 2 del wizard de emisión: tabla editable de participantes con asistencia y evaluación.
// El estado (Aprobado/Reprobado/Pendiente) se calcula automáticamente al cambiar los valores.
import { useState, useMemo } from 'react'
import { Users, Plus, Upload, Edit2, Trash2, Award, ChevronLeft } from 'lucide-react'
import Button     from '../../components/atoms/Button'
import IconButton from '../../components/atoms/IconButton'
import Badge      from '../../components/atoms/Badge'
import Avatar     from '../../components/atoms/Avatar'
import ModalAgregarPersona    from './ModalAgregarPersona'
import ModalCargaMasivaPersonas from './ModalCargaMasivaPersonas'
import { calcularEstado } from './utils'
import { useConfirm } from '../../context/ConfirmContext'

const ESTADO_BADGE  = { Aprobado: 'success', Reprobado: 'danger', Pendiente: 'neutral' }
const TONE_CHIP     = {
  total:      { bg: 'var(--neutral-100)',       color: 'var(--fg-2)'          },
  Aprobado:   { bg: 'var(--success-50)',        color: 'var(--success-600)'   },
  Reprobado:  { bg: 'var(--danger-50)',         color: 'var(--danger-600)'    },
  Pendiente:  { bg: 'var(--neutral-100)',       color: 'var(--neutral-600)'   },
}

/* editable number cell */
function NumCell({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: focused ? 'var(--neutral-50)' : 'transparent',
      borderRadius: 4, padding: '0 4px', transition: 'background 150ms',
    }}>
      <input
        type="number" min={0} max={100}
        value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: 48, fontSize: 13, textAlign: 'center',
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: 'var(--font-sans)', color: 'var(--fg-2)',
        }}
      />
      <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>%</span>
    </div>
  )
}

export default function Paso2Participantes({ participantes, setParticipantes, datosCertificado, onAnterior, onGenerar, formatoSalida, onFormatoChange }) {
  const minA = datosCertificado?.porcentajeAsistencia ?? 75
  const minE = datosCertificado?.porcentajeAprobacion ?? 60
  const [modalPersona, setModalPersona] = useState(null)
  const [modalCarga,   setModalCarga]   = useState(false)
  const [error,        setError]        = useState(null)
  const confirm = useConfirm()

  const updateField = (id, field, val) =>
    setParticipantes(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))

  const handleSavePersona = (form) => {
    if (form.id && participantes.find(p => p.id === form.id)) {
      setParticipantes(prev => prev.map(p => p.id === form.id ? form : p))
    } else {
      setParticipantes(prev => [...prev, { ...form, id: form.id ?? Date.now().toString() }])
    }
  }

  const handleDelete = async (p) => {
    const ok = await confirm(`¿Eliminar a "${p.nombre}" de la lista?`, { confirmLabel: 'Eliminar participante' })
    if (ok) setParticipantes(prev => prev.filter(x => x.id !== p.id))
  }

  const handleImportar = (nuevas) => {
    const conId = nuevas.map((p, i) => ({ ...p, id: (Date.now() + i).toString() }))
    setParticipantes(prev => [...prev, ...conId])
    setModalCarga(false)
  }

  /* stats */
  const stats = useMemo(() => {
    const aprobados  = participantes.filter(p => calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Aprobado').length
    const reprobados = participantes.filter(p => calcularEstado(p.asistencia, p.evaluacion, minA, minE) === 'Reprobado').length
    const pendientes = participantes.length - aprobados - reprobados
    const pct = participantes.length > 0 ? Math.round((aprobados / participantes.length) * 100) : 0
    return { aprobados, reprobados, pendientes, pct }
  }, [participantes])

  const handleGenerar = () => {
    if (participantes.length === 0)   { setError('Agregue al menos un participante'); return }
    const sinDatos = participantes.some(p => !p.nombre?.trim() || !p.rut?.trim())
    if (sinDatos)                      { setError('Hay participantes con datos incompletos'); return }
    const malValores = participantes.some(p => {
      const a = Number(p.asistencia), e = Number(p.evaluacion)
      return isNaN(a) || isNaN(e) || a < 0 || a > 100 || e < 0 || e > 100
    })
    if (malValores)                    { setError('Revise los valores de asistencia y evaluación'); return }
    setError(null)
    onGenerar()
  }

  const TD = { padding: '10px 14px', fontSize: 13, color: 'var(--fg-2)', verticalAlign: 'middle' }
  const TH = { padding: '9px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-3)', background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Card participantes */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-1)' }}>Participantes inscritos</span>
              <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{participantes.length} personas</span>
              {participantes.length > 0 && (
                <Badge variant="success">{stats.pct}% aprobación</Badge>
              )}
            </div>
            {/* Stats chips */}
            {participantes.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[
                  { label: `Total: ${participantes.length}`,       key: 'total' },
                  { label: `Aprobados: ${stats.aprobados}`,        key: 'Aprobado' },
                  { label: `Reprobados: ${stats.reprobados}`,      key: 'Reprobado' },
                  { label: `Pendientes: ${stats.pendientes}`,      key: 'Pendiente' },
                ].map(chip => (
                  <span key={chip.key} style={{
                    fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
                    background: TONE_CHIP[chip.key].bg, color: TONE_CHIP[chip.key].color,
                  }}>
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => setModalCarga(true)}>Carga Excel</Button>
            <Button variant="primary"   size="sm" icon={Plus}   onClick={() => setModalPersona({})}>Agregar persona</Button>
          </div>
        </div>

        {/* Tabla */}
        {participantes.length === 0 ? (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <Users size={40} strokeWidth={1.25} color="var(--fg-3)" />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)' }}>Sin participantes agregados</div>
            <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>Agregue personas manualmente o importe desde Excel.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Button variant="primary"   size="sm" icon={Plus}   onClick={() => setModalPersona({})}>Agregar persona</Button>
              <Button variant="secondary" size="sm" icon={Upload}  onClick={() => setModalCarga(true)}>Importar Excel</Button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>#</th>
                  <th style={TH}>Nombre</th>
                  <th style={TH}>RUT</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Asistencia</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Evaluación</th>
                  <th style={TH}>Estado</th>
                  <th style={TH} />
                </tr>
              </thead>
              <tbody>
                {participantes.map((p, i) => {
                  const est = calcularEstado(p.asistencia, p.evaluacion, minA, minE)
                  return (
                    <ParticipanteRow key={p.id}
                      p={p} i={i} est={est}
                      onUpdateField={(f, v) => updateField(p.id, f, v)}
                      onEdit={() => setModalPersona(p)}
                      onDelete={() => handleDelete(p)}
                      TD={TD}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: 'var(--danger-50)', color: 'var(--danger-600)',
          fontSize: 13, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Button variant="ghost" size="md" icon={ChevronLeft} onClick={onAnterior}>
          Anterior: Datos del Certificado
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Selector de formato */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-3)' }}>Formato:</span>
            <div style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { key: 'pdf',  label: 'PDF'  },
                { key: 'word', label: 'Word' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFormatoChange(key)}
                  style={{
                    padding: '6px 16px', fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer', transition: 'all 150ms',
                    background: formatoSalida === key ? 'var(--brand-600)' : 'var(--bg-surface)',
                    color: formatoSalida === key ? '#fff' : 'var(--fg-3)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" size="md" icon={Award} onClick={handleGenerar}>
            Confirmar y Generar
          </Button>
        </div>
      </div>

      {modalPersona !== null && (
        <ModalAgregarPersona
          persona={modalPersona?.id ? modalPersona : null}
          participantes={participantes}
          onClose={() => setModalPersona(null)}
          onSave={handleSavePersona}
          minAsistencia={minA}
          minAprobacion={minE}
        />
      )}
      {modalCarga && (
        <ModalCargaMasivaPersonas
          onClose={() => setModalCarga(false)}
          onImportar={handleImportar}
          participantesExistentes={participantes}
          minAsistencia={minA}
          minAprobacion={minE}
        />
      )}
    </div>
  )
}

function ParticipanteRow({ p, i, est, onUpdateField, onEdit, onDelete, TD }) {
  const [hov, setHov] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderTop: '1px solid var(--border-subtle)', background: hov ? 'var(--neutral-25)' : 'var(--bg-surface)' }}
    >
      <td style={{ ...TD, color: 'var(--fg-4)', width: 40 }}>{i + 1}</td>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={p.nombre} size={28} />
          <span style={{ fontWeight: 500 }}>{p.nombre}</span>
        </div>
      </td>
      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>{p.rut}</td>
      <td style={{ ...TD, textAlign: 'center' }}>
        <NumCell value={p.asistencia} onChange={v => onUpdateField('asistencia', v)} />
      </td>
      <td style={{ ...TD, textAlign: 'center' }}>
        <NumCell value={p.evaluacion} onChange={v => onUpdateField('evaluacion', v)} />
      </td>
      <td style={TD}><Badge variant={ESTADO_BADGE[est] ?? 'neutral'}>{est}</Badge></td>
      <td style={{ ...TD, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <IconButton icon={Edit2}  size={28} variant="ghost" title="Editar"   onClick={onEdit} />
          <IconButton icon={Trash2} size={28} variant="ghost" title="Eliminar" onClick={onDelete}
            style={{ color: 'var(--danger-500)' }} />
        </div>
      </td>
    </tr>
  )
}
