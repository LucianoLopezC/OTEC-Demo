import { useContext } from 'react'
import { AppContext } from '../context/AppContext'

// Devuelve true solo si el rol activo tiene el permiso explícitamente en true.
// undefined y false se tratan igual: sin permiso.
export function usePermiso(permiso) {
  const { sesion } = useContext(AppContext)
  if (!sesion) return false
  return sesion.rol?.permisos?.[permiso] === true
}
