// Capa de servicios de datos: expone CRUD para cada entidad de la app
// y funciones especiales de storage (upload/download de plantillas, lotes, previews).
// La API PHP ya devuelve camelCase, así que no hay transformación de nombres.

import { apiFetch, getToken, API_URL } from './apiClient'

// Genera un objeto con los 4 métodos básicos (leer, crear, editar, eliminar)
// apuntando al endpoint correspondiente. Todos los servicios de entidades lo usan.
function makeService(endpoint) {
  return {
    leer:    ()    => apiFetch(`${endpoint}.php`),
    crear:   (obj) => apiFetch(`${endpoint}.php`,          { method: 'POST',   body: JSON.stringify(obj) }),
    editar:  (obj) => apiFetch(`${endpoint}.php?id=${obj.id}`, { method: 'PUT',  body: JSON.stringify(obj) }),
    eliminar:(id)  => apiFetch(`${endpoint}.php?id=${id}`, { method: 'DELETE' }),
  }
}

// ─── Servicios por entidad ────────────────────────────────────────────────────
export const empresasService   = makeService('empresas')
export const personasService   = makeService('personas')
export const cursosService     = makeService('cursos')
export const plantillasService = makeService('plantillas')
export const rolesService      = makeService('roles')
export const lotesService      = makeService('lotes')
export const certificadosService = makeService('certificados')

export const usuariosService = {
  ...makeService('usuarios'),
  actualizarUltimoAcceso: (id) =>
    apiFetch(`usuarios.php?action=ultimo_acceso&id=${id}`, { method: 'PATCH' }).catch(() => {}),
}

// ─── Folio de lotes ───────────────────────────────────────────────────────────
export async function obtenerFolioNuevo() {
  const data = await apiFetch('lotes.php?action=folio')
  return data.folio
}

// ─── Storage: imágenes de plantillas (PNG/JPG) ────────────────────────────────
export async function uploadImagenPlantilla(file) {
  const form = new FormData()
  form.append('file',   file)
  form.append('bucket', 'plantillas')
  const data = await apiFetch('upload.php', { method: 'POST', body: form })
  return data.publicUrl
}

export async function eliminarImagenPlantilla(publicUrl) {
  if (!publicUrl) return
  // Extraer path relativo de la URL pública
  const path = publicUrl.split('/uploads/imagenes/').pop()
  if (!path || path === publicUrl) return
  await apiFetch(`upload.php?path=${encodeURIComponent(path)}&bucket=plantillas`, { method: 'DELETE' }).catch(() => {})
}

// ─── Storage: plantillas Word (.docx) ─────────────────────────────────────────
export async function subirPlantillaDocx(archivo, nombre) {
  const form = new FormData()
  form.append('file',   archivo)
  form.append('bucket', 'plantillas-docx')
  form.append('nombre', nombre)
  const data = await apiFetch('upload.php', { method: 'POST', body: form })
  return data.path   // ruta corta para guardar en BD (storagePath)
}

export async function descargarPlantillaDocx(storagePath) {
  const token = getToken()
  const res   = await fetch(
    `${API_URL}/download.php?path=${encodeURIComponent(storagePath)}&bucket=plantillas-docx`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error('Error al descargar plantilla')
  return res.blob()
}

export async function eliminarArchivoPlantilla(storagePath) {
  if (!storagePath) return
  await apiFetch(
    `upload.php?path=${encodeURIComponent(storagePath)}&bucket=plantillas-docx`,
    { method: 'DELETE' }
  ).catch(() => {})
}

// ─── Storage: preview temporal (para visor Microsoft Office Online) ──────────

/**
 * Sube el .docx rellenado al servidor como archivo temporal público.
 * Retorna la URL pública del archivo (accesible sin autenticación).
 * El servidor guarda 1 archivo por usuario (sobrescribe el anterior).
 */
export async function subirPreviewTemp(blob, userId) {
  const form = new FormData()
  form.append('file', blob, `preview_${userId}.docx`)
  const data = await apiFetch('preview_temp.php', { method: 'POST', body: form })
  // Construir URL pública: el dominio se deriva de API_URL
  // Local: http://localhost/otec-demo-api → http://localhost/otec-demo-api/uploads/previews/
  // Prod:  https://tu-dominio.com/api → https://tu-dominio.com/uploads/previews/
  const base = API_URL.replace(/\/api$/, '')
  return `${base}/uploads/previews/${data.filename}`
}

/** Elimina el archivo temporal del usuario al cerrar el modal. */
export async function eliminarPreviewTemp() {
  await apiFetch('preview_temp.php', { method: 'DELETE' }).catch(() => {})
}

// ─── Códigos únicos de certificado (generados y verificados en el servidor) ──
/**
 * Solicita al servidor N códigos únicos ya chequeados contra la BD.
 * Evita iterar todo el array de certificados en el front.
 * @param {number} cantidad
 * @returns {Promise<string[]>}
 */
export async function generarCodigosServidor(cantidad = 1) {
  try {
    const data = await apiFetch(`certificados.php?action=generar_codigos&cantidad=${cantidad}`)
    return Array.isArray(data?.codigos) ? data.codigos : []
  } catch {
    return []
  }
}

// ─── Verificación pública de certificados ─────────────────────────────────────
/**
 * Busca un certificado por código — endpoint público, sin autenticación.
 * Usado por la pantalla /verify y los QR de los certificados.
 * @param {string} codigo
 * @returns {Promise<object|null>}
 */
export async function buscarCertificadoPublico(codigo) {
  try {
    const res = await fetch(`${API_URL}/verificar.php?codigo=${encodeURIComponent(codigo)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Storage: snapshots de lotes (ZIP) ───────────────────────────────────────
export async function subirSnapshotLote(folio, zipBlob) {
  const form = new FormData()
  form.append('file',   zipBlob, `${folio}.zip`)
  form.append('bucket', 'certificados-lotes')
  form.append('folio',  folio)
  const data = await apiFetch('upload.php', { method: 'POST', body: form })
  return data.path
}

export async function descargarSnapshotLote(storagePath) {
  // Retorna la URL de descarga directa (autenticada via download.php)
  return `${API_URL}/download.php?path=${encodeURIComponent(storagePath)}&bucket=certificados-lotes&token=${getToken()}`
}

/**
 * Obtiene todos los datos necesarios para regenerar un certificado PDF al vuelo.
 * Incluye datos del certificado + curso + plantilla en un solo request.
 */
export async function obtenerDatosRegeneracion(codigoCertificado) {
  return apiFetch(`certificados.php?action=datos_regeneracion&codigo=${encodeURIComponent(codigoCertificado)}`)
}
