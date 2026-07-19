import { createContext, useContext, useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSupabase } from '../hooks/useSupabase'
import {
  empresasService, personasService, certificadosService,
  cursosService, usuariosService, plantillasService, rolesService,
  lotesService,
} from '../services/supabase'
import { debeHacerBackup } from '../services/backupService'
import { apiFetch, setToken, removeToken, getToken } from '../services/apiClient'

// Genera un código de certificado local como fallback para reprobados.
// Los aprobados usan códigos generados en el servidor (únicos garantizados contra la BD).
function genCodigoCert() {
  const year  = new Date().getFullYear()
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  let letras  = ''
  for (let i = 0; i < 4; i++) letras += chars[Math.floor(Math.random() * chars.length)]
  const num = String(Math.floor(Math.random() * 9000) + 1000)
  return `CERT-${year}-${letras}-${num}`
}

// Roles base que siempre existen. Se pueden editar desde la pantalla de Usuarios y Roles,
// pero en ese caso se guardan en BD y se mezclan con estos en todosLosRoles.
export const ROLES_SISTEMA = [
  {
    id: 'superadmin',
    nombre: 'Superadministrador',
    descripcion: 'Acceso total al sistema. Puede gestionar usuarios, roles, empresas y todos los módulos.',
    color: 'brand',
    sistema: true,
    permisos: {
      verDashboard: true, verEmpresas: true, verPersonas: true, verUsuarios: true,
      verEmision: true, verVerificar: true, verReportes: true,
      verCursos: true, verPlantillas: true,
      crearEmpresa: true, editarEmpresa: true, eliminarEmpresa: true,
      crearPersona: true, crearCurso: true, emitirCertificados: true,
      gestionarUsuarios: true, gestionarRoles: true, exportarDatos: true,
      verCotizador: true, verDatosEmpresaPropia: false,
    },
  },
  {
    id: 'operador',
    nombre: 'Operador Demo',
    descripcion: 'Puede emitir certificados y ver reportes. No puede gestionar empresas, personas ni usuarios.',
    color: 'info',
    sistema: true,
    permisos: {
      verDashboard: true, verEmpresas: false, verPersonas: false, verUsuarios: false,
      verEmision: true, verVerificar: true, verReportes: true,
      verCursos: true, verPlantillas: false,
      crearEmpresa: false, editarEmpresa: false, eliminarEmpresa: false,
      crearPersona: false, crearCurso: false, emitirCertificados: true,
      gestionarUsuarios: false, gestionarRoles: false, exportarDatos: true,
      verCotizador: false, verDatosEmpresaPropia: false,
    },
  },
  {
    id: 'empresa',
    nombre: 'Usuario Empresa',
    descripcion: 'Acceso limitado solo a los datos de su empresa.',
    color: 'success',
    sistema: true,
    permisos: {
      verDashboard: true, verEmpresas: false, verPersonas: true, verUsuarios: false,
      verEmision: true, verVerificar: true, verReportes: true,
      verCursos: false, verPlantillas: false,
      crearEmpresa: false, editarEmpresa: false, eliminarEmpresa: false,
      crearPersona: true, crearCurso: false, emitirCertificados: false,
      gestionarUsuarios: false, gestionarRoles: false, exportarDatos: false,
      verCotizador: false, verDatosEmpresaPropia: true,
    },
  },
]

export const AppContext = createContext(null)

