// Genera un archivo JSON con todos los datos de la app y lo descarga al navegador.
// Se usa desde la pantalla de Configuración para backups manuales.

import { apiFetch } from './apiClient'
import { hoyChile } from '../utils/fecha'

const TABLAS   = ['empresas', 'personas', 'certificados', 'cursos', 'plantillas', 'usuarios']
const BACKUP_KEY = 'otec_demo_ultimo_backup'

// Retorna la fecha ISO del último backup hecho desde este navegador, o null si nunca se hizo.
export function getUltimoBackup() {
  return localStorage.getItem(BACKUP_KEY) || null
}

// Devuelve true si han pasado más de 24 horas desde el último backup (o si nunca se hizo).
// AppContext lo llama al iniciar sesión para mostrar el aviso en el topbar.
export function debeHacerBackup() {
  const ultimo = getUltimoBackup()
  if (!ultimo) return true
  return Date.now() - new Date(ultimo).getTime() > 24 * 60 * 60 * 1000
}

// Descarga todas las tablas en un JSON y lo guarda como archivo en el navegador.
// Si alguna tabla falla, se incluye en el campo errores pero igual se descarga el resto.
export async function descargarBackup() {
  const datos   = {}
  const errores = []

  for (const tabla of TABLAS) {
    try {
      const result = await apiFetch(`${tabla}.php`)
      datos[tabla] = Array.isArray(result) ? result : []
    } catch {
      errores.push(tabla)
    }
  }

  const backup = {
    version: '2.0',
    fecha:   new Date().toISOString(),
    tablas:  datos,
    errores,
  }

  // Crea un blob temporal, simula un click en un link invisible y lo libera
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `otec-demo-backup-${hoyChile()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  localStorage.setItem(BACKUP_KEY, new Date().toISOString())
  return { ok: errores.length === 0, errores }
}

// pingDB ya no es necesario con MySQL en hosting compartido
export async function pingDB() { /* no-op */ }
