// Cliente HTTP base que usa la API PHP.
// Todos los requests del front pasan por apiFetch — maneja el token JWT y el logout automático.

const _rawApiUrl = import.meta.env.VITE_API_URL || ''
if (!_rawApiUrl) {
  throw new Error(
    '[otec-demo] VITE_API_URL no está configurada. ' +
    'Crea un archivo .env.local con VITE_API_URL=http://localhost/otec-demo-api'
  )
}
// Se quita la barra final para poder concatenar rutas sin doble slash
const API_URL = _rawApiUrl.replace(/\/$/, '')

// El token JWT se guarda en localStorage y se envía en cada request como Bearer.
export function getToken()      { return localStorage.getItem('otec_demo_token') }
export function setToken(t)     { localStorage.setItem('otec_demo_token', t) }
export function removeToken()   { localStorage.removeItem('otec_demo_token') }

// Wrapper sobre fetch que agrega el header de autenticación y maneja errores comunes.
// Si el server responde 401, borra el token y dispara un evento que AppContext escucha
// para forzar el logout sin necesidad de importar AppContext aquí.
export async function apiFetch(endpoint, options = {}) {
  const url   = `${API_URL}/${endpoint}`
  const token = getToken()

  // FormData no lleva Content-Type — el browser lo pone solo con el boundary correcto
  const isFormData = options.body instanceof FormData

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const res = await fetch(url, { ...options, headers })

  // 204 No Content — respuesta válida sin cuerpo (DELETE, por ejemplo)
  if (res.status === 204) return null

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const msg = data?.message || `Error HTTP ${res.status}`
    if (res.status === 401) {
      removeToken()
      window.dispatchEvent(new Event('otec-demo:session-expired'))
    }
    throw new Error(msg)
  }

  return data
}

export { API_URL }
