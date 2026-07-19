// Configuración de marca: colores, contacto y favicon del sistema.
// La variable VITE_BRAND_NAME en el .env.local controla qué configuración se activa
// (permite tener varias marcas/tenants sobre el mismo código si se necesitara en el futuro).
// applyBrandTheme() inyecta los tokens CSS del tema en el <head> al arrancar la app.
const name = import.meta.env.VITE_BRAND_NAME || 'Demo'

const configs = {
  Demo: {
    name:        'OTEC Demo',
    fullName:    'OTEC Demo Capacitación',
    website:     'www.otec-demo.cl',
    email:       'contacto@otec-demo.cl',
    phone:       '+56 9 0000 0000',
    contactLine: 'Fono +56 9 0000 0000 – www.otec-demo.cl – contacto@otec-demo.cl',
    favicon:     '/favicon-demo.svg',
    // Usa la paleta por defecto de index.css (teal #14b4c9)
    theme: null,
    legalName:     'OTEC Demo SpA',
    slogan:        'Capacitación Profesional',
    rut:           '99.999.999-9',
    city:          'Santiago',
    certStandard:  'NCh2728:2015',
    footerEmail:   'contacto@otec-demo.cl',
    footerPhone:   '+56 9 0000 0000',
    logoFile:      '/assets/logo-demo.png',
    watermarkFile: null,
  },
}

export const brand = configs[name] ?? configs.Demo

export function applyBrandTheme() {
  if (brand.favicon) {
    const link = document.querySelector('link[rel="icon"]')
    if (link) link.href = brand.favicon
  }
  if (!brand.theme) return
  const toBlock = (selector, vars) =>
    `${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`
  let css = toBlock(':root', brand.theme)
  if (brand.darkTheme) css += '\n' + toBlock('html.dark', brand.darkTheme)
  const style = document.createElement('style')
  style.id = 'brand-theme'
  style.textContent = css
  document.head.appendChild(style)
}
