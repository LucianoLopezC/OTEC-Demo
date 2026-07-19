// Hook genérico de datos: carga una entidad al montar y expone CRUD optimista.
// Cada crear/editar/eliminar actualiza el array local sin esperar un refetch,
// lo que hace que las tablas respondan al instante.

import { useState, useEffect, useCallback } from 'react'

export function useSupabase(servicio, _nombre, { enabled = true } = {}) {
  const [datos,      setDatos]      = useState([])
  const [cargando,   setCargando]   = useState(false)
  const [error,      setError]      = useState(null)
  const [ultimaSync, setUltimaSync] = useState(null)

  // Carga los datos desde la API. Se llama al montar y desde refrescar().
  const cargar = useCallback(async () => {
    if (!enabled) return
    setCargando(true)
    setError(null)
    try {
      const result = await servicio.leer()
      setDatos(Array.isArray(result) ? result : [])
      setUltimaSync(Date.now())
    } catch (e) {
      setError(e.message || 'Error al cargar datos')
    } finally {
      setCargando(false)
    }
  }, [enabled, servicio])

  useEffect(() => {
    if (enabled) cargar()
  }, [enabled, cargar])

  // Agrega el objeto nuevo al array local con la respuesta del servidor (que incluye el id generado)
  const crear = async (obj) => {
    const nuevo = await servicio.crear(obj)
    setDatos(prev => [...prev, nuevo])
    setUltimaSync(Date.now())
    return nuevo
  }

  // Reemplaza el item en el array por la versión actualizada que devuelve el servidor
  const editar = async (obj) => {
    const actualizado = await servicio.editar(obj)
    setDatos(prev => prev.map(d => d.id === obj.id ? actualizado : d))
    setUltimaSync(Date.now())
    return actualizado
  }

  // Elimina del array local si el servidor confirma el borrado
  const eliminar = async (id) => {
    await servicio.eliminar(id)
    setDatos(prev => prev.filter(d => d.id !== id))
    setUltimaSync(Date.now())
  }

  const refrescar = useCallback(() => cargar(), [cargar])

  return { datos, cargando, error, refrescar, crear, editar, eliminar, ultimaSync }
}
