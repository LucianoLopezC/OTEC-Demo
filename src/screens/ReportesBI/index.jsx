// Pantalla de Reportes BI: dashboard analítico con 8 gráficos y una tabla resumen.
// Si no hay datos reales muestra datos sintéticos de demostración para que los gráficos no queden vacíos.
// Los filtros (período, empresa, curso, estado, año) se aplican en el nivel del índice
// y se pasan a cada gráfico como prop para no duplicar la lógica de filtrado.
import { useState, useMemo, useRef } from 'react'
import { BarChart2, RotateCcw, Building2, Download } from 'lucide-react'
import { useApp }               from '../../context/AppContext'
import { useEmpresaFiltro }     from '../../hooks/useEmpresaFiltro'
import Button                   from '../../components/atoms/Button'
import FiltroSelect             from '../../components/atoms/FiltroSelect'
import { useResponsive }        from '../../hooks/useResponsive'
import KPICards                 from './KPICards'
import GraficoCertificados      from './GraficoCertificados'
import GraficoEmpresas          from './GraficoEmpresas'
import GraficoEstados           from './GraficoEstados'
import GraficoHoras             from './GraficoHoras'
import GraficoCursos            from './GraficoCursos'
import GraficoPersonas          from './GraficoPersonas'
import GraficoVencimientos      from './GraficoVencimientos'
import TablaResumen             from './TablaResumen'
import { exportarReporteCompleto } from './exportarReporteCompleto'

const PERIODOS = [
  { value: '1m',   label: '1 mes' },
  { value: '3m',   label: '3 meses' },
  { value: '6m',   label: '6 meses' },
  { value: '12m',  label: '12 meses' },
  { value: 'todo', label: 'Todo' },
]

const DEFAULTS = { empresa: 'Todas', curso: 'Todos', estado: 'Todos', periodo: '12m', anio: 'Todos' }

/* ── Pill period selector ── */
function PillPeriodo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--neutral-100)', borderRadius: 20, padding: 3 }}>
      {PERIODOS.map(p => {
        const on = value === p.value
        return (
          <button key={p.value} onClick={() => onChange(p.value)} style={{
            height: 28, padding: '0 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, transition: 'background 150ms, color 150ms',
            background: on ? 'var(--brand-600)' : 'transparent',
            color: on ? '#fff' : 'var(--fg-2)',
            fontFamily: 'var(--font-sans)',
          }}>
            {p.label}
          </button>
        )
      })}
    </div>
  )
}



