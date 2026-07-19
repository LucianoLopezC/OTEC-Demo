import { useState, useEffect, useCallback } from 'react'
import {
  BadgeCheck, XCircle, Search, Loader2, Download,
  User, Building2, BookOpen, Calendar, BarChart2, KeyRound,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import Button    from '../components/atoms/Button'
import TextInput from '../components/atoms/TextInput'
import Badge     from '../components/atoms/Badge'
import { brand } from '../config/brand'
import { buscarCertificadoPublico } from '../services/supabase'
import { ahoraChile } from '../utils/fecha'
import { generarPDFPropio } from './EmisionCertificados/generarPDF'
import { nombreArchivoCert } from './EmisionCertificados/utils'

// Pantalla de verificación pública de certificados.
// Accesible sin sesión desde ?codigo=CERT-... o manualmente escribiendo el código.

// Convierte fecha YYYY-MM-DD a DD/MM/YYYY para mostrarlo en la tarjeta
function fmtFecha(f) {
  if (!f) return '—'
  if (f.includes('/')) return f
  const [y, m, d] = f.split('-')
  return `${d}/${m}/${y}`
}

function parseFecha(f) {
  if (!f) return null
  if (f.includes('-')) {
    const [y, m, d] = f.split('-')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  if (f.includes('/')) {
    const [d, m, y] = f.split('/')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }
  return null
}

// Calcula si el certificado está vigente, por vencer (menos de 30 días) o vencido.
// Usa ahoraChile() para comparar en la zona horaria correcta.
function vigenciaBadge(fechaVencimiento) {
  const venc = parseFecha(fechaVencimiento)
  if (!venc) return null
  const hoy = ahoraChile()
  hoy.setHours(0, 0, 0, 0)
  const dias = Math.round((venc - hoy) / (1000 * 60 * 60 * 24))
  if (dias < 0) return { variant: 'danger',   label: 'Vencido' }
  if (dias < 30) return { variant: 'warning',  label: 'Por vencer' }
  return   { variant: 'success',  label: 'Vigente' }
}

function calcVigenciaMeses(fechaEmision, fechaVencimiento, fallback = 12) {
  if (!fechaVencimiento) return 0
  if (!fechaEmision) return fallback
  const diff = new Date(fechaVencimiento) - new Date(fechaEmision)
  return Math.round(diff / (1000 * 60 * 60 * 24 * 30.44))
}

// ── Sub-components ────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <Icon size={14} strokeWidth={1.75} color="var(--brand-600)" />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-600)',
        textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)' }}>{label}</span>
      <span style={{
        fontSize: 13, color: 'var(--fg-1)', fontWeight: 500,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
      }}>{value || '—'}</span>
    </div>
  )
}

