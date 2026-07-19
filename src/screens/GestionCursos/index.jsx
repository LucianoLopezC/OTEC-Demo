// Catálogo de cursos: listado, búsqueda, filtros por estado/modalidad/categoría,
// importación masiva desde Excel, exportación, y CRUD con modal de detalle.
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search, Download, Upload, Plus, BookOpen,
  Edit2, Trash2, Copy, BookX,
  ArrowUp, ArrowDown, ArrowUpDown,
  CheckCircle2, X as XIcon,
} from 'lucide-react'
import Button           from '../../components/atoms/Button'
import IconButton       from '../../components/atoms/IconButton'
import Badge            from '../../components/atoms/Badge'
import FiltroSelect     from '../../components/atoms/FiltroSelect'
import ModalCurso       from './ModalCurso'
import ModalImportarCursos from './ModalImportarCursos'
import { exportarCursos, getPageNumbers, MODALIDADES, cargarCategorias, cargarCategoriasExtra, persistirCategoriaExtra } from './utils'
import { useApp } from '../../context/AppContext'
import { usePermiso } from '../../hooks/usePermiso'
import { useConfirm } from '../../context/ConfirmContext'

const CONDICION_BADGE = {
  'TEÓRICO - PRÁCTICO': 'brand',
  'TEÓRICO':            'info',
  'PRÁCTICO':           'success',
  'E-LEARNING':         'purple',
}

const ESTADO_BADGE = {
  'Activo':    'success',
  'Borrador':  'neutral',
  'Archivado': 'danger',
}

const MODALIDAD_BADGE = {
  'Presencial': 'success',
  'Online':     'info',
  'Híbrido':    'warning',
}

/* ── Toast ── */
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 200,
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

/* ── Sort header ── */
function SortTh({ label, col, ordenCol, ordenDir, onSort, center }) {
  const active = ordenCol === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '10px 14px', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textTransform: 'uppercase',
        color: active ? 'var(--brand-600)' : 'var(--fg-3)',
        background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)',
        whiteSpace: 'nowrap', textAlign: center ? 'center' : 'left',
        cursor: 'pointer', userSelect: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active
          ? ordenDir === 'asc'
            ? <ArrowUp   size={11} strokeWidth={2.5} />
            : <ArrowDown size={11} strokeWidth={2.5} />
          : <ArrowUpDown size={11} strokeWidth={1.75} color="var(--fg-4)" />
        }
      </span>
    </th>
  )
}

/* ── StaticTh ── */
function Th({ children, center, width }) {
  return (
    <th style={{
      padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: 'var(--fg-3)',
      background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)',
      whiteSpace: 'nowrap', textAlign: center ? 'center' : 'left', width,
    }}>{children}</th>
  )
}

/* ── PageBtn ── */
function PageBtn({ children, active, disabled, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 30, height: 30, padding: '0 6px', borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
        background: active ? 'var(--brand-50)' : hovered ? 'var(--neutral-100)' : 'var(--bg-surface)',
        color: active ? 'var(--brand-600)' : 'var(--fg-2)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 150ms', fontFamily: 'var(--font-sans)',
      }}
    >{children}</button>
  )
}


/* ── DDItem ── */
function DDItem({ children, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '10px 14px', textAlign: 'left',
        fontSize: 13, color: 'var(--fg-2)',
        background: hovered ? 'var(--neutral-50)' : 'transparent',
        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'block',
      }}
    >{children}</button>
  )
}

