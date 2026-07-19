import { useMemo, useState } from 'react'
import { Building2, FileText, Users, Award, Plus, Edit2, BookOpen } from 'lucide-react'
import StatCard      from '../components/atoms/StatCard'
import QuickActionRow from '../components/atoms/QuickActionRow'
import Badge         from '../components/atoms/Badge'
import Button        from '../components/atoms/Button'
import IconButton    from '../components/atoms/IconButton'
import { useApp }   from '../context/AppContext'
import { MODALIDADES } from './GestionCursos/utils'
import { useResponsive } from '../hooks/useResponsive'
import { ahoraChile } from '../utils/fecha'

// Dashboard principal. Muestra KPIs, cursos recientes, acciones rápidas,
// historial de actividad y estado del catálogo — todo filtrado por permisos del rol activo.
const card = {
  background: 'var(--bg-surface)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
}

const cardHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 22px 14px',
}

const TONE_DOT = {
  sky:    'var(--accent-sky-50)',
  mint:   'var(--accent-mint-50)',
  purple: 'var(--accent-purple-50)',
  amber:  'var(--accent-amber-50)',
}

const TONE_COLOR = {
  sky:    'var(--accent-sky-500)',
  mint:   'var(--accent-mint-500)',
  purple: 'var(--accent-purple-500)',
  amber:  'var(--accent-amber-500)',
}

const ESTADO_BADGE = {
  'Activo':    'success',
  'Borrador':  'warning',
  'Archivado': 'neutral',
}

// Convierte una fecha a texto relativo ("Hoy", "Ayer", "Hace 3 días", etc.)
function relativeDate(dateStr) {
  const now = ahoraChile()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.floor((today - new Date(dateStr + 'T12:00:00')) / 86_400_000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7)  return `Hace ${diff} días`
  const w = Math.floor(diff / 7)
  if (diff < 30) return `Hace ${w} semana${w > 1 ? 's' : ''}`
  const m = Math.floor(diff / 30)
  return `Hace ${m} mes${m > 1 ? 'es' : ''}`
}

