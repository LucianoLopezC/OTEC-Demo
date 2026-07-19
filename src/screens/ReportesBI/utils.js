// Utilidades compartidas entre los gráficos de Reportes BI:
// estilos de tarjeta, tema de colores para recharts, datos sintéticos para la vista demo,
// y funciones de tendencia para comparar períodos.
export const CARD_STYLE = {
  background: 'var(--bg-surface)', borderRadius: 14, padding: '20px 22px',
  boxShadow: 'var(--shadow-sm)',
}

export function getChartTheme() {
  const s = getComputedStyle(document.documentElement)
  const v = name => s.getPropertyValue(name).trim()
  return {
    grid:     v('--border-subtle')  || '#EAF2F4',
    tickMid:  v('--neutral-500')    || '#5E8A98',
    tickDark: v('--neutral-700')    || '#2E4F5C',
  }
}

const NOMBRES = [
  "Carlos Muñoz","Valentina Soto","Roberto Fuentes","Camila Araya","Diego Pérez",
  "Sofía Castro","Andrés Rodríguez","Daniela Navarro","Felipe Torres","María Herrera",
  "Javier Morales","Francisca Díaz","Sebastián Vargas","Catalina Rojas","Nicolás Espinoza",
  "Alejandra Cortés","Cristóbal Reyes","Isidora Silva","Matías González","Paula Contreras",
]
const RUTS = [
  "12.345.678-9","14.567.890-K","9.876.543-2","13.456.789-1","11.234.567-3",
  "15.678.901-4","8.765.432-5","16.789.012-6","10.123.456-7","17.890.123-8",
  "12.901.234-9","13.012.345-K","9.123.456-1","14.234.567-2","11.345.678-3",
  "15.456.789-4","8.567.890-5","16.678.901-6","10.789.012-7","17.890.123-K",
]

const EMPRESAS_SIN = [
  "PYV SERVICIOS INTEGRALES LTDA",
  "CONSTRUCTORA ANDINA SPA",
  "MINERA LOS ANDES",
  "AGROFORESTAL DEL SUR",
  "TRANSPORTES CORDILLERA",
  "FORESTAL MAULINA SA",
  "LOGÍSTICA CENTRAL CHILE",
]

const CURSOS_SIN = [
  "Operador de Motosierra",
  "Trabajo en Altura NCh 1258",
  "Inducción Seguridad Minera",
  "Equipos Eléctricos",
  "Prevención de Riesgos",
  "Manejo Defensivo",
  "Primeros Auxilios",
]

const HORAS_POR_CURSO = [8, 16, 4, 24, 8, 8, 4]

const MESES = [
  "2025-02","2025-03","2025-04","2025-05","2025-06",
  "2025-07","2025-08","2025-09","2025-10","2025-11",
  "2025-12","2026-01","2026-02","2026-03","2026-04","2026-05",
]

// Genera certificados ficticios para mostrar en la vista demo cuando no hay datos reales.
// Los valores de asistencia y evaluación son aleatorios pero siguen una curva senoidal
// para que los gráficos se vean con variación natural.
export function generarDatosSinteticos() {
  const certs = []
  let id = 1000
  MESES.forEach((mes, mi) => {
    const cantidad = Math.round(8 + Math.sin(mi * 0.7) * 4 + Math.random() * 6)
    for (let i = 0; i < cantidad; i++) {
      const cursoIdx  = Math.floor(Math.random() * CURSOS_SIN.length)
      const empresa   = EMPRESAS_SIN[Math.floor(Math.random() * EMPRESAS_SIN.length)]
      const curso     = CURSOS_SIN[cursoIdx]
      const horas     = HORAS_POR_CURSO[cursoIdx]
      const asistencia = 60 + Math.floor(Math.random() * 41)
      const evaluacion = 50 + Math.floor(Math.random() * 51)
      const aprobado   = asistencia >= 75 && evaluacion >= 60
      const [anio, m]  = mes.split("-")
      const dia        = String(1 + Math.floor(Math.random() * 27)).padStart(2, "0")
      const nomIdx     = (id + i) % NOMBRES.length
      certs.push({
        id: `CERT-SIN-${id++}`,
        codigoCertificado: `CERT-${anio}-XXXX-${1000 + id}`,
        curso,
        empresa,
        nombrePersona: NOMBRES[nomIdx],
        rutPersona:    RUTS[nomIdx],
        fechaEmision:  `${anio}-${m}-${dia}`,
        fechaVencimiento: `${Number(anio) + 1}-${m}-${dia}`,
        horas,
        asistencia,
        evaluacion,
        estado: aprobado ? "Aprobado" : "Reprobado",
        mes,
      })
    }
  })
  return certs
}

const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

export function formatMes(mesStr) {
  const [anio, mes] = mesStr.split("-")
  return `${MESES_LABEL[parseInt(mes) - 1]} ${anio.slice(2)}`
}

// Compara el período actual con el período anterior del mismo tamaño para calcular
// la tendencia porcentual (sube/baja/igual). "todo" no tiene período de comparación.
export function calcularTendencia(datosFiltrados, todosDatos, filtroPeriodo) {
  if (filtroPeriodo === "todo") return { porcentaje: 0, direccion: "igual" }

  const mesesCount = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 }[filtroPeriodo] ?? 12
  const ahora = new Date()

  const inicioActual = new Date(ahora)
  inicioActual.setMonth(inicioActual.getMonth() - mesesCount)

  const inicioAnterior = new Date(inicioActual)
  inicioAnterior.setMonth(inicioAnterior.getMonth() - mesesCount)

  const conteoActual   = datosFiltrados.length
  const conteoAnterior = todosDatos.filter(c => {
    const f = new Date(c.fechaEmision)
    return f >= inicioAnterior && f < inicioActual
  }).length

  if (conteoAnterior === 0) return { porcentaje: 0, direccion: "igual" }
  const pct = Math.round(((conteoActual - conteoAnterior) / conteoAnterior) * 100)
  return {
    porcentaje: Math.abs(pct),
    direccion: pct > 0 ? "up" : pct < 0 ? "down" : "igual",
  }
}

export function calcularTendenciaMetrica(actual, todosDatos, filtroPeriodo, selector) {
  if (filtroPeriodo === 'todo') return null
  const meses = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[filtroPeriodo] ?? 12
  const ahora = new Date()
  const inicioActual = new Date(ahora); inicioActual.setMonth(inicioActual.getMonth() - meses)
  const inicioAnterior = new Date(inicioActual); inicioAnterior.setMonth(inicioAnterior.getMonth() - meses)
  const anterior = todosDatos.filter(c => { const f = new Date(c.fechaEmision); return f >= inicioAnterior && f < inicioActual })
  const valAnterior = selector(anterior)
  const valActual   = selector ? actual : 0
  if (valAnterior === 0) return null
  const pct = Math.round(((valActual - valAnterior) / valAnterior) * 100)
  return { porcentaje: Math.abs(pct), direccion: pct > 0 ? 'up' : pct < 0 ? 'down' : 'igual' }
}
