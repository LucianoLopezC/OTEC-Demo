// Generador de cotizaciones: arma una lista de cursos con precios y descuentos,
// y genera un PDF profesional para enviar a clientes. No guarda nada en la BD.
import { useState, useMemo, useEffect, Fragment } from 'react'
import {
  Plus, Trash2, FileText, AlertCircle, CheckCircle2,
  Building2, BookOpen, ChevronDown, History,
} from 'lucide-react'
import Button     from '../../components/atoms/Button'
import Badge      from '../../components/atoms/Badge'
import { useApp } from '../../context/AppContext'
import { generarCotizacionPDF }   from './generarCotizacionPDF'
import { generarCotizacionExcel } from './generarCotizacionExcel'
import { descargarPlantillaDocx } from '../../services/supabase'
import { apiFetch } from '../../services/apiClient'
import { useResponsive } from '../../hooks/useResponsive'
import { hoyChile } from '../../utils/fecha'
import ModalHistorialCotizaciones from './ModalHistorialCotizaciones'

/* ── Helpers ── */
function fmtMonto(n) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function formatRut(value) {
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv   = clean.slice(-1)
  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv
}

async function fetchNextNumero() {
  const y = new Date().getFullYear()
  try {
    const data = await apiFetch('cotizaciones.php?next=1')
    return `${String(data.next || 1).padStart(3, '0')}-${y}`
  } catch {
    const key = `otec_demo_cot_${y}`
    const last = parseInt(localStorage.getItem(key) || '0')
    return `${String(last + 1).padStart(3, '0')}-${y}`
  }
}

// Reserva atómica: el servidor bloquea la tabla, asigna el número y guarda
// una fila placeholder antes de generar el PDF. Así dos dispositivos nunca
// pueden obtener el mismo número.
async function claimNumero() {
  const data = await apiFetch('cotizaciones.php?claim=1')
  return { numero: data.numero, id: data.id }
}

/* ── Sub-components ── */
function Card({ children, style }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)', overflow: 'visible',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }) {
  return (
    <div style={{
      padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
      fontSize: 14, fontWeight: 700, color: 'var(--fg-1)',
    }}>
      {children}
    </div>
  )
}

function StyledSelect({ value, onChange, children, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', height: 38, paddingLeft: 10, paddingRight: 30,
          fontSize: 13, color: value ? 'var(--fg-1)' : 'var(--fg-4)',
          background: 'var(--bg-surface)',
          border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)', outline: 'none', appearance: 'none',
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown size={14} strokeWidth={2} style={{
        position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--fg-3)', pointerEvents: 'none',
      }} />
    </div>
  )
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      background: toast.type === 'error' ? 'var(--danger-500)' : 'var(--success-500)',
      color: '#fff', borderRadius: 'var(--radius-md)',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: 'var(--shadow-lg)', fontSize: 13, fontWeight: 500,
    }}>
      <CheckCircle2 size={16} strokeWidth={2} />
      {toast.msg}
    </div>
  )
}

