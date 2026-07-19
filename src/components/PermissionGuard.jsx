import { useContext } from 'react'
import { AppContext } from '../context/AppContext'

// Renderiza children solo si el rol tiene el permiso indicado.
// fallback puede ser null (no muestra nada) o un componente alternativo.
export default function PermissionGuard({ permiso, children, fallback = null }) {
  const { sesion } = useContext(AppContext)
  if (!sesion) return fallback
  const tiene = sesion.rol?.permisos?.[permiso] === true
  return tiene ? children : fallback
}