/* ── CursoRow ── */
function CursoRow({ curso, onEdit, onDelete, onDuplicar, TD, selected, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const nombreCorto = curso.nombre.length > 55 ? curso.nombre.slice(0, 55) + '…' : curso.nombre
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: selected ? 'var(--brand-50)' : hovered ? 'var(--neutral-25)' : 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}
    >
      <td style={{ padding: '12px 10px', verticalAlign: 'middle', width: 38 }}>
        <input type="checkbox" checked={!!selected} onChange={() => onToggle(curso.id)}
          style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--brand-600)' }} />
      </td>
      {/* Nombre */}
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'var(--brand-50)', color: 'var(--brand-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={16} strokeWidth={1.75} />
          </div>
          <span
            title={curso.nombre}
            style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 13, lineHeight: 1.3 }}
          >
            {nombreCorto}
          </span>
        </div>
      </td>

      {/* Código SENCE */}
      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {curso.codigoSence === 'NO-APLICA'
          ? <em style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>NO-APLICA</em>
          : curso.codigoSence
        }
      </td>

      {/* Horas */}
      <td style={{ ...TD, textAlign: 'center' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
          background: 'var(--neutral-100)', fontSize: 12, fontWeight: 500, color: 'var(--fg-2)',
        }}>
          {curso.horas}h
        </span>
      </td>

      {/* Condición */}
      <td style={TD}>
        <Badge variant={CONDICION_BADGE[curso.condicion] ?? 'neutral'}>
          {curso.condicion}
        </Badge>
      </td>

      {/* Modalidad */}
      <td style={TD}>
        <Badge variant={MODALIDAD_BADGE[curso.modalidad] ?? 'neutral'}>
          {curso.modalidad ?? '—'}
        </Badge>
      </td>

      {/* Categorías */}
      <td style={TD}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', alignItems: 'center' }}>
          {(curso.categorias ?? []).slice(0, 2).map(c => (
            <span key={c} style={{
              padding: '2px 7px', borderRadius: 999,
              background: 'var(--neutral-100)', color: 'var(--fg-2)', fontSize: 11, whiteSpace: 'nowrap',
            }}>{c}</span>
          ))}
          {(curso.categorias ?? []).length > 2 && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
              +{(curso.categorias ?? []).length - 2}
            </span>
          )}
        </div>
      </td>

      {/* Estado */}
      <td style={TD}>
        <Badge variant={ESTADO_BADGE[curso.estado] ?? 'neutral'}>{curso.estado}</Badge>
      </td>

      {/* Emisiones */}
      <td style={{ ...TD, textAlign: 'center' }}>
        {curso.totalEmisiones > 0
          ? <span style={{ fontWeight: 700, color: 'var(--fg-1)' }}>{curso.totalEmisiones}</span>
          : <span style={{ color: 'var(--fg-4)' }}>—</span>
        }
      </td>

      {/* Acciones */}
      <td style={{ ...TD, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <IconButton icon={Edit2}  size={30} variant="ghost" title="Editar"     onClick={onEdit} />
          {onDuplicar && <IconButton icon={Copy} size={30} variant="ghost" title="Duplicar" onClick={onDuplicar} />}
          <IconButton icon={Trash2} size={30} variant="ghost" title="Eliminar"   onClick={onDelete}
            style={{ color: 'var(--danger-500)' }} />
        </div>
      </td>
    </tr>
  )
}