function Stepper({ value, onChange, onBlur, onDecrement, onIncrement, width = 130, height = 38 }) {
  const btnStyle = {
    width: height, height: '100%', border: 'none', background: 'var(--neutral-50)',
    cursor: 'pointer', color: 'var(--fg-2)', fontSize: 16, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', height, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width }}>
      <button type="button" onClick={onDecrement} style={{ ...btnStyle, borderRight: '1px solid var(--border-subtle)' }}>−</button>
      <input
        type="text" inputMode="numeric" value={value}
        onChange={onChange} onBlur={onBlur}
        style={{ flex: 1, height: '100%', padding: '0 4px', fontSize: 13, textAlign: 'center', color: 'var(--fg-1)', background: 'var(--bg-surface)', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', minWidth: 0 }}
      />
      <button type="button" onClick={onIncrement} style={{ ...btnStyle, borderLeft: '1px solid var(--border-subtle)' }}>+</button>
    </div>
  )
}

/* ── Main ── */
export default function Cotizador() {
  const { empresas, cursos, plantillas } = useApp()
  const { isSmall } = useResponsive()

  const [empresaId,   setEmpresaId]   = useState('')
  const [cursoId,     setCursoId]     = useState('')
  const [cantidad,    setCantidad]    = useState(1)
  const [items,       setItems]       = useState([])
  const [notas,       setNotas]       = useState('')
  const [descuento,   setDescuento]   = useState(0)
  const [toast,          setToast]          = useState(null)
  const [generandoExcel, setGenerandoExcel] = useState(false)
  const [verHistorial,   setVerHistorial]   = useState(false)
  const [numero, setNumero] = useState('')
  const [fecha]   = useState(() => hoyChile())

  // Obtener número correlativo desde el servidor al montar
  useEffect(() => { fetchNextNumero().then(n => setNumero(n)) }, [])

  const plantillasCotizacion = useMemo(
    () => (plantillas ?? []).filter(p => p.categoria === 'cotizacion'),
    [plantillas]
  )
  const [plantillaId, setPlantillaId] = useState('')

  const empresa = useMemo(() => empresas.find(e => String(e.id) === empresaId) ?? null, [empresas, empresaId])

  /* Cálculos — servicios de capacitación exentos de IVA */
  const subtotal     = useMemo(() => items.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0), [items])
  const descMonto    = subtotal * ((Number(descuento) || 0) / 100)
  const totalExento  = subtotal - descMonto
  const total        = subtotal

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  /* Agregar curso */
  const agregarCurso = () => {
    if (!cursoId) { showToast('Seleccione un curso', 'error'); return }
    if (items.some(i => String(i.id) === cursoId)) { showToast('Ese curso ya está en la cotización', 'error'); return }
    const curso = cursos.find(c => String(c.id) === cursoId)
    if (!curso) return
    setItems(prev => [...prev, { ...curso, cantidad: Math.max(1, Number(cantidad) || 1), participantes: [] }])
    setCursoId('')
    setCantidad(1)
  }

  const actualizarCantidad = (idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: val.replace(/\D/g, '') } : it))
  }

  const fijarCantidad = (idx, val) => {
    const q = Math.max(1, Number(val) || 1)
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, cantidad: q } : it))
  }

  // Precio unitario editable — parte del valor configurado en el curso, pero el usuario
  // puede sobreescribirlo por cotización sin que esto afecte el precio base del curso.
  const actualizarPrecio = (idx, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, precio: val.replace(/[^\d]/g, '') } : it))
  }

  const fijarPrecio = (idx, val) => {
    const p = Math.max(0, Number(val) || 0)
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, precio: p } : it))
  }

  const eliminarItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const [expandedItems, setExpandedItems] = useState(new Set())

  const toggleExpand = (idx) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const agregarParticipante = (itemIdx) => {
    setItems(prev => prev.map((it, i) => i === itemIdx
      ? { ...it, participantes: [...(it.participantes ?? []), { nombre: '', rut: '' }] }
      : it
    ))
  }

  const actualizarParticipante = (itemIdx, partIdx, field, value) => {
    setItems(prev => prev.map((it, i) => i === itemIdx
      ? { ...it, participantes: it.participantes.map((p, pi) => pi === partIdx ? { ...p, [field]: value } : p) }
      : it
    ))
  }

  const eliminarParticipante = (itemIdx, partIdx) => {
    setItems(prev => prev.map((it, i) => i === itemIdx
      ? { ...it, participantes: it.participantes.filter((_, pi) => pi !== partIdx) }
      : it
    ))
  }

  const limpiar = () => {
    setItems([])
    setEmpresaId('')
    setNotas('')
    setCursoId('')
    setCantidad(1)
    setDescuento(0)
    setExpandedItems(new Set())
    fetchNextNumero().then(n => setNumero(n))
  }

  const handleGenerarPDF = async () => {
    if (!empresa)           { showToast('Seleccione una empresa', 'error'); return }
    if (items.length === 0) { showToast('Agregue al menos un curso', 'error'); return }

    // 1. Reservar número atómicamente en el servidor antes de generar el PDF.
    //    Si dos dispositivos pulsan a la vez, el lock de BD garantiza números distintos.
    let claimed
    try {
      claimed = await claimNumero()
      setNumero(claimed.numero)
    } catch {
      showToast('Error al reservar número de cotización', 'error')
      return
    }

    try {
      // 2. Generar el PDF con el número ya reservado
      await generarCotizacionPDF({ empresa, items, numero: claimed.numero, fecha, notas, descuento: Number(descuento) || 0 })
      showToast('Cotización PDF generada correctamente')
      // 3. Completar la fila reservada con los datos reales
      try {
        await apiFetch(`cotizaciones.php?id=${claimed.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            empresaId:       empresa.id ?? null,
            empresaNombre:   empresa.nombre,
            empresaRut:      empresa.rut      ?? null,
            empresaContacto: empresa.contacto ?? empresa.email ?? null,
            fecha,
            items,
            subtotal,
            notas: notas || null,
            estado: 'emitida',
          }),
        })
      } catch {}
      fetchNextNumero().then(n => setNumero(n))
    } catch {
      // Si el PDF falló, eliminar la fila reservada para no dejar huecos en el correlativo
      try { await apiFetch(`cotizaciones.php?id=${claimed.id}`, { method: 'DELETE' }) } catch {}
      fetchNextNumero().then(n => setNumero(n))
      showToast('Error al generar el PDF', 'error')
    }
  }

  const handleGenerarExcel = async () => {
    if (!empresa)           { showToast('Seleccione una empresa', 'error'); return }
    if (items.length === 0) { showToast('Agregue al menos un curso', 'error'); return }

    const plantilla = plantillaId
      ? plantillasCotizacion.find(p => String(p.id) === plantillaId)
      : plantillasCotizacion[0]

    if (!plantilla) { showToast('No hay plantillas de cotización disponibles', 'error'); return }

    setGenerandoExcel(true)
    try {
      const blob = await descargarPlantillaDocx(plantilla.storagePath)
      // Siempre buscar número fresco al momento de generar
      const numExcel = await fetchNextNumero()
      setNumero(numExcel)
      await generarCotizacionExcel(blob, { empresa, items, numero: numExcel, fecha, notas })
      showToast('Cotización Excel generada correctamente')
      fetchNextNumero().then(n => setNumero(n))
    } catch (err) {
      showToast(`Error al generar Excel: ${err.message}`, 'error')
    } finally {
      setGenerandoExcel(false)
    }
  }

  const sinPrecio = items.filter(i => !i.precio || Number(i.precio) === 0)

  /* ── Render ── */
  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Cotizador de Cursos</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '4px 0 0' }}>
            {numero} · {new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(fecha + 'T12:00:00'))}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="md" icon={History} onClick={() => setVerHistorial(true)}>Historial</Button>
          <Button variant="ghost" size="md" onClick={limpiar}>Limpiar todo</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 340px', gap: 'var(--card-gap)', alignItems: 'start' }}>

        {/* ── Columna izquierda ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Empresa */}
          <Card>
            <CardTitle><Building2 size={15} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />Empresa cliente</CardTitle>
            <div style={{ padding: '16px 20px' }}>
              <StyledSelect
                value={empresaId}
                onChange={setEmpresaId}
                placeholder="— Seleccione una empresa —"
              >
                {empresas.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </StyledSelect>
              {empresa && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                  fontSize: 12, color: 'var(--brand-700)',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
                }}>
                  {empresa.rut    && <span><strong>RUT:</strong> {empresa.rut}</span>}
                  {empresa.email  && <span><strong>Email:</strong> {empresa.email}</span>}
                  {empresa.region && <span style={{ gridColumn: '1/-1' }}><strong>Región:</strong> {empresa.region}</span>}
                </div>
              )}
            </div>
          </Card>

          {/* Agregar curso */}
          <Card>
            <CardTitle><BookOpen size={15} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />Agregar curso</CardTitle>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 5 }}>
                  Curso
                </label>
                <StyledSelect value={cursoId} onChange={setCursoId} placeholder="— Seleccione un curso —">
                  {cursos.filter(c => c.estado === 'Activo').map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </StyledSelect>
              </div>
              <div style={{ width: 130 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', display: 'block', marginBottom: 5 }}>
                  Cantidad
                </label>
                <Stepper
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => setCantidad(prev => Math.max(1, Number(prev) || 1))}
                  onDecrement={() => setCantidad(prev => Math.max(1, (Number(prev) || 1) - 1))}
                  onIncrement={() => setCantidad(prev => (Number(prev) || 0) + 1)}
                />
              </div>
              <Button variant="primary" size="md" icon={Plus} onClick={agregarCurso}>
                Agregar
              </Button>
            </div>
          </Card>

          {/* Tabla de ítems */}
          <Card>
            <CardTitle>Cursos en la cotización ({items.length})</CardTitle>

            {sinPrecio.length > 0 && (
              <div style={{
                margin: '12px 20px 0',
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--warning-50)', border: '1px solid var(--warning-200)',
                fontSize: 12, color: 'var(--warning-700)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={14} strokeWidth={2} />
                {sinPrecio.length === 1
                  ? `"${sinPrecio[0].nombre.slice(0, 40)}" no tiene precio configurado. Se cotizará en $0.`
                  : `${sinPrecio.length} cursos sin precio configurado se cotizarán en $0.`
                }
              </div>
            )}

            {items.length === 0 ? (
              <div style={{
                padding: '48px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <BookOpen size={36} strokeWidth={1.25} color="var(--fg-4)" />
                <div style={{ fontSize: 14, color: 'var(--fg-3)' }}>
                  Aún no hay cursos en la cotización
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                  Use el formulario de arriba para agregar cursos.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)' }}>
                      {['Curso', 'Horas', 'Modalidad', 'Cantidad', 'P. Unitario', 'Total', ''].map(h => (
                        <th key={h} style={{
                          padding: '9px 14px', fontSize: 11, fontWeight: 600,
                          color: 'var(--fg-3)', textAlign: h === 'Cantidad' || h === 'Horas' ? 'center' : 'left',
                          textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const lineTotal    = (Number(item.precio) || 0) * item.cantidad
                      const isExpanded   = expandedItems.has(idx)
                      const participantes = item.participantes ?? []
                      return (
                        <Fragment key={item.id}>
                          <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>

                            {/* Nombre + toggle participantes */}
                            <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>
                              <div>{item.nombre}</div>
                              {(!item.precio || Number(item.precio) === 0) && (
                                <div style={{ fontSize: 11, color: 'var(--warning-600)', marginTop: 2 }}>
                                  Sin precio configurado
                                </div>
                              )}
                              <button
                                onClick={() => toggleExpand(idx)}
                                style={{
                                  marginTop: 5, fontSize: 11, color: isExpanded ? 'var(--brand-700)' : 'var(--brand-500)',
                                  background: isExpanded ? 'var(--brand-50)' : 'transparent',
                                  border: `1px solid ${isExpanded ? 'var(--brand-200)' : 'var(--border-default)'}`,
                                  borderRadius: 4, cursor: 'pointer', padding: '2px 8px',
                                  fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: 4,
                                }}
                              >
                                {isExpanded ? '▲' : '▼'} Participantes ({participantes.length})
                              </button>
                            </td>

                            {/* Horas */}
                            <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--fg-2)', textAlign: 'center' }}>
                              {item.horas ? `${item.horas}h` : '—'}
                            </td>

                            {/* Modalidad */}
                            <td style={{ padding: '12px 14px' }}>
                              {item.modalidad
                                ? <Badge variant="neutral">{item.modalidad}</Badge>
                                : <span style={{ color: 'var(--fg-4)', fontSize: 13 }}>—</span>
                              }
                            </td>

                            {/* Cantidad editable */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <Stepper
                                value={String(item.cantidad)}
                                onChange={e => actualizarCantidad(idx, e.target.value)}
                                onBlur={() => fijarCantidad(idx, item.cantidad)}
                                onDecrement={() => fijarCantidad(idx, (Number(item.cantidad) || 1) - 1)}
                                onIncrement={() => fijarCantidad(idx, (Number(item.cantidad) || 0) + 1)}
                                width={104} height={32}
                              />
                            </td>

                            {/* P. Unitario editable */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <input
                                type="text" inputMode="numeric"
                                value={item.precio ?? ''}
                                onChange={e => actualizarPrecio(idx, e.target.value)}
                                onBlur={() => fijarPrecio(idx, item.precio)}
                                style={{
                                  width: 100, height: 32, padding: '0 8px', fontSize: 13,
                                  textAlign: 'right', color: 'var(--fg-1)', background: 'var(--bg-surface)',
                                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                                  outline: 'none', fontFamily: 'var(--font-sans)',
                                }}
                              />
                            </td>

                            {/* Total línea */}
                            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {fmtMonto(lineTotal)}
                            </td>

                            {/* Eliminar */}
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <button
                                onClick={() => eliminarItem(idx)}
                                style={{
                                  width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                                  border: 'none', background: 'transparent', cursor: 'pointer',
                                  color: 'var(--danger-400)', display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <Trash2 size={15} strokeWidth={2} />
                              </button>
                            </td>
                          </tr>

                          {/* Fila expandible de participantes */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} style={{ padding: '0 14px 14px', background: 'var(--neutral-50)' }}>
                                <div style={{
                                  padding: '12px 14px',
                                  border: '1px solid var(--brand-100)',
                                  borderRadius: 'var(--radius-md)',
                                  background: 'var(--bg-surface)',
                                  display: 'flex', flexDirection: 'column', gap: 8,
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Participantes — aparecerán en el PDF con nombre y RUT
                                  </div>
                                  {participantes.map((p, pIdx) => (
                                    <div key={pIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                      <input
                                        placeholder="Nombre completo"
                                        value={p.nombre}
                                        onChange={e => actualizarParticipante(idx, pIdx, 'nombre', e.target.value)}
                                        style={{
                                          flex: 1, height: 32, padding: '0 10px', fontSize: 12,
                                          color: 'var(--fg-1)', background: 'var(--bg-surface)',
                                          border: '1px solid var(--border-default)',
                                          borderRadius: 'var(--radius-sm)', outline: 'none',
                                          fontFamily: 'var(--font-sans)',
                                        }}
                                      />
                                      <input
                                        placeholder="RUT (12.345.678-9)"
                                        value={p.rut}
                                        onChange={e => actualizarParticipante(idx, pIdx, 'rut', formatRut(e.target.value))}
                                        style={{
                                          width: 150, height: 32, padding: '0 10px', fontSize: 12,
                                          color: 'var(--fg-1)', background: 'var(--bg-surface)',
                                          border: '1px solid var(--border-default)',
                                          borderRadius: 'var(--radius-sm)', outline: 'none',
                                          fontFamily: 'var(--font-sans)',
                                        }}
                                      />
                                      <button
                                        onClick={() => eliminarParticipante(idx, pIdx)}
                                        style={{
                                          width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                          border: 'none', background: 'transparent', cursor: 'pointer',
                                          color: 'var(--danger-400)', display: 'flex',
                                          alignItems: 'center', justifyContent: 'center',
                                        }}
                                      >
                                        <Trash2 size={13} strokeWidth={2} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => agregarParticipante(idx)}
                                    style={{
                                      alignSelf: 'flex-start', fontSize: 12, color: 'var(--brand-600)',
                                      background: 'none', border: 'none', cursor: 'pointer',
                                      padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4,
                                      fontFamily: 'var(--font-sans)',
                                    }}
                                  >
                                    <Plus size={13} strokeWidth={2} /> Agregar participante
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Observaciones */}
          <Card>
            <CardTitle>Observaciones</CardTitle>
            <div style={{ padding: '14px 20px' }}>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Condiciones especiales, descuentos, forma de pago, etc. (opcional)"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13,
                  color: 'var(--fg-1)', background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                  outline: 'none', resize: 'vertical', fontFamily: 'var(--font-sans)',
                  lineHeight: 1.6, boxSizing: 'border-box',
                }}
              />
            </div>
          </Card>
        </div>

        {/* ── Columna derecha: resumen ── */}
        <div style={{ position: 'sticky', top: 20 }}>
          <Card>
            <CardTitle>Resumen</CardTitle>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Info básica */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--fg-3)' }}>N° cotización</span>
                  <span style={{ color: 'var(--fg-1)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{numero}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--fg-3)' }}>Empresa</span>
                  <span style={{ color: 'var(--fg-1)', fontWeight: 600, maxWidth: 160, textAlign: 'right', lineHeight: 1.3 }}>
                    {empresa?.nombre ?? '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--fg-3)' }}>Cursos</span>
                  <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--fg-3)' }}>Total unidades</span>
                  <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
                    {items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)}
                  </span>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              {/* Montos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--fg-2)' }}>Subtotal</span>
                  <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{fmtMonto(subtotal)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--success-600)', fontStyle: 'italic', textAlign: 'right' }}>
                  Exento de IVA (OTEC Capacitación)
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--brand-600)',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Total</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{fmtMonto(total)}</span>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              {/* Desglose por curso */}
              {items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Desglose
                  </span>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--fg-2)', flex: 1, lineHeight: 1.3 }}>
                        {item.nombre.length > 30 ? item.nombre.slice(0, 30) + '…' : item.nombre}
                        {Number(item.cantidad) > 1 && (
                          <span style={{ color: 'var(--fg-4)' }}> ×{item.cantidad}</span>
                        )}
                      </span>
                      <span style={{ color: 'var(--fg-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {fmtMonto((Number(item.precio) || 0) * (Number(item.cantidad) || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="primary"
                size="md"
                icon={FileText}
                onClick={handleGenerarPDF}
                disabled={!empresa || items.length === 0}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Generar cotización PDF
              </Button>

              {/* Botón Excel (solo si hay plantillas de cotización cargadas) */}
              {plantillasCotizacion.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plantillasCotizacion.length > 1 && (
                    <StyledSelect
                      value={plantillaId}
                      onChange={setPlantillaId}
                      placeholder="— Plantilla Excel —"
                    >
                      {plantillasCotizacion.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </StyledSelect>
                  )}
                  <Button
                    variant="secondary"
                    size="md"
                    loading={generandoExcel}
                    onClick={handleGenerarExcel}
                    disabled={!empresa || items.length === 0}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {generandoExcel ? 'Generando…' : `Generar con plantilla Excel${plantillasCotizacion.length === 1 ? ` (${plantillasCotizacion[0].nombre})` : ''}`}
                  </Button>
                </div>
              )}

              {(!empresa || items.length === 0) && (
                <div style={{ fontSize: 11, color: 'var(--fg-4)', textAlign: 'center', lineHeight: 1.5 }}>
                  {!empresa ? 'Seleccione una empresa para continuar' : 'Agregue al menos un curso'}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Toast toast={toast} />

      {verHistorial && (
        <ModalHistorialCotizaciones onClose={() => setVerHistorial(false)} />
      )}
    </div>
  )
}