export default function Dashboard({ onNav }) {
  const { sesion, cursos, empresas, personas, lotesCertificados } = useApp()
  const p = sesion?.rol?.permisos ?? {}
  const { isMobile, isSmall } = useResponsive()

  const [filtroModalidad, setFiltroModalidad] = useState('Todas')

  const cursosFiltrados = useMemo(() =>
    filtroModalidad === 'Todas'
      ? cursos
      : cursos.filter(c => (c.modalidad ?? '') === filtroModalidad),
    [cursos, filtroModalidad],
  )

  /* ── KPI cards (datos reales) ── */
  const kpis = [
    p.verEmpresas && {
      icon: Building2,
      value: String(empresas.length),
      label: 'Empresas',
      tone: 'sky',
      trend: `${empresas.filter(e => e.estado === 'Activa').length} activas`,
    },
    p.verCursos && {
      icon: FileText,
      value: String(cursos.filter(c => c.estado === 'Activo').length),
      label: 'Cursos Activos',
      tone: 'mint',
    },
    p.verPersonas && {
      icon: Users,
      value: String(personas.length),
      label: 'Personas',
      tone: 'purple',
    },
    p.verEmision && {
      icon: Award,
      value: String(cursos.reduce((s, c) => s + (c.totalEmisiones ?? 0), 0)),
      label: 'Cert. Emitidos',
      tone: 'amber',
    },
  ].filter(Boolean)

  /* ── Cursos recientes (datos reales, ordenados por fecha) ── */
  const cursosRecientes = useMemo(
    () => [...cursosFiltrados].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(0, 3),
    [cursosFiltrados],
  )

  /* ── Historial de actividad (derivado de lotesCertificados + empresas) ── */
  const actividad = useMemo(() => {
    const items = []

    ;[...lotesCertificados]
      .filter(l => l.emitidoEn)
      .sort((a, b) => b.emitidoEn.localeCompare(a.emitidoEn))
      .slice(0, 6)
      .forEach(l => {
        const curso = cursos.find(c => c.id === l.cursoId)
        items.push({
          texto:  `${l.cantidadEmitida} cert. emitidos · ${curso?.nombre ?? 'Curso'}`,
          tiempo: relativeDate(l.emitidoEn.slice(0, 10)),
          fecha:  l.emitidoEn,
          tone:   'sky',
        })
      })

    ;[...empresas]
      .filter(e => e.creadoEn)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .slice(0, 4)
      .forEach(e => items.push({
        texto:  `Empresa registrada: ${e.nombre}`,
        tiempo: relativeDate(e.creadoEn.slice(0, 10)),
        fecha:  e.creadoEn,
        tone:   'mint',
      }))

    return items
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 4)
  }, [lotesCertificados, cursos, empresas])

  /* ── Stats para "Estado del Catálogo" ── */
  const cursosActivos    = cursosFiltrados.filter(c => c.estado === 'Activo').length
  const cursosBorrador   = cursosFiltrados.filter(c => c.estado === 'Borrador').length
  const cursosArchivados = cursosFiltrados.filter(c => c.estado === 'Archivado').length
  const totalHoras       = cursosFiltrados.reduce((s, c) => s + (c.horas ?? 0), 0)
  const totalEmisiones   = cursosFiltrados.reduce((s, c) => s + (c.totalEmisiones ?? 0), 0)

  /* ── Acciones rápidas según permisos ── */
  const acciones = [
    p.crearCurso         && { label: 'Nuevo Curso',          tone: 'sky',    screen: 'gestionCursos' },
    p.crearEmpresa       && { label: 'Nueva Empresa',        tone: 'mint',   screen: 'empresas'      },
    p.verPlantillas      && { label: 'Nueva Plantilla',      tone: 'purple', screen: 'plantillas'    },
    p.emitirCertificados && { label: 'Emitir Certificado',   tone: 'amber',  screen: 'emision'       },
  ].filter(Boolean)

  // Decide qué secciones mostrar y cuántas columnas usar según los permisos y el tamaño de pantalla.
  // Se calcula acá para no meter lógica condicional en el JSX.
  const mostrarCursosRecientes = p.verCursos
  const mostrarAcciones        = acciones.length > 0
  const mostrarRow2            = mostrarCursosRecientes || mostrarAcciones
  const row2Cols               = isSmall ? '1fr' : (mostrarCursosRecientes && mostrarAcciones ? '1.6fr 1fr' : '1fr')

  const mostrarHistorial = p.gestionarUsuarios      // sólo superadmin ve el log global
  const mostrarCatalogo  = p.verCursos
  const mostrarMiEmpresa = p.verDatosEmpresaPropia && !p.verCursos
  const mostrarRow3Right = mostrarCatalogo || mostrarMiEmpresa
  const mostrarRow3      = mostrarHistorial || mostrarRow3Right
  const row3Cols         = isSmall ? '1fr' : (mostrarHistorial && mostrarRow3Right ? '1.6fr 1fr' : '1fr')

  const kpiCols = isMobile
    ? (kpis.length >= 3 ? 'repeat(2, 1fr)' : `repeat(${kpis.length}, 1fr)`)
    : `repeat(${kpis.length}, 1fr)`

  return (
    <div style={{ padding: 'var(--screen-pad)', display: 'flex', flexDirection: 'column', gap: 'var(--card-gap)', minHeight: '100%' }}>

      {/* ── KPI row ── */}
      {kpis.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: 'var(--card-gap)' }}>
          {kpis.map((k, i) => (
            <StatCard key={i} icon={k.icon} value={k.value} label={k.label} tone={k.tone} trend={k.trend} />
          ))}
        </div>
      )}

      {/* ── Second row ── */}
      {mostrarRow2 && (
        <div style={{ display: 'grid', gridTemplateColumns: row2Cols, gap: 'var(--card-gap)' }}>

          {/* Cursos Recientes */}
          {mostrarCursosRecientes && (
            <div style={card}>
              <div style={{ ...cardHeader, flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Cursos Recientes</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
                  {['Todas', ...MODALIDADES].map(m => (
                    <button
                      key={m}
                      onClick={() => setFiltroModalidad(m)}
                      style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontWeight: filtroModalidad === m ? 600 : 400,
                        border: filtroModalidad === m ? '1px solid var(--brand-300)' : '1px solid var(--border-default)',
                        background: filtroModalidad === m ? 'var(--brand-50)' : 'transparent',
                        color: filtroModalidad === m ? 'var(--brand-600)' : 'var(--fg-3)',
                        transition: 'all 150ms',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {p.crearCurso && (
                  <Button variant="primary" size="sm" icon={Plus} onClick={() => onNav('gestionCursos')}>
                    Nuevo Curso
                  </Button>
                )}
              </div>

              <div>
                {cursosRecientes.map(c => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    padding: '12px 22px', borderTop: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--fg-1)', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {c.nombre}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
                        {c.horas}h · {c.condicion} · {relativeDate(c.creadoEn.slice(0, 10))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <Badge variant={ESTADO_BADGE[c.estado] ?? 'neutral'}>{c.estado}</Badge>
                      <IconButton
                        icon={Edit2} size={28} variant="ghost" title="Ver en catálogo"
                        onClick={() => onNav('gestionCursos')}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '12px 22px', borderTop: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                  Mostrando {cursosRecientes.length} de {cursosFiltrados.length} cursos
                  {filtroModalidad !== 'Todas' && ` · ${filtroModalidad}`}
                </span>
                <Button variant="ghost" size="sm" onClick={() => onNav('gestionCursos')}>Ver todos →</Button>
              </div>
            </div>
          )}

          {/* Acciones Rápidas */}
          {mostrarAcciones && (
            <div style={card}>
              <div style={cardHeader}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Acciones Rápidas</span>
              </div>
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {acciones.map((a, i) => (
                  <QuickActionRow key={i} label={a.label} tone={a.tone} onClick={() => onNav(a.screen)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Third row ── */}
      {mostrarRow3 && (
        <div style={{ display: 'grid', gridTemplateColumns: row3Cols, gap: 'var(--card-gap)' }}>

          {/* Historial de Actividad (sólo superadmin) */}
          {mostrarHistorial && (
            <div style={card}>
              <div style={cardHeader}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Actividad Reciente</span>
                {p.verReportes && (
                  <Button variant="ghost" size="sm" onClick={() => onNav('reportes')}>Ver reportes</Button>
                )}
              </div>
              <div style={{ padding: '0 22px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {actividad.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--fg-4)', textAlign: 'center', padding: '16px 0' }}>
                    Sin actividad registrada aún.
                  </div>
                ) : actividad.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: TONE_DOT[a.tone],
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: TONE_COLOR[a.tone] }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.45 }}>{a.texto}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>{a.tiempo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estado del Catálogo (superadmin + operador) ó Mi Empresa (empresa) */}
          {mostrarRow3Right && (
            <div style={card}>
              {mostrarCatalogo ? (
                <>
                  <div style={cardHeader}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Estado del Catálogo</span>
                    <BookOpen size={18} strokeWidth={1.75} color="var(--fg-3)" />
                  </div>
                  <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {[
                      { label: 'Activos',    count: cursosActivos,    color: 'var(--success-500)' },
                      { label: 'Borrador',   count: cursosBorrador,   color: 'var(--warning-400)' },
                      { label: 'Archivados', count: cursosArchivados, color: 'var(--neutral-400)' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                          <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-1)' }}>{item.count}</span>
                      </div>
                    ))}

                    <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 0' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-1)' }}>{totalHoras}h</div>
                        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Horas totales</div>
                      </div>
                      <div style={{ width: 1, background: 'var(--border-subtle)' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-1)' }}>{totalEmisiones}</div>
                        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Cert. emitidos</div>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => onNav('gestionCursos')}>Ver catálogo →</Button>
                  </div>
                </>
              ) : (
                <>
                  <div style={cardHeader}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-1)' }}>Mi Empresa</span>
                    <Building2 size={18} strokeWidth={1.75} color="var(--fg-3)" />
                  </div>
                  <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{
                      padding: '14px 16px',
                      background: 'var(--brand-50)',
                      borderRadius: 10,
                      border: '1px solid var(--brand-100)',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)' }}>
                        {sesion?.usuario?.empresaNombre ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--brand-500)', marginTop: 4 }}>Cuenta activa</div>
                    </div>

                    <div style={{ height: 1, background: 'var(--border-subtle)' }} />

                    {p.emitirCertificados && (
                      <Button variant="primary" size="sm" icon={Award} onClick={() => onNav('emision')}>
                        Emitir Certificado
                      </Button>
                    )}
                    {p.verEmision && !p.emitirCertificados && (
                      <Button variant="ghost" size="sm" onClick={() => onNav('emision')}>
                        Ver Emisiones →
                      </Button>
                    )}
                    {p.verPersonas && (
                      <Button variant="ghost" size="sm" onClick={() => onNav('personas')}>
                        Ver Personas →
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
