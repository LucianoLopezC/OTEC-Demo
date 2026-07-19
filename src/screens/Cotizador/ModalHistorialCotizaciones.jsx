import { useState, useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'
import { apiFetch } from '../../services/apiClient'

function fmtPeso(n) {
  return '$' + Math.round(n).toLocaleString('es-CL')
}

function fmtFecha(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}-${m}-${y}`
}

const ESTADO = {
  emitida:   { bg: 'var(--brand-50)',    color: 'var(--brand-700)'   },
  aceptada:  { bg: 'var(--success-50)',  color: 'var(--success-700)' },
  rechazada: { bg: 'var(--danger-50)',   color: 'var(--danger-700)'  },
  vencida:   { bg: 'var(--neutral-100)', color: 'var(--fg-3)'        },
}

export default function ModalHistorialCotizaciones({ onClose }) {
  const [search,       setSearch]       = useState('')
  const [lista,        setLista]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null)
  const [updatingId,   setUpdatingId]   = useState(null)
  const [error,        setError]        = useState(null)
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const timerRef = useRef(null)

  useEffect(() => { cargar('') }, [])

  const cargar = async (q) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch(`cotizaciones.php${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      setLista(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
      setLista([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (v) => {
    setSearch(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => cargar(v), 350)
  }

  const cambiarEstado = async (cot, estado) => {
    setUpdatingId(cot.id)
    try {
      const updated = await apiFetch(`cotizaciones.php?id=${cot.id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      })
      setLista(prev => prev.map(c => c.id === cot.id ? updated : c))
      if (selected?.id === cot.id) setSelected(updated)
    } catch { /* silencioso */ } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,27,71,0.40)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        boxShadow: '0 24px 64px -12px rgba(15,27,71,0.20)',
        width: '100%', maxWidth: selected ? 1200 : 820, height: '92vh', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'max-width 250ms',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
            Historial de cotizaciones
          </h2>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)',
          }}>
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body: lista + detalle */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ── Lista ── */}
          <div style={{
            width: selected ? 380 : '100%', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRight: selected ? '1px solid var(--border-subtle)' : 'none',
            transition: 'width 250ms', minHeight: 0,
          }}>
            {/* Buscador */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} strokeWidth={2} style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--fg-3)', pointerEvents: 'none',
                }} />
                <input
                  placeholder="Buscar por número o empresa…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  style={{
                    width: '100%', height: 36, paddingLeft: 32, paddingRight: 10,
                    fontSize: 13, color: 'var(--fg-1)', background: 'var(--neutral-50)',
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                    outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Filtros por estado */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['todos', 'emitida', 'aceptada', 'rechazada', 'vencida'].map(e => {
                const active = estadoFiltro === e
                const ec = e === 'todos' ? null : ESTADO[e]
                return (
                  <button
                    key={e}
                    onClick={() => { setEstadoFiltro(e); setSelected(null) }}
                    style={{
                      height: 26, padding: '0 10px', fontSize: 11, fontWeight: 600,
                      borderRadius: 999, cursor: 'pointer', border: 'none',
                      textTransform: 'capitalize', fontFamily: 'var(--font-sans)',
                      background: active
                        ? (ec ? ec.bg : 'var(--brand-100)')
                        : 'var(--neutral-100)',
                      color: active
                        ? (ec ? ec.color : 'var(--brand-700)')
                        : 'var(--fg-3)',
                      outline: active ? `1.5px solid ${ec ? ec.color : 'var(--brand-400)'}` : 'none',
                      outlineOffset: -1,
                      transition: 'all 100ms',
                    }}
                  >
                    {e === 'todos' ? 'Todos' : e}
                    {' '}
                    <span style={{ opacity: 0.65 }}>
                      ({e === 'todos' ? lista.length : lista.filter(c => c.estado === e).length})
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Filas */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
                  Cargando…
                </div>
              ) : error ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger-600)', fontSize: 13 }}>
                  {error}
                </div>
              ) : (() => {
                const filtrada = estadoFiltro === 'todos' ? lista : lista.filter(c => c.estado === estadoFiltro)
                if (filtrada.length === 0) return (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-4)', fontSize: 13 }}>
                    {search || estadoFiltro !== 'todos' ? 'Sin resultados' : 'Aún no hay cotizaciones guardadas'}
                  </div>
                )
                return filtrada.map(cot => {
                const isActive = selected?.id === cot.id
                const ec = ESTADO[cot.estado] ?? ESTADO.emitida
                return (
                  <div
                    key={cot.id}
                    onClick={() => setSelected(isActive ? null : cot)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderLeft: `3px solid ${isActive ? 'var(--brand-500)' : 'transparent'}`,
                      background: isActive ? 'var(--brand-50)' : 'transparent',
                      transition: 'background 100ms',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                          {cot.numero}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cot.empresaNombre}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 1 }}>
                          {fmtFecha(cot.fecha)} · {cot.items?.length ?? 0} curso{cot.items?.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>
                          {fmtPeso(cot.subtotal)}
                        </div>
                        <span style={{
                          display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 999,
                          background: ec.bg, color: ec.color, textTransform: 'capitalize',
                        }}>
                          {cot.estado}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })})()}
            </div>
          </div>

          {/* ── Detalle ── */}
          {selected && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Encabezado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>
                    N° {selected.numero}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3 }}>
                    Emitida el {fmtFecha(selected.fecha)}
                    {selected.createdAt && ` · Guardada ${new Date(selected.createdAt).toLocaleDateString('es-CL')}`}
                  </div>
                </div>
                <select
                  value={selected.estado}
                  disabled={updatingId === selected.id}
                  onChange={e => cambiarEstado(selected, e.target.value)}
                  style={{
                    height: 34, padding: '0 10px', fontSize: 12,
                    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                    outline: 'none', background: 'var(--bg-surface)', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', opacity: updatingId === selected.id ? 0.5 : 1,
                  }}
                >
                  <option value="emitida">Emitida</option>
                  <option value="aceptada">Aceptada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="vencida">Vencida</option>
                </select>
              </div>

              {/* Empresa */}
              <div style={{
                padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-700)', marginBottom: 6 }}>
                  {selected.empresaNombre}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: 12, color: 'var(--brand-800)' }}>
                  {selected.empresaRut      && <span><strong>RUT:</strong> {selected.empresaRut}</span>}
                  {selected.empresaContacto && <span><strong>Contacto:</strong> {selected.empresaContacto}</span>}
                </div>
              </div>

              {/* Cursos */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Cursos cotizados
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(selected.items ?? []).map((item, i) => {
                    const subtotalItem = (Number(item.precio) || 0) * (item.cantidad || 1)
                    const parts = (item.participantes ?? []).filter(p => p.nombre?.trim())
                    return (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)', background: 'var(--neutral-50)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
                              {item.nombre}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
                              {[
                                item.horas     && `${item.horas}h`,
                                item.modalidad,
                                `${item.cantidad} participante${item.cantidad !== 1 ? 's' : ''}`,
                                item.precio && `$${Math.round(item.precio).toLocaleString('es-CL')} c/u`,
                              ].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-1)', whiteSpace: 'nowrap' }}>
                            {fmtPeso(subtotalItem)}
                          </div>
                        </div>

                        {parts.length > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {parts.map((p, pi) => (
                              <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-2)' }}>
                                <span>{p.nombre}</span>
                                <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{p.rut}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Total */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 16px', borderRadius: 'var(--radius-md)',
                background: 'var(--brand-600)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Total (Exento IVA)</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{fmtPeso(selected.subtotal)}</span>
              </div>

              {/* Notas */}
              {selected.notas && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Observaciones
                  </div>
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selected.notas}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