/* ── main ── */
export default function GestionCursos({ onNav }) {
  const { cursos, crearCurso, editarCurso, eliminarCurso, eliminarCursos } = useApp()
  const confirm = useConfirm()
  const puedeExportar   = usePermiso('exportarDatos')
  const puedeCrearCurso = usePermiso('crearCurso')

  const [seleccionados, setSeleccionados] = useState([])
  const headerChkRef = useRef(null)

  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda,      setBusqueda]      = useState('')
  const [filtroEstado,    setFiltroEstado]    = useState('Todos')
  const [filtroCondicion, setFiltroCondicion] = useState('Todas')
  const [filtroModalidad, setFiltroModalidad] = useState('Todas')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [ordenCol,      setOrdenCol]      = useState('nombre')
  const [ordenDir,      setOrdenDir]      = useState('asc')
  const [pagina,        setPagina]        = useState(1)
  const POR_PAGINA = 8

  const [modalCurso,    setModalCurso]    = useState(null)
  const [modalImportar, setModalImportar] = useState(false)
  const [exportDD,      setExportDD]      = useState(false)
  const [toast,         setToast]         = useState(null)

  const debounceRef = useRef(null)
  const exportRef   = useRef(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const handleBusqueda = (val) => {
    setBusquedaInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setBusqueda(val); setPagina(1) }, 200)
  }

  const handleSort = (col) => {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
    setPagina(1)
  }

  useEffect(() => {
    const h = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportDD(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const categoriasDisponibles = useMemo(() => {
    const set = new Set()
    cursos.forEach(c => (c.categorias ?? []).forEach(cat => set.add(cat)))
    cargarCategoriasExtra().forEach(cat => set.add(cat))
    return ['Todas', ...[...set].sort((a, b) => a.localeCompare(b, 'es'))]
  }, [cursos])

  const cursosFiltrados = useMemo(() => {
    let r = [...cursos]
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.codigoSence.toLowerCase().includes(q)
      )
    }
    if (filtroEstado     !== 'Todos') r = r.filter(c => c.estado    === filtroEstado)
    if (filtroCondicion  !== 'Todas') r = r.filter(c => c.condicion === filtroCondicion)
    if (filtroModalidad  !== 'Todas') r = r.filter(c => (c.modalidad ?? '') === filtroModalidad)
    if (filtroCategoria  !== 'Todas') r = r.filter(c => (c.categorias ?? []).includes(filtroCategoria))
    r.sort((a, b) => {
      let va = a[ordenCol] ?? '', vb = b[ordenCol] ?? ''
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase() }
      if (va < vb) return ordenDir === 'asc' ? -1 : 1
      if (va > vb) return ordenDir === 'asc' ?  1 : -1
      return 0
    })
    return r
  }, [cursos, busqueda, filtroEstado, filtroCondicion, filtroModalidad, filtroCategoria, ordenCol, ordenDir])

  const totalPaginas  = Math.max(1, Math.ceil(cursosFiltrados.length / POR_PAGINA))
  const cursosPagina  = cursosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const pageNums      = getPageNumbers(pagina, totalPaginas)

  const idsPagina   = cursosPagina.map(c => c.id)
  const selEnPagina = seleccionados.filter(id => idsPagina.includes(id))

  const handleSave = async (form) => {
    const ahora = new Date().toISOString().slice(0, 10)
    try {
      if (modalCurso === 'nuevo') {
        await crearCurso({ ...form, totalEmisiones: 0, creadoEn: ahora, actualizadoEn: ahora })
        showToast('Curso creado correctamente')
      } else {
        await editarCurso({ ...form, actualizadoEn: ahora })
        showToast('Curso actualizado correctamente')
      }
      setModalCurso(null)
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error')
    }
  }

  const handleDelete = async (curso) => {
    const confirmNombre = curso.nombre.length > 60 ? curso.nombre.slice(0, 60) + '...' : curso.nombre
    const ok = await confirm(`¿Eliminar el curso "${confirmNombre}"?`, { confirmLabel: 'Eliminar curso' })
    if (!ok) return
    try {
      await eliminarCurso(curso.id)
      showToast('Curso eliminado')
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  const handleDuplicar = async (curso) => {
    const ahora = new Date().toISOString().slice(0, 10)
    try {
      await crearCurso({
        ...curso,
        id: '',
        nombre: `${curso.nombre} (copia)`,
        estado: 'Borrador',
        totalEmisiones: 0,
        creadoEn: ahora,
        actualizadoEn: ahora,
      })
      showToast('Curso duplicado como borrador')
    } catch (err) {
      showToast(err.message || 'Error al duplicar', 'error')
    }
  }

  const handleImportar = async (nuevos) => {
    try {
      const catActuales = new Set(cargarCategorias())
      for (const c of nuevos) {
        for (const cat of (c.categorias ?? [])) {
          if (cat && !catActuales.has(cat)) {
            persistirCategoriaExtra(cat)
            catActuales.add(cat)
          }
        }
      }
      for (const c of nuevos) { await crearCurso(c) }
      setModalImportar(false)
      showToast(`${nuevos.length} cursos importados correctamente`)
    } catch (err) {
      showToast(err.message || 'Error al importar', 'error')
    }
  }

  useEffect(() => {
    const el = headerChkRef.current
    if (!el) return
    el.checked      = idsPagina.length > 0 && selEnPagina.length === idsPagina.length
    el.indeterminate = selEnPagina.length > 0 && selEnPagina.length < idsPagina.length
  }, [seleccionados, cursosPagina])  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAll = () => {
    if (selEnPagina.length === idsPagina.length)
      setSeleccionados(p => p.filter(id => !idsPagina.includes(id)))
    else
      setSeleccionados(p => [...new Set([...p, ...idsPagina])])
  }
  const toggleSel = (id) =>
    setSeleccionados(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])

  const handleDeleteSelected = async () => {
    const n = seleccionados.length
    const ok = await confirm(
      `¿Eliminar ${n} curso${n !== 1 ? 's' : ''} seleccionado${n !== 1 ? 's' : ''}?`,
      { confirmLabel: 'Eliminar' }
    )
    if (!ok) return
    try {
      await eliminarCursos(seleccionados)
      setSeleccionados([])
      showToast(`${n} curso${n !== 1 ? 's' : ''} eliminado${n !== 1 ? 's' : ''}`)
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  const card = {
    background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
  }
  const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--fg-2)', verticalAlign: 'middle' }

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar ── */}
      <div style={{ ...card, overflow: 'visible', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 300 }}>
          <Search size={14} strokeWidth={1.75} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--neutral-400)', pointerEvents: 'none',
          }} />
          <input
            value={busquedaInput}
            onChange={e => handleBusqueda(e.target.value)}
            placeholder="Buscar nombre o código SENCE..."
            style={{
              width: '100%', height: 30, paddingLeft: 32, paddingRight: busquedaInput ? 28 : 10,
              fontSize: 12, color: 'var(--fg-2)', background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
            }}
          />
          {busquedaInput && (
            <button onClick={() => handleBusqueda('')} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', display: 'flex', padding: 0,
            }}>
              <XIcon size={12} strokeWidth={2} />
            </button>
          )}
        </div>

        <FiltroSelect label="Estado"    value={filtroEstado}    onChange={v => { setFiltroEstado(v);    setPagina(1) }} options={['Todos', 'Activo', 'Borrador', 'Archivado']} />
        <FiltroSelect label="Condición" value={filtroCondicion} onChange={v => { setFiltroCondicion(v); setPagina(1) }} options={['Todas', 'TEÓRICO - PRÁCTICO', 'TEÓRICO', 'PRÁCTICO', 'E-LEARNING']} />
        <FiltroSelect label="Modalidad" value={filtroModalidad} onChange={v => { setFiltroModalidad(v); setPagina(1) }} options={['Todas', ...MODALIDADES]} />
        <FiltroSelect label="Categoría" value={filtroCategoria} onChange={v => { setFiltroCategoria(v); setPagina(1) }} options={categoriasDisponibles} />

        {(filtroEstado !== 'Todos' || filtroCondicion !== 'Todas' || filtroModalidad !== 'Todas' || filtroCategoria !== 'Todas') && (
          <button
            onClick={() => { setFiltroEstado('Todos'); setFiltroCondicion('Todas'); setFiltroModalidad('Todas'); setFiltroCategoria('Todas'); setPagina(1) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 30, padding: '0 10px', fontSize: 12, fontWeight: 500,
              color: 'var(--fg-3)', background: 'transparent',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <XIcon size={12} strokeWidth={2} />
            Limpiar
          </button>
        )}

        <div style={{ flex: 1 }} />

        {puedeExportar && (
          <div ref={exportRef} style={{ position: 'relative' }}>
            <Button variant="secondary" size="sm" icon={Download} onClick={() => setExportDD(d => !d)}>
              Exportar
            </Button>
            {exportDD && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-default)',
                zIndex: 50, minWidth: 260, overflow: 'hidden',
              }}>
                <DDItem onClick={() => { exportarCursos(cursosFiltrados, 'cursos-filtrados'); setExportDD(false) }}>
                  Exportar resultados ({cursosFiltrados.length})
                </DDItem>
                <DDItem onClick={() => { exportarCursos(cursos, 'cursos-demo'); setExportDD(false) }}>
                  Exportar catálogo completo ({cursos.length})
                </DDItem>
              </div>
            )}
          </div>
        )}

        {puedeCrearCurso && (
          <Button variant="secondary" size="sm" icon={Upload} onClick={() => setModalImportar(true)}>
            Importar
          </Button>
        )}

        {puedeCrearCurso && (
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setModalCurso('nuevo')}>
            Nuevo Curso
          </Button>
        )}
      </div>

      {/* ── Table card ── */}
      <div style={card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{
                  padding: '10px 10px', background: 'var(--neutral-50)',
                  borderBottom: '1px solid var(--border-default)', width: 38,
                }}>
                  <input type="checkbox" ref={headerChkRef} onChange={toggleAll}
                    style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--brand-600)' }} />
                </th>
                <SortTh label="Nombre"    col="nombre"         ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} />
                <Th>Código SENCE</Th>
                <SortTh label="Horas"     col="horas"          ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} center />
                <Th>Condición</Th>
                <Th>Modalidad</Th>
                <Th>Categorías</Th>
                <SortTh label="Estado"    col="estado"         ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} />
                <SortTh label="Emisiones" col="totalEmisiones" ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} center />
                <Th width={110} />
              </tr>
            </thead>
            <tbody>
              {cursosPagina.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '56px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <BookX size={40} strokeWidth={1.25} color="var(--fg-4)" />
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)' }}>
                        {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay cursos registrados'}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>
                        {busqueda ? 'Intente con otros términos o limpie los filtros.' : 'Cree el primer curso del catálogo.'}
                      </div>
                      <Button variant="primary" size="sm" icon={Plus} onClick={() => setModalCurso('nuevo')}>
                        Nuevo Curso
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                cursosPagina.map(curso => (
                  <CursoRow
                    key={curso.id}
                    curso={curso}
                    TD={TD}
                    selected={seleccionados.includes(curso.id)}
                    onToggle={toggleSel}
                    onEdit={() => setModalCurso(curso)}
                    onDelete={() => handleDelete(curso)}
                    onDuplicar={puedeCrearCurso ? () => handleDuplicar(curso) : null}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Batch delete bar */}
        {seleccionados.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderTop: '1px solid var(--border-subtle)',
            background: 'var(--brand-50)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--brand-700)', fontWeight: 500 }}>
              {seleccionados.length} seleccionado{seleccionados.length !== 1 ? 's' : ''}
            </span>
            <Button variant="dangerSoft" size="sm" icon={Trash2} onClick={handleDeleteSelected}>
              Eliminar seleccionados
            </Button>
            <button
              onClick={() => setSeleccionados([])}
              style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancelar selección
            </button>
          </div>
        )}

        {/* Pagination */}
        {cursosFiltrados.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, cursosFiltrados.length)}–
              {Math.min(pagina * POR_PAGINA, cursosFiltrados.length)} de {cursosFiltrados.length} cursos
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <PageBtn onClick={() => setPagina(p => p - 1)} disabled={pagina === 1}>&lt;</PageBtn>
              {pageNums.map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} style={{ lineHeight: '30px', padding: '0 4px', color: 'var(--fg-4)', fontSize: 13 }}>…</span>
                  : <PageBtn key={p} active={p === pagina} onClick={() => setPagina(p)}>{p}</PageBtn>
              )}
              <PageBtn onClick={() => setPagina(p => p + 1)} disabled={pagina === totalPaginas}>&gt;</PageBtn>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modalCurso && (
        <ModalCurso
          curso={modalCurso}
          onClose={() => setModalCurso(null)}
          onSave={handleSave}
          onNavPlantilla={onNav}
        />
      )}
      {modalImportar && (
        <ModalImportarCursos
          onClose={() => setModalImportar(false)}
          onImportar={handleImportar}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
