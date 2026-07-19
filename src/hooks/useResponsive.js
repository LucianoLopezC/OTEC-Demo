import { useState, useEffect } from 'react'

// Escucha el ancho de la ventana y expone breakpoints listos para usar.
// passive: true en el listener evita bloquear el scroll en móviles.
export function useResponsive() {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler, { passive: true })
    return () => window.removeEventListener('resize', handler)
  }, [])

  return {
    width,
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isSmall:   width < 1024,
  }
}