function ResultCard({ cert, onDescargar, descargando }) {
  const vig = vigenciaBadge(cert.fechaVencimiento)

  return (
    <div style={{
      borderLeft: `4px solid ${cert.estado === 'Aprobado' ? 'var(--success-500)' : 'var(--danger-500)'}`,
      borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-surface)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: cert.estado === 'Aprobado' ? 'var(--success-50)' : 'var(--danger-50)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BadgeCheck size={22} strokeWidth={1.75}
            color={cert.estado === 'Aprobado' ? 'var(--success-500)' : 'var(--danger-500)'} />
          <span style={{ fontWeight: 700, fontSize: 14,
            color: cert.estado === 'Aprobado' ? 'var(--success-600)' : 'var(--danger-600)' }}>
            {cert.estado === 'Aprobado' ? 'CERTIFICADO VÁLIDO' : 'CERTIFICADO REPROBADO'}
          </span>
        </div>
        <Badge variant={cert.estado === 'Aprobado' ? 'success' : 'danger'} dot={false}>
          {cert.estado}
        </Badge>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Participante */}
        <div>
          <SectionLabel icon={User} label="Participante" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <Row label="Nombre" value={cert.nombre || cert.nombreParticipante} />
            <Row label="RUT"    value={cert.rut || cert.rutParticipante} />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* Empresa */}
        <div>
          <SectionLabel icon={Building2} label="Empresa" />
          <Row label="Nombre de la Empresa" value={cert.empresaNombre} />
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* Curso */}
        <div>
          <SectionLabel icon={BookOpen} label="Curso" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <Row label="Nombre"   value={cert.curso} />
            <Row label="Duración" value={cert.horas ? `${cert.horas} horas` : '—'} />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* Fechas */}
        <div>
          <SectionLabel icon={Calendar} label="Fechas" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
            <Row label="Emitido"      value={fmtFecha(cert.fechaEmision)} />
            <Row label="Válido hasta" value={fmtFecha(cert.fechaVencimiento)} />
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)' }}>Estado</span>
              <div style={{ marginTop: 3 }}>
                {vig
                  ? <Badge variant={vig.variant} dot={false}>{vig.label}</Badge>
                  : <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>—</span>
                }
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* Resultados */}
        <div>
          <SectionLabel icon={BarChart2} label="Resultados" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <Row label="Asistencia" value={cert.asistencia != null ? `${cert.asistencia}%` : '—'} />
            <Row label="Evaluación" value={cert.evaluacion  != null ? `${cert.evaluacion}%` : '—'} />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)' }} />

        {/* Código */}
        <div>
          <SectionLabel icon={KeyRound} label="Código de Verificación" />
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
            color: 'var(--brand-600)',
            background: 'var(--brand-50)', borderRadius: 'var(--radius-md)',
            padding: '4px 10px', letterSpacing: '0.08em',
          }}>
            {cert.codigoCertificado}
          </span>
        </div>

        {/* Descarga (solo visible con sesión activa) */}
        {onDescargar && cert.estado === 'Aprobado' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              size="sm"
              icon={descargando ? Loader2 : Download}
              disabled={descargando}
              onClick={onDescargar}
            >
              {descargando ? 'Generando PDF...' : 'Descargar certificado'}
            </Button>
          </div>
        )}

        {/* Footer strip */}
        <div style={{
          padding: '10px 0 0 0', borderTop: '1px solid var(--border-subtle)',
          fontSize: 12, color: 'var(--fg-3)', textAlign: 'center',
        }}>
          Certificado emitido por {brand.fullName} &nbsp;·&nbsp;
          {brand.website} &nbsp;·&nbsp; {brand.email}{brand.phone && <> &nbsp;·&nbsp; {brand.phone}</>}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function Verify() {
  const [codigoBusqueda, setCodigoBusqueda] = useState('')
  const [resultado,      setResultado]      = useState(null) // null | 'no_encontrado' | certObj
  const [cargando,       setCargando]       = useState(false)
  const [descargando,    setDescargando]    = useState(false)

  const handleDescargar = useCallback(async () => {
    if (!resultado || resultado === 'no_encontrado') return
    setDescargando(true)
    try {
      const vigenciaMeses = resultado.vigenciaMeses
        || calcVigenciaMeses(resultado.fechaEmision, resultado.fechaVencimiento)
      const datos = {
        cursoNombre:     resultado.curso,
        empresaNombre:   resultado.empresaNombre,
        fechaEmision:    resultado.fechaEmision,
        fechaFinValidez: resultado.fechaVencimiento,
        horas:           resultado.horas,
        fechaInicio:     resultado.fechaInicioCurso  || resultado.fechaEmision,
        fechaTermino:    resultado.fechaTerminoCurso || resultado.fechaEmision,
        lugarEjecucion:  resultado.lugarEjecucion   || '',
        condicion:       resultado.condicion        || '',
        codigoSence:     resultado.codigoSence      || '',
        contenidos:      resultado.contenidos       || '',
        vigenciaMeses,
      }
      const participante = {
        nombre:     resultado.nombre || resultado.nombreParticipante,
        rut:        resultado.rut    || resultado.rutParticipante,
        empresa:    resultado.empresaNombre,
        asistencia: resultado.asistencia,
        evaluacion: resultado.evaluacion,
      }
      const buffer = await generarPDFPropio(participante, datos, resultado.codigoCertificado)
      saveAs(
        new Blob([buffer], { type: 'application/pdf' }),
        `${nombreArchivoCert(datos.empresaNombre, datos.cursoNombre, participante.nombre)}.pdf`,
      )
    } catch (e) {
      console.error('[descargar cert verificar]', e)
    } finally {
      setDescargando(false)
    }
  }, [resultado])

  // Usa verificar.php — endpoint público, funciona con y sin sesión activa
  const buscarCertificado = useCallback(async (codigo) => {
    const codigoNorm = codigo.trim().toUpperCase()
    if (!codigoNorm) return

    setCargando(true)
    setResultado(null)

    const cert = await buscarCertificadoPublico(codigoNorm)
    setResultado(cert ?? 'no_encontrado')
    setCargando(false)
  }, [])

  // Auto-search if ?codigo= is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const codigoUrl = params.get('codigo')
    if (codigoUrl) {
      setCodigoBusqueda(codigoUrl)
      buscarCertificado(codigoUrl)
    }
  }, [buscarCertificado])

  const handleBuscar = () => buscarCertificado(codigoBusqueda)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ width: '100%', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Search card */}
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-sm)', padding: '36px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', gap: 16,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--brand-50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--brand-600)',
          }}>
            <BadgeCheck size={36} strokeWidth={1.5} />
          </div>

          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-1)',
              letterSpacing: '-0.01em', marginBottom: 8 }}>
              Verificación de Certificados {brand.name}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--fg-3)', lineHeight: 1.55, maxWidth: 380 }}>
              Ingrese el código único del certificado para verificar su autenticidad.
            </p>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <TextInput
              icon={Search}
              placeholder="Ej: CERT-2026-KXMF-4721"
              value={codigoBusqueda}
              onChange={e => setCodigoBusqueda(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              height={44}
            />
            <Button
              variant="primary" size="lg" icon={cargando ? Loader2 : Search}
              fullWidth onClick={handleBuscar} disabled={cargando || !codigoBusqueda.trim()}
            >
              {cargando ? 'Buscando...' : 'Verificar Certificado'}
            </Button>
          </div>
        </div>

        {/* Not found */}
        {resultado === 'no_encontrado' && (
          <div style={{
            background: 'var(--danger-50)', border: '1px solid var(--danger-400)',
            borderRadius: 'var(--radius-lg)', padding: '20px 24px',
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <XCircle size={24} strokeWidth={1.75} color="var(--danger-500)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--danger-600)', marginBottom: 4 }}>
                Certificado no encontrado
              </div>
              <div style={{ fontSize: 13, color: 'var(--danger-700)', lineHeight: 1.5 }}>
                El código <strong>"{codigoBusqueda.trim().toUpperCase()}"</strong> no existe
                en nuestros registros. Verifique que sea correcto e intente nuevamente.
              </div>
              <div style={{ marginTop: 10 }}>
                <Button variant="secondary" size="sm"
                  onClick={() => { setResultado(null); setCodigoBusqueda('') }}>
                  Buscar otro código
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {resultado && resultado !== 'no_encontrado' && (
          <ResultCard
            cert={resultado}
            onDescargar={resultado.estado === 'Aprobado' ? handleDescargar : null}
            descargando={descargando}
          />
        )}
      </div>
    </div>
  )
}
