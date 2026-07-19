// Pantalla de gestión de empresas: listado con búsqueda, ordenamiento, exportación a Excel,
// carga masiva por Excel, y modales de crear/editar/eliminar.
// El rol "empresa" no puede acceder a esta pantalla (filtrado por permisos en App.jsx).
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search, Filter, Download, Upload, Plus,
  Edit2, Trash2, MoreHorizontal, Building2,
  ArrowUp, ArrowDown, ArrowUpDown,
  CheckCircle2, X as XIcon,
} from 'lucide-react'
import Button        from '../../components/atoms/Button'
import IconButton    from '../../components/atoms/IconButton'
import Badge         from '../../components/atoms/Badge'
import Avatar        from '../../components/atoms/Avatar'
import TextInput     from '../../components/atoms/TextInput'
import FiltroSelect  from '../../components/atoms/FiltroSelect'
import ModalEmpresa  from './ModalEmpresa'
import ModalCargaMasiva from './ModalCargaMasiva'
import { exportarExcel, getPageNumbers } from './utils'
import { useApp } from '../../context/AppContext'
import { usePermiso } from '../../hooks/usePermiso'
import { useConfirm } from '../../context/ConfirmContext'

const ESTADO_BADGE = {
  'Activa':       'success',
  'En revisión':  'warning',
  'Borrador':     'neutral',
  'Inactiva':     'danger',
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
        background: 'var(--neutral-50)',
        borderBottom: '1px solid var(--border-default)',
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

/* ── main ── */
export default function Empresas() {
  /* permissions */
  const puedeCrear    = usePermiso('crearEmpresa')
  const puedeEditar   = usePermiso('editarEmpresa')
  const puedeEliminar = usePermiso('eliminarEmpresa')
  const puedeExportar = usePermiso('exportarDatos')

  /* state */
  const { empresas, personas, crearEmpresa, editarEmpresa, eliminarEmpresa, eliminarEmpresas } = useApp()
  const confirm = useConfirm()

  /* empresas enriquecidas con contadores calculados desde personas
     (las personas ya traen sus certificados embebidos desde el servidor) */
  const empresasConContadores = useMemo(() => {
    const usuariosPorEmpresa = {}
    const cursosPorEmpresa   = {}
    personas.forEach(p => {
      if (p.empresaId) usuariosPorEmpresa[p.empresaId] = (usuariosPorEmpresa[p.empresaId] || 0) + 1
      ;(p.certificados || []).forEach(c => {
        if (c.empresaId && c.curso) {
          if (!cursosPorEmpresa[c.empresaId]) cursosPorEmpresa[c.empresaId] = new Set()
          cursosPorEmpresa[c.empresaId].add(c.curso)
        }
      })
    })
    return empresas.map(e => ({
      ...e,
      usuarios: usuariosPorEmpresa[e.id] || 0,
      cursos:   cursosPorEmpresa[e.id] ? cursosPorEmpresa[e.id].size : 0,
    }))
  }, [empresas, personas])
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda,      setBusqueda]      = useState('')
  const [filtroEstado,  setFiltroEstado]  = useState('Todos')
  const [filtroRegion,  setFiltroRegion]  = useState('Todas')
  const [minCursos,     setMinCursos]     = useState('')
  const [maxCursos,     setMaxCursos]     = useState('')
  const [ordenCol,      setOrdenCol]      = useState('nombre')
  const [ordenDir,      setOrdenDir]      = useState('asc')
  const [pagina,        setPagina]        = useState(1)
  const POR_PAGINA = 8
  const [modalEmpresa,  setModalEmpresa]  = useState(null)
  const [modalCarga,    setModalCarga]    = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [exportDD,      setExportDD]      = useState(false)
  const [toast,         setToast]         = useState(null)

  /* refs */
  const debounceRef  = useRef(null)
  const exportRef    = useRef(null)
  const headerChkRef = useRef(null)

  /* toast helper */
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  /* debounced search */
  const handleBusqueda = (val) => {
    setBusquedaInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setBusqueda(val)
      setPagina(1)
    }, 200)
  }

  /* sort */
  const handleSort = (col) => {
    if (ordenCol === col) setOrdenDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setOrdenCol(col); setOrdenDir('asc') }
    setPagina(1)
  }

  /* filter helpers */
  const filtrosActivos = [
    filtroEstado !== 'Todos',
    filtroRegion !== 'Todas',
    minCursos !== '',
    maxCursos !== '',
  ].filter(Boolean).length

  const limpiarFiltros = () => {
    setFiltroEstado('Todos')
    setFiltroRegion('Todas')
    setMinCursos('')
    setMaxCursos('')
    setPagina(1)
  }

  /* derived: unique regions */
  const regiones = useMemo(() =>
    ['Todas', ...new Set(empresasConContadores.map(e => e.region))].sort((a, b) =>
      a === 'Todas' ? -1 : b === 'Todas' ? 1 : a.localeCompare(b, 'es')
    ), [empresasConContadores])

  /* main filter+sort */
  const empresasFiltradas = useMemo(() => {
    let r = [...empresasConContadores]
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(e =>
        e.nombre.toLowerCase().includes(q) ||
        e.rut.toLowerCase().includes(q)    ||
        e.contacto.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)  ||
        e.region.toLowerCase().includes(q)
      )
    }
    if (filtroEstado !== 'Todos')  r = r.filter(e => e.estado === filtroEstado)
    if (filtroRegion !== 'Todas')  r = r.filter(e => e.region === filtroRegion)
    if (minCursos !== '')          r = r.filter(e => e.cursos >= Number(minCursos))
    if (maxCursos !== '')          r = r.filter(e => e.cursos <= Number(maxCursos))
    r.sort((a, b) => {
      let va = a[ordenCol], vb = b[ordenCol]
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase() }
      if (va < vb) return ordenDir === 'asc' ? -1 : 1
      if (va > vb) return ordenDir === 'asc' ?  1 : -1
      return 0
    })
    return r
  }, [empresasConContadores, busqueda, filtroEstado, filtroRegion, minCursos, maxCursos, ordenCol, ordenDir])

  /* pagination */
  const totalPaginas   = Math.max(1, Math.ceil(empresasFiltradas.length / POR_PAGINA))
  const empresasPagina = empresasFiltradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)
  const pageNums       = getPageNumbers(pagina, totalPaginas)

  /* selection */
  const idsEnPagina = empresasPagina.map(e => e.id)
  const selEnPagina = idsEnPagina.filter(id => seleccionados.includes(id))

  useEffect(() => {
    const el = headerChkRef.current
    if (!el) return
    el.checked       = idsEnPagina.length > 0 && selEnPagina.length === idsEnPagina.length
    el.indeterminate = selEnPagina.length > 0 && selEnPagina.length < idsEnPagina.length
  }, [seleccionados, empresasPagina])  // eslint-disable-line

  const toggleAll = () => {
    if (selEnPagina.length === idsEnPagina.length)
      setSeleccionados(p => p.filter(id => !idsEnPagina.includes(id)))
    else
      setSeleccionados(p => [...new Set([...p, ...idsEnPagina])])
  }

  const toggleSel = (id) =>
    setSeleccionados(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])

  /* close export dropdown on outside click */
  useEffect(() => {
    const h = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportDD(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  /* CRUD */
  const handleSaveEmpresa = async (form) => {
    try {
      if (modalEmpresa === 'nueva') {
        await crearEmpresa({ ...form, usuarios: 0, cursos: 0 })
        showToast('Empresa creada correctamente')
      } else {
        await editarEmpresa(form)
        showToast('Empresa actualizada correctamente')
      }
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error')
    }
  }

  const handleDelete = async (empresa) => {
    const ok = await confirm(`¿Eliminar la empresa "${empresa.nombre}"?`, { confirmLabel: 'Eliminar empresa' })
    if (!ok) return
    try {
      await eliminarEmpresa(empresa.id)
      setSeleccionados(p => p.filter(id => id !== empresa.id))
      showToast('Empresa eliminada')
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  const handleDeleteSelected = async () => {
    const ok = await confirm(`¿Eliminar ${seleccionados.length} empresas seleccionadas?`, { confirmLabel: 'Eliminar todas' })
    if (!ok) return
    try {
      await eliminarEmpresas(seleccionados)
      showToast(`${seleccionados.length} empresas eliminadas`)
      setSeleccionados([])
    } catch (err) {
      showToast(err.message || 'Error al eliminar', 'error')
    }
  }

  const handleImportar = async (nuevas) => {
    try {
      for (const e of nuevas) {
        await crearEmpresa({ ...e, usuarios: 0, cursos: 0 })
      }
      setModalCarga(false)
      showToast(`${nuevas.length} empresas importadas correctamente`)
    } catch (err) {
      showToast(err.message || 'Error al importar', 'error')
    }
  }

  /* styles */
  const card = {
    background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
  }
  const TD = { padding: '12px 14px', fontSize: 13, color: 'var(--fg-2)', verticalAlign: 'middle' }
  const TH_BASE = {
    padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: 'var(--fg-3)',
    background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-default)',
    whiteSpace: 'nowrap', textAlign: 'left',
  }

  /* ── render ── */
  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Toolbar ── */}
      <div style={{ ...card, overflow: 'visible', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 340 }}>
          <Search size={14} strokeWidth={1.75} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--neutral-400)', pointerEvents: 'none',
          }} />
          <input
            value={busquedaInput}
            onChange={e => handleBusqueda(e.target.value)}
            placeholder="Buscar por RUT, nombre, contacto..."
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

        <FiltroSelect label="Estado" value={filtroEstado} onChange={v => { setFiltroEstado(v); setPagina(1) }}
          options={['Todos', 'Activa', 'En revisión', 'Borrador', 'Inactiva']} />
        <FiltroSelect label="Región" value={filtroRegion} onChange={v => { setFiltroRegion(v); setPagina(1) }}
          options={regiones} />

        {/* Rango cursos */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>Cursos:</span>
          <NumInput value={minCursos} onChange={v => { setMinCursos(v); setPagina(1) }} placeholder="Min" />
          <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>—</span>
          <NumInput value={maxCursos} onChange={v => { setMaxCursos(v); setPagina(1) }} placeholder="Max" />
        </div>

        {filtrosActivos > 0 && (
          <button
            onClick={limpiarFiltros}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              height: 30, padding: '0 10px', fontSize: 12, fontWeight: 500,
              color: 'var(--fg-3)', background: 'transparent',
              border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <XIcon size={12} strokeWidth={2} /> Limpiar
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
                zIndex: 50, minWidth: 240, overflow: 'hidden',
              }}>
                {seleccionados.length > 0 && (
                  <DDItem onClick={() => { exportarExcel(empresasConContadores.filter(e => seleccionados.includes(e.id)), 'empresas-seleccionadas'); setExportDD(false) }}>
                    Exportar seleccionados ({seleccionados.length})
                  </DDItem>
                )}
                <DDItem onClick={() => { exportarExcel(empresasFiltradas, 'empresas-resultados'); setExportDD(false) }}>
                  Exportar todos los resultados ({empresasFiltradas.length})
                </DDItem>
                <DDItem onClick={() => { exportarExcel(empresasConContadores, 'empresas-completas'); setExportDD(false) }}>
                  Exportar datos completos ({empresasConContadores.length})
                </DDItem>
              </div>
            )}
          </div>
        )}
        {puedeCrear && (
          <Button variant="secondary" size="sm" icon={Upload} onClick={() => setModalCarga(true)}>Carga Masiva</Button>
        )}
        {puedeCrear && (
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setModalEmpresa('nueva')}>Nueva Empresa</Button>
        )}
      </div>

      {/* ── Table card ── */}
      <div style={card}>

        {/* Batch bar */}
        {seleccionados.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', background: 'var(--brand-50)',
            borderBottom: '1px solid var(--brand-100)',
          }}>
            <input type="checkbox" ref={headerChkRef} onChange={toggleAll}
              style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)' }}>
              {seleccionados.length} empresa{seleccionados.length !== 1 ? 's' : ''} seleccionada{seleccionados.length !== 1 ? 's' : ''}
            </span>
            <div style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" icon={Download}
              onClick={() => exportarExcel(empresasConContadores.filter(e => seleccionados.includes(e.id)), 'empresas-seleccionadas')}>
              Exportar seleccionados
            </Button>
            {puedeEliminar && (
            <Button variant="dangerSoft" size="sm" icon={Trash2} onClick={handleDeleteSelected}>
              Eliminar seleccionados
            </Button>
            )}
            <Button variant="ghost" size="sm" icon={XIcon} onClick={() => setSeleccionados([])}>
              Cancelar
            </Button>
          </div>
        )}

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...TH_BASE, width: 40 }}>
                  {seleccionados.length === 0 && (
                    <input ref={headerChkRef} type="checkbox" onChange={toggleAll}
                      style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
                  )}
                </th>
                <SortTh label="Empresa"           col="nombre"   ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} />
                <SortTh label="RUT"               col="rut"      ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} />
                <SortTh label="Contacto"          col="contacto" ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} />
                <SortTh label="Usuarios"          col="usuarios" ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} center />
                <SortTh label="Cursos"            col="cursos"   ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} center />
                <SortTh label="Estado"            col="estado"   ordenCol={ordenCol} ordenDir={ordenDir} onSort={handleSort} />
                <th style={TH_BASE} />
              </tr>
            </thead>
            <tbody>
              {empresasPagina.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <Search size={36} strokeWidth={1.25} color="var(--fg-3)" />
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)' }}>
                        Sin resultados {busqueda ? `para "${busqueda}"` : ''}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--fg-4)' }}>
                        Intente con otros términos o limpie los filtros.
                      </div>
                      {filtrosActivos > 0 && (
                        <Button variant="ghost" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                empresasPagina.map(empresa => (
                  <EmpresaRow
                    key={empresa.id}
                    empresa={empresa}
                    selected={seleccionados.includes(empresa.id)}
                    onToggle={() => toggleSel(empresa.id)}
                    onEdit={() => setModalEmpresa(empresa)}
                    onDelete={() => handleDelete(empresa)}
                    TD={TD}
                    puedeEditar={puedeEditar}
                    puedeEliminar={puedeEliminar}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {empresasFiltradas.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, empresasFiltradas.length)}–{Math.min(pagina * POR_PAGINA, empresasFiltradas.length)} de {empresasFiltradas.length} empresas
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
      {modalEmpresa && (
        <ModalEmpresa
          empresa={modalEmpresa}
          onClose={() => setModalEmpresa(null)}
          onSave={handleSaveEmpresa}
        />
      )}
      {modalCarga && (
        <ModalCargaMasiva
          onClose={() => setModalCarga(false)}
          onImportar={handleImportar}
          empresasExistentes={empresas}
        />
      )}

      {/* ── Toast ── */}
      <Toast toast={toast} />
    </div>
  )
}

/* ── sub-components ── */
function EmpresaRow({ empresa: e, selected, onToggle, onEdit, onDelete, TD, puedeEditar = true, puedeEliminar = true }) {
  const [hovered, setHovered] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: selected ? 'var(--brand-50)' : hovered ? 'var(--neutral-25)' : 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}
    >
      <td style={{ ...TD, width: 40 }}>
        <input type="checkbox" checked={selected} onChange={onToggle}
          style={{ width: 15, height: 15, accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
      </td>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--brand-50)', color: 'var(--brand-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Building2 size={16} strokeWidth={1.75} />
          </div>
          <span style={{ fontWeight: 600, color: 'var(--fg-1)', fontSize: 13 }}>{e.nombre}</span>
        </div>
      </td>
      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-3)' }}>{e.rut}</td>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Avatar name={e.contacto} size={26} />
          <span>{e.contacto}</span>
        </div>
      </td>
      <td style={{ ...TD, textAlign: 'center', fontWeight: 500 }}>{e.usuarios}</td>
      <td style={{ ...TD, textAlign: 'center', fontWeight: 500 }}>{e.cursos}</td>
      <td style={TD}><Badge variant={ESTADO_BADGE[e.estado] ?? 'neutral'}>{e.estado}</Badge></td>
      <td style={{ ...TD, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {puedeEditar   && <IconButton icon={Edit2}  size={30} variant="ghost" title="Editar"           onClick={onEdit} />}
          {puedeEliminar && <IconButton icon={Trash2} size={30} variant="ghost" title="Eliminar empresa" onClick={onDelete} style={{ color: 'var(--danger-500)' }} />}
        </div>
      </td>
    </tr>
  )
}

function PageBtn({ children, active, disabled, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: 30, height: 30, padding: '0 6px',
        borderRadius: 'var(--radius-sm)',
        border: active ? '1px solid var(--brand-500)' : '1px solid var(--border-default)',
        background: active ? 'var(--brand-50)' : hovered ? 'var(--neutral-100)' : 'var(--bg-surface)',
        color: active ? 'var(--brand-600)' : 'var(--fg-2)',
        fontSize: 13, fontWeight: active ? 600 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 150ms', fontFamily: 'var(--font-sans)',
      }}
    >{children}</button>
  )
}

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
        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        display: 'block',
      }}
    >{children}</button>
  )
}

function NumInput({ value, onChange, placeholder }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="number" min={0} value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: 60, height: 30, padding: '0 8px', fontSize: 12,
        color: 'var(--fg-2)', background: 'var(--bg-surface)',
        border: `1px solid ${focused ? 'var(--border-focus)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)', outline: 'none', fontFamily: 'var(--font-sans)',
      }}
    />
  )
}
