import { useContext } from 'react'
import { AppContext } from '../context/AppContext'

// Determina si el usuario activo es del rol "empresa" (scope limitado a su propia empresa).
// Si esEmpresa es true, empresaId y empresaNombre se usan para filtrar listas en toda la app.
// Si es null, el usuario tiene acceso global y no se aplica filtro.
export function useEmpresaFiltro() {
  const { sesion } = useContext(AppContext)
  const esEmpresa = sesion?.rol?.permisos?.verDatosEmpresaPropia === true
  const empresaId = esEmpresa ? sesion?.usuario?.empresaId : null
  const empresaNombre = esEmpresa ? sesion?.usuario?.empresaNombre : null
  return { esEmpresa, empresaId, empresaNombre }
}