export default function ReportesBI() {
  const { empresas, personas } = useApp()
  const { esEmpresa, empresaId, empresaNombre } = useEmpresaFiltro()
  const { isMobile } = useResponsive()

  const [filtroEmpresa, setFiltroEmpresa] = useState(DEFAULTS.empresa)
  const [filtroCurso,   setFiltroCurso]   = useState(DEFAULTS.curso)
  const [filtroEstado,  setFiltroEstado]  = useState(DEFAULTS.estado)
  const [filtroPeriodo, setFiltroPeriodo] = useState(DEFAULTS.periodo)
  const [filtroAnio,    setFiltroAnio]    = useState(DEFAULTS.anio)
  const [exportando,    setExportando]    = useState(false)
  const [exportError,   setExportError]   = useState(null)

  // Referencias a las tarjetas de gráficos, para capturarlas como imagen al exportar.
  const refCertificados = useRef(null)
  const refEmpresas     = useRef(null)
  const refEstados      = useRef(null)
  const refHoras        = useRef(null)
  const refCursos       = useRef(null)
  const refPersonas     = useRef(null)
  const refVencimientos = useRef(null)

  /* Construir dataset real desde personas */
  const certReales = useMemo(() => {
    const certs = []
    personas.forEach(p => {
      p.certificados.forEach(c => {
        certs.push({
          id: c.id,
          codigoCertificado: c.codigoCertificado,
          curso:    c.curso,
          empresa:  c.empresa,
          horas:    c.horas,
          asistencia:  c.asistencia,
          evaluacion:  c.evaluacion,
          estado:   c.estado,
          fechaEmision: c.fechaEmision,
          fechaVencimiento: c.fechaVencimiento,
          mes: c.fechaEmision ? c.fechaEmision.slice(0, 7) : '',
        })
      })
    })
    return certs
  }, [personas])

  const todosDatos = useMemo(() => certReales, [certReales])

  /* Años únicos para filtro */
  const opcionesAnio = useMemo(() => {
    const anios = [...new Set(
      todosDatos
        .map(c => c.fechaEmision ? c.fechaEmision.slice(0, 4) : null)
        .filter(Boolean)
    )].sort().reverse()
    return [{ value: 'Todos', label: 'Todos los años' }, ...anios.map(a => ({ value: a, label: a }))]
  }, [todosDatos])

  /* Filtrar */
  const datosFiltrados = useMemo(() => {
    let d = [...todosDatos]

    /* Si el rol es empresa, siempre filtrar por su empresa */
    if (esEmpresa && empresaNombre) d = d.filter(c => c.empresa === empresaNombre)
    else if (filtroEmpresa !== 'Todas') d = d.filter(c => c.empresa === filtroEmpresa)

    if (filtroCurso   !== 'Todos') d = d.filter(c => c.curso   === filtroCurso)
    if (filtroEstado  !== 'Todos') d = d.filter(c => c.estado  === filtroEstado)

    if (filtroPeriodo !== 'todo') {
      const meses  = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[filtroPeriodo]
      const corte  = new Date()
      corte.setMonth(corte.getMonth() - meses)
      d = d.filter(c => new Date(c.fechaEmision) >= corte)
    }

    if (filtroAnio !== 'Todos') {
      d = d.filter(c => c.fechaEmision && c.fechaEmision.startsWith(filtroAnio))
    }

    return d
  }, [todosDatos, filtroEmpresa, filtroCurso, filtroEstado, filtroPeriodo, filtroAnio])

  /* Opciones de filtros */
  const opcionesEmpresa = useMemo(() => {
    const unicas = [...new Set(todosDatos.map(c => c.empresa))].sort()
    return [{ value: 'Todas', label: 'Todas las empresas' }, ...unicas.map(e => ({ value: e, label: e }))]
  }, [todosDatos])

  const opcionesCurso = useMemo(() => {
    const unicos = [...new Set(todosDatos.map(c => c.curso))].sort()
    return [{ value: 'Todos', label: 'Todos los cursos' }, ...unicos.map(c => ({ value: c, label: c }))]
  }, [todosDatos])

  const opcionesEstado = [
    { value: 'Todos',     label: 'Todos los estados' },
    { value: 'Aprobado',  label: 'Aprobado' },
    { value: 'Reprobado', label: 'Reprobado' },
  ]

  const filtrosActivos = [
    filtroEmpresa !== DEFAULTS.empresa,
    filtroCurso   !== DEFAULTS.curso,
    filtroEstado  !== DEFAULTS.estado,
    filtroPeriodo !== DEFAULTS.periodo,
    filtroAnio    !== DEFAULTS.anio,
  ].filter(Boolean).length

  const resetearFiltros = () => {
    setFiltroEmpresa(DEFAULTS.empresa)
    setFiltroCurso(DEFAULTS.curso)
    setFiltroEstado(DEFAULTS.estado)
    setFiltroPeriodo(DEFAULTS.periodo)
    setFiltroAnio(DEFAULTS.anio)
  }

  const vacio = datosFiltrados.length === 0

  const handleExportarReporte = async () => {
    setExportando(true)
    setExportError(null)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const capturar = async (ref) => {
        if (!ref.current) return null
        const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
        return { dataUrl: canvas.toDataURL('image/png'), width: ref.current.offsetWidth, height: ref.current.offsetHeight }
      }
      const imagenes = {
        certificados: await capturar(refCertificados),
        empresas:     await capturar(refEmpresas),
        estados:      await capturar(refEstados),
        horas:        await capturar(refHoras),
        cursos:       await capturar(refCursos),
        personas:     await capturar(refPersonas),
        vencimientos: await capturar(refVencimientos),
      }
      await exportarReporteCompleto({
        datosFiltrados,
        personas,
        totalEmpresas: empresas.length,
        filtroEmpresa: esEmpresa && empresaNombre ? empresaNombre : filtroEmpresa,
        filtroPeriodo,
        filtros: {
          empresa: esEmpresa && empresaNombre ? empresaNombre : filtroEmpresa,
          curso:   filtroCurso,
          estado:  filtroEstado,
          periodo: PERIODOS.find(p => p.value === filtroPeriodo)?.label ?? filtroPeriodo,
          anio:    filtroAnio,
        },
        imagenes,
      })
    } catch (e) {
      console.error('Error al exportar el reporte BI:', e)
      setExportError('No se pudo exportar el reporte. Intente nuevamente.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Barra de filtros */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 14, padding: '14px 18px',
        boxShadow: '0 1px 3px rgba(15,27,71,0.06), 0 1px 2px rgba(15,27,71,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <PillPeriodo value={filtroPeriodo} onChange={setFiltroPeriodo} />
          {esEmpresa && empresaNombre ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--success-50)', color: 'var(--success-600)',
              border: '1px solid var(--success-400)', borderRadius: 999,
              padding: '4px 12px', fontSize: 12, fontWeight: 600,
            }}>
              <Building2 size={13} strokeWidth={1.75} />
              {empresaNombre}
            </div>
          ) : (
            <FiltroSelect value={filtroEmpresa} onChange={setFiltroEmpresa} options={opcionesEmpresa} />
          )}
          <FiltroSelect value={filtroCurso}  onChange={setFiltroCurso}  options={opcionesCurso} />
          <FiltroSelect value={filtroEstado} onChange={setFiltroEstado} options={opcionesEstado} />
          <FiltroSelect value={filtroAnio}   onChange={setFiltroAnio}   options={opcionesAnio} />
          <div style={{ flex: 1 }} />
          {!vacio && (
            <Button variant="secondary" size="sm" icon={Download} onClick={handleExportarReporte} disabled={exportando}>
              {exportando ? 'Exportando…' : 'Exportar reporte completo'}
            </Button>
          )}
          {filtrosActivos > 0 && (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={resetearFiltros}>
              Restablecer
            </Button>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-3)' }}>
          {filtrosActivos > 0
            ? `Mostrando ${datosFiltrados.length} certificados · ${filtrosActivos} filtro${filtrosActivos !== 1 ? 's' : ''} activo${filtrosActivos !== 1 ? 's' : ''}`
            : `Mostrando ${datosFiltrados.length} certificados en total`
          }
        </div>
        {exportError && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--danger-50)', border: '1px solid var(--danger-400)',
            fontSize: 12, color: 'var(--danger-600)',
          }}>
            {exportError}
          </div>
        )}
      </div>

      {vacio ? (
        /* Estado vacío */
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 14, padding: '64px 24px',
          boxShadow: '0 1px 3px rgba(15,27,71,0.06), 0 1px 2px rgba(15,27,71,0.04)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
        }}>
          <BarChart2 size={48} strokeWidth={1.25} color="var(--fg-3)" />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-2)' }}>
            Sin datos para los filtros seleccionados
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            Intente ampliar el período o cambiar los filtros.
          </div>
          <Button variant="ghost" size="md" icon={RotateCcw} onClick={resetearFiltros}>
            Restablecer filtros
          </Button>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <KPICards
            datosFiltrados={datosFiltrados}
            todosDatos={todosDatos}
            filtroPeriodo={filtroPeriodo}
            totalEmpresas={empresas.length}
          />

          {/* Gráfico línea — full width */}
          <div ref={refCertificados}>
            <GraficoCertificados datosFiltrados={datosFiltrados} />
          </div>

          {/* Grid 60/40: barras empresa + donut */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '60fr 40fr', gap: 'var(--card-gap)', alignItems: 'start' }}>
            <div ref={refEmpresas}>
              <GraficoEmpresas datosFiltrados={datosFiltrados} />
            </div>
            <div ref={refEstados}>
              <GraficoEstados  datosFiltrados={datosFiltrados} />
            </div>
          </div>

          {/* Área horas — full width */}
          <div ref={refHoras}>
            <GraficoHoras datosFiltrados={datosFiltrados} />
          </div>

          {/* Grid 55/45: top cursos + top personas */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '55fr 45fr', gap: 'var(--card-gap)', alignItems: 'start' }}>
            <div ref={refCursos}>
              <GraficoCursos  datosFiltrados={datosFiltrados} />
            </div>
            <div ref={refPersonas}>
              <GraficoPersonas
                personas={personas}
                filtroEmpresa={esEmpresa && empresaNombre ? empresaNombre : filtroEmpresa}
                filtroPeriodo={filtroPeriodo}
              />
            </div>
          </div>

          {/* Vencimientos — full width */}
          <div ref={refVencimientos}>
            <GraficoVencimientos datosFiltrados={datosFiltrados} />
          </div>

          {/* Tabla resumen — full width */}
          <TablaResumen datosFiltrados={datosFiltrados} />
        </>
      )}
    </div>
  )
}
