// Todas las fechas del sistema se muestran en hora de Chile continental.
const TZ = 'America/Santiago'

// Retorna la fecha de hoy como 'YYYY-MM-DD' en zona horaria Santiago.
// Se usa para nombres de archivos de backup y valores por defecto en formularios.
export function hoyChile() {
  return new Intl.DateTimeFormat('sv', { timeZone: TZ }).format(new Date())
}

// Retorna un Date ajustado a "ahora" en Santiago.
// Necesario para comparar fechas de vencimiento contra la hora local correcta,
// no UTC, que en Chile puede diferir hasta 4 horas en horario de verano.
export function ahoraChile() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

// Convierte un ISO string o timestamp a 'DD/MM/YYYY HH:MM' en Santiago.
// Se usa en tablas donde importa mostrar la hora exacta (último acceso, emisión).
export function fmtFechaHora(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: TZ,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch { return iso }
}

// Convierte 'YYYY-MM-DD' o ISO a '15 de enero de 2024' en Santiago.
// Se usa en los certificados PDF donde la fecha debe mostrarse escrita.
// El T12:00:00 evita que fechas sin hora queden un día atrás por el desfase UTC.
export function fmtFechaLarga(str) {
  if (!str) return ''
  try {
    const d = str.includes('T') ? new Date(str) : new Date(str + 'T12:00:00')
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: TZ,
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(d)
  } catch { return str }
}