// Contexto central de la app. Provee la sesión activa, todos los datos en memoria
// y los métodos CRUD para cada entidad. No hay estado local en las pantallas para datos —
// todo pasa por acá.
export function AppProvider({ children }) {
  const [sesion,         setSesionRaw]    = useState(null)
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [sincronizando,  setSincronizando]  = useState(false)

  // opts desactiva todos los hooks de datos si no hay sesión, evitando requests sin token
  const autenticado = !!sesion
  const opts = { enabled: autenticado }

  /* dbRoles debe estar antes de iniciarSesion porque ese callback
     usa rolesPersonalizados en su cuerpo y en su array de dependencias    */
  const dbRoles             = useSupabase(rolesService, 'Roles', opts)
  const rolesPersonalizados = dbRoles.datos

  /* ── Login con JWT (PHP API) ─────────────────────────────────────────────── */
  const iniciarSesion = useCallback(async (email, password) => {
    const data = await apiFetch('auth.php', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setToken(data.token)

    // Al login los roles de BD aún no están cargados; se usa ROLES_SISTEMA como
    // fallback. El useEffect de sincronización aplicará la versión BD en cuanto cargue.
    const todosRoles = [...ROLES_SISTEMA, ...rolesPersonalizados]
    const rol = todosRoles.find(r => r.id === data.usuario.rolId)
    if (!rol) throw new Error('Rol no encontrado. Contacte al administrador.')

    setSesionRaw({ usuario: data.usuario, rol })
    return data
  }, [rolesPersonalizados])

  /* ── Verificar token al cargar la página ─────────────────────────────────── */
  useEffect(() => {
    // Limpiar overrides legacy del localStorage (ya no se usan)
    localStorage.removeItem('otec_demo_roles_sistema')

    const token = getToken()
    if (!token) {
      setCargandoSesion(false)
      return
    }
    apiFetch('auth.php')
      .then(data => {
        const todosRoles = [...ROLES_SISTEMA, ...rolesPersonalizados]
        const rol = todosRoles.find(r => r.id === data.usuario.rolId)
        if (rol) setSesionRaw({ usuario: data.usuario, rol })
        else { removeToken(); setSesionRaw(null) }
      })
      .catch(() => { removeToken(); setSesionRaw(null) })
      .finally(() => setCargandoSesion(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // solo al montar — no depende de rolesPersonalizados intencionalmente

  /* ── Escuchar evento de sesión expirada (401 desde apiFetch) ─────────────── */
  useEffect(() => {
    const handler = () => { setSesionRaw(null); removeToken() }
    window.addEventListener('otec-demo:session-expired', handler)
    return () => window.removeEventListener('otec-demo:session-expired', handler)
  }, [])

  /* ── Alerta de backup pendiente ─────────────────────────────────────────── */
  const [backupPendiente, setBackupPendiente] = useState(false)
  useEffect(() => {
    if (autenticado) setBackupPendiente(debeHacerBackup())
  }, [autenticado])

  /* ── Data hooks (PHP API) ────────────────────────────────────────────── */
  const dbEmpresas     = useSupabase(empresasService,    'Empresas',             opts)
  const dbPersonas     = useSupabase(personasService,    'Personas',             opts)
  // certificados NO se carga al arrancar — personas.php ya devuelve los certs
  // embebidos en cada persona via LEFT JOIN. Solo se activa bajo demanda.
  const dbCertificados = useSupabase(certificadosService,'Certificados',         { enabled: false })
  const dbCursos       = useSupabase(cursosService,      'Cursos',               opts)
  const dbUsuarios     = useSupabase(usuariosService,    'Usuarios',             opts)
  const dbPlantillas   = useSupabase(plantillasService,  'Plantillas',           opts)
  const dbLotes        = useSupabase(lotesService,       'LotesCertificados',    opts)

  /* ── Datos directos ───────────────────────────────────────────────────── */
  const empresas           = dbEmpresas.datos
  const cursos             = dbCursos.datos
  const certificados       = dbCertificados.datos   // [] hasta que se cargue manualmente
  const usuarios           = dbUsuarios.datos
  const plantillas         = dbPlantillas.datos
  const lotesCertificados  = dbLotes.datos

  // personas ya vienen con su historial de certificados desde el servidor (JOIN en personas.php)
  const personas = dbPersonas.datos

  // Mezcla los roles hardcodeados con los de BD. Si un rol de sistema fue editado y guardado
  // en BD, la versión de BD tiene prioridad para reflejar el cambio.
  const todosLosRoles = useMemo(() => {
    const dbIds = new Set(dbRoles.datos.map(r => r.id))
    const sistemaBase = ROLES_SISTEMA.filter(r => !dbIds.has(r.id))
    return [...sistemaBase, ...dbRoles.datos]
  }, [dbRoles.datos])

  /* ── Sincronizar sesion.rol cuando cambien los permisos del rol ─────────── */
  useEffect(() => {
    if (!sesion) return
    const rolActualizado = todosLosRoles.find(r => r.id === sesion.usuario.rolId)
    if (rolActualizado && rolActualizado !== sesion.rol) {
      setSesionRaw(s => s ? { ...s, rol: rolActualizado } : s)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosLosRoles])

  /* ── CRUD — Empresas ──────────────────────────────────────────────────── */
  const crearEmpresa    = (obj)  => dbEmpresas.crear(obj)
  const editarEmpresa   = (obj)  => dbEmpresas.editar(obj)
  const eliminarEmpresa = (id)   => dbEmpresas.eliminar(id)
  const eliminarEmpresas= (ids)  => Promise.all(ids.map(id => dbEmpresas.eliminar(id)))

  /* ── CRUD — Cursos ────────────────────────────────────────────────────── */
  const crearCurso    = (obj) => dbCursos.crear(obj)
  const editarCurso   = (obj) => dbCursos.editar(obj)
  const eliminarCurso  = (id)  => dbCursos.eliminar(id)
  const eliminarCursos = (ids) => Promise.all(ids.map(id => dbCursos.eliminar(id)))

  /* ── CRUD — Personas ─────────────────────────────────────────────────── */
  const eliminarPersona  = (id)  => dbPersonas.eliminar(id)
  const eliminarPersonas = (ids) => Promise.all(ids.map(id => dbPersonas.eliminar(id)))

  /* ── CRUD — Roles ────────────────────────────────────────────────────── */
  const crearRol  = (obj) => dbRoles.crear(obj)
  const editarRol = async (obj) => {
    const resultado = await dbRoles.editar(obj)
    // Refetch para que roles de sistema (que no estaban en datos) queden en el state
    await dbRoles.refrescar()
    return resultado
  }
  const eliminarRol = (id) => dbRoles.eliminar(id)

  /* ── CRUD — Plantillas ────────────────────────────────────────────────── */
  const crearPlantilla         = (obj)  => dbPlantillas.crear(obj)
  const editarPlantilla        = (obj)  => dbPlantillas.editar(obj)
  const eliminarPlantilla      = (id)   => dbPlantillas.eliminar(id)
  const editarVariasPlantillas = async (objs) => {
    for (const p of objs) await dbPlantillas.editar(p)
    await dbPlantillas.refrescar()
  }

  /* ── CRUD — Lotes de certificados ────────────────────────────────────── */
  const crearLote = useCallback(async (obj) => {
    return dbLotes.crear(obj)
  }, [dbLotes])

  const editarLote = (obj) => dbLotes.editar(obj)

  const eliminarLote = async (id) => {
    await dbLotes.eliminar(id)
    await dbPersonas.refrescar()  // los certs del lote fueron eliminados en cascade
  }

  /* ── CRUD — Certificados (apiFetch directo; dbCertificados está desactivado) ── */
  const editarCertificado = async (obj) => {
    const result = await apiFetch(`certificados.php?id=${obj.id}`, {
      method: 'PUT',
      body:   JSON.stringify(obj),
    })
    await dbPersonas.refrescar()
    await dbLotes.refrescar()
    return result
  }

  const eliminarCertificado = async (id) => {
    await apiFetch(`certificados.php?id=${id}`, { method: 'DELETE' })
    await dbPersonas.refrescar()
    await dbLotes.refrescar()
  }

  /* ── CRUD — Usuarios ──────────────────────────────────────────────────── */
  const crearUsuario = async (obj) => {
    /* La API PHP hashea la contraseña con bcrypt — no necesitamos hacerlo aquí */
    return dbUsuarios.crear(obj)
  }

  const editarUsuario = async (obj) => {
    /* La API PHP hashea la contraseña si viene sin hash */
    return dbUsuarios.editar(obj)
  }

  const eliminarUsuario = async (id) => {
    return dbUsuarios.eliminar(id)
  }
  const actualizarUltimoAcceso = (id)  => usuariosService.actualizarUltimoAcceso(id).catch(() => {})

  // Registra todos los certificados de una emisión en un solo request al servidor.
  // También registra las personas nuevas y actualiza el contador de emisiones del curso.
  // Usa Sets para detectar duplicados en O(1) sin iterar la lista entera por cada participante.
  const registrarCertificados = async (datosCertificado, certs, reprobados = [], folio = null) => {
    const rutSet    = new Set(dbPersonas.datos.map(x => x.rut).filter(Boolean))
    const nombreSet = new Set(dbPersonas.datos.map(x => x.nombre?.toLowerCase()).filter(Boolean))

    const curso = dbCursos.datos.find(
      c => String(c.id) === String(datosCertificado.cursoId) || c.nombre === datosCertificado.cursoNombre
    )

    const camposComunes = {
      curso:            datosCertificado.cursoNombre,
      cursoId:          curso?.id ?? datosCertificado.cursoId ?? null,
      empresaId:        datosCertificado.empresaId,
      empresaNombre:    datosCertificado.empresaNombre,
      fechaEmision:     datosCertificado.fechaEmision,
      horas:            datosCertificado.horas,
      folio:            folio,
      fechaInicioCurso: datosCertificado.fechaInicio  || null,
      fechaTerminoCurso:datosCertificado.fechaTermino || null,
      lugarEjecucion:   datosCertificado.lugarEjecucion || '',
      condicion:        datosCertificado.condicion      || '',
    }

    const certificados = [
      ...certs.map(({ participante: p, codigo, estado: estCert }) => {
        const est = estCert || 'Aprobado'
        return {
          ...camposComunes,
          codigoCertificado:  codigo,
          nombreParticipante: p.nombre,
          rutParticipante:    p.rut,
          cargoParticipante:  p.cargo || '',
          fechaVencimiento:   est === 'Reprobado' ? '' : datosCertificado.fechaFinValidez,
          asistencia:         p.asistencia,
          evaluacion:         p.evaluacion,
          estado:             est,
        }
      }),
      ...reprobados.map(p => ({
        ...camposComunes,
        codigoCertificado:  genCodigoCert(),
        nombreParticipante: p.nombre,
        rutParticipante:    p.rut,
        cargoParticipante:  p.cargo || '',
        fechaVencimiento:   '',
        asistencia:         p.asistencia,
        evaluacion:         p.evaluacion,
        estado:             'Reprobado',
      })),
    ]

    // Filtrar personas que aún no existen en la BD (lookup O(1))
    const todosParticipantes = [
      ...certs.map(({ participante: p }) => p),
      ...reprobados,
    ]
    const personasNuevas = todosParticipantes
      .filter(p => {
        const tieneRut    = p.rut    && rutSet.has(p.rut)
        const tieneNombre = p.nombre && nombreSet.has(p.nombre.toLowerCase())
        return !tieneRut && !tieneNombre
      })
      .map(p => ({
        nombre:    p.nombre,
        rut:       p.rut,
        email:     p.email || '',
        empresa:   datosCertificado.empresaNombre,
        empresaId: datosCertificado.empresaId,
      }))

    // Una sola llamada al servidor: inserta certs + personas + actualiza contador
    await apiFetch('certificados.php?action=bulk_crear', {
      method: 'POST',
      body:   JSON.stringify({
        certificados,
        personasNuevas,
        cursoId:           camposComunes.cursoId,
        cantidadAprobados: certs.filter(c => (c.estado || 'Aprobado') === 'Aprobado').length,
      }),
    })

    // Refrescar personas para que sus certificados embebidos queden actualizados
    await dbPersonas.refrescar()
  }

  // Refresca todas las entidades en paralelo. Se usa en el auto-refresh y el botón manual.
  // El Ref evita que el useEffect de auto-refresh capture una versión stale de esta función.
  const _refrescarRef = useRef(null)
  _refrescarRef.current = async () => {
    setSincronizando(true)
    try {
      await Promise.all([
        dbEmpresas.refrescar(), dbPersonas.refrescar(),
        dbCursos.refrescar(), dbUsuarios.refrescar(), dbPlantillas.refrescar(),
        dbLotes.refrescar(), dbRoles.refrescar(),
      ])
    } finally {
      setSincronizando(false)
    }
  }
  const refrescarTodo = useCallback(() => _refrescarRef.current(), [])

  // Refresca al volver al tab (para capturar cambios hechos en otra pestaña o dispositivo)
  // y también cada 30 segundos mientras la app está activa.
  useEffect(() => {
    if (!autenticado) return

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refrescarTodo()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const interval = setInterval(refrescarTodo, 30 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(interval)
    }
  }, [autenticado, refrescarTodo])

  /* ── Sesión ───────────────────────────────────────────────────────────── */
  const setSesion = (valor) => setSesionRaw(valor)

  const cerrarSesion = () => {
    setSesionRaw(null)
    removeToken()
  }

  return (
    <AppContext.Provider value={{
      sesion, setSesion, cerrarSesion, cargandoSesion,
      sincronizando, refrescarTodo, iniciarSesion,
      dbEmpresas, dbPersonas, dbCertificados, dbCursos, dbUsuarios, dbPlantillas,
      empresas, personas, certificados, cursos, usuarios, plantillas,
      lotesCertificados,
      crearEmpresa, editarEmpresa, eliminarEmpresa, eliminarEmpresas,
      crearCurso, editarCurso, eliminarCurso, eliminarCursos,
      eliminarPersona, eliminarPersonas,
      crearPlantilla, editarPlantilla, editarVariasPlantillas, eliminarPlantilla,
      crearLote, editarLote, eliminarLote,
      editarCertificado, eliminarCertificado,
      crearUsuario, editarUsuario, eliminarUsuario, actualizarUltimoAcceso,
      registrarCertificados,
      rolesPersonalizados, todosLosRoles,
      crearRol, editarRol, eliminarRol,
      backupPendiente, setBackupPendiente,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
