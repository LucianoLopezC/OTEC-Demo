import { jsPDF } from 'jspdf'

import { brand } from '../../config/brand'
import { calcularEstado } from './utils'

// Genera PDFs de certificados. Si hay plantilla HTML (editor WYSIWYG) usa html2canvas
// para capturar el HTML pixel-perfect. Si no, dibuja el PDF con jsPDF directamente.

// Reemplaza todos los {{CLAVE}} del HTML de la plantilla con los valores del participante.
function reemplazarVariables(html, variables) {
  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value ?? ''),
    html
  )
}

// ── Layout constants ──────────────────────────────────────────────
const PW = 210
const PH = 297
const ML = 18          // margin left (after lateral strip)
const MR = 12          // margin right
const MT = 14          // margin top
const CW = PW - ML - MR  // usable content width ≈ 180 mm
const PIE_LIMIT = PH - 30 // y limit before footer area

// ── Color palette ─────────────────────────────────────────────────
const NEGRO      = [0, 0, 0]
const AZUL       = [0, 112, 192]
const GRIS       = [100, 100, 100]
const GRIS_CLARO = [160, 160, 160]
const LATERAL_C  = [80, 80, 80]

// ── Main exports ──────────────────────────────────────────────────

// When plantillaHtml is provided, use html2pdf.js (WYSIWYG template path).
// Otherwise, fall back to the built-in jsPDF renderer.
export async function generarPDF(participante, datos, codigoCertificado, plantillaHtml) {
  if (plantillaHtml) {
    return generarPDFDesdeHtml(participante, datos, codigoCertificado, plantillaHtml)
  }
  return generarPDFJsPDF(participante, datos, codigoCertificado)
}

// Renderiza el DOCX con el siguiente enfoque híbrido:
//   1. Extrae imágenes y texto del footer directamente del ZIP del DOCX.
//   2. Renderiza solo el cuerpo (sin header/footer) con docx-preview + html2canvas.
//   3. Compone el PDF final en jsPDF: watermark → cuerpo → borde → logo → footer.
// Esto evita los problemas de stacking-context, z-index y ptab de docx-preview.
export async function generarPDFDesdeDocx(docxBlob) {
  const [{ renderAsync }, { default: html2canvas }] = await Promise.all([
    import('docx-preview'),
    import('html2canvas'),
  ])

  // ── 1. Extraer assets del DOCX ────────────────────────────────────────
  const { watermarkDataUrl, logoDataUrl, footerSegs } = await extraerAsetsDocx(docxBlob)

  // Pre-aplicar opacidad al watermark en un canvas (más compatible que GState jsPDF)
  const watermarkFaded = watermarkDataUrl
    ? await aplicarOpacidad(watermarkDataUrl, 0.07)
    : null

  // ── 2. Renderizar cuerpo con docx-preview ─────────────────────────────
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;top:0;left:-9999px;width:816px;background:#fff;pointer-events:none;'
  document.body.appendChild(host)

  try {
    await renderAsync(docxBlob, host, null, {
      inWrapper: true, ignoreWidth: false, ignoreHeight: false,
      ignoreFonts: false, useBase64URL: true, breakPages: true,
    })

    await Promise.all([...host.querySelectorAll('img')].map(img =>
      img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
    ))

    let sections = [...host.querySelectorAll('.docx-wrapper > section')]
    if (!sections.length) sections = [...host.querySelectorAll('section')]
    if (!sections.length) throw new Error('No se encontraron páginas en el documento')

    // El DOCX es tamaño Carta (8.5"×11" = 215.9mm×279.4mm)
    const pdf  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const pdfW = 215.9
    const pdfH = 279.4
    const bM   = 8.5   // margen del borde (#156082) desde el borde del papel

    for (let i = 0; i < sections.length; i++) {
      if (i > 0) pdf.addPage()
      const section = sections[i]

      // Ocultar header y footer — capturar solo el artículo en su posición original
      const ocultos = [...section.querySelectorAll('header, footer')]
      ocultos.forEach(el => { el.style.visibility = 'hidden' })
      await new Promise(r => setTimeout(r, 50))

      const sc = 2
      const secCanvas = await html2canvas(section, {
        scale: sc, useCORS: true, allowTaint: false,
        backgroundColor: '#ffffff', scrollX: 0, scrollY: 0,
        logging: false, imageTimeout: 15_000,
      })
      ocultos.forEach(el => { el.style.visibility = '' })

      // ── 3. Componer página ────────────────────────────────────────────

      // a) Fondo blanco
      pdf.setFillColor(255, 255, 255)
      pdf.rect(0, 0, pdfW, pdfH, 'F')

      // b) Watermark centrado y muy difuminado (imagen cuadrada de 500×500 px)
      if (watermarkFaded) {
        const wmSize = pdfW * 0.88          // ≈ 190mm, cubre bien la página
        const wmX    = (pdfW - wmSize) / 2
        const wmY    = (pdfH - wmSize) / 2
        pdf.addImage(watermarkFaded, 'PNG', wmX, wmY, wmSize, wmSize)
      }

      // c) Cuerpo del documento (márgenes conservados por docx-preview)
      //    La sección capturada es 816×1056 px (Carta a 96dpi) → ratio = 1.294
      const ratio = secCanvas.height / secCanvas.width
      pdf.addImage(
        secCanvas.toDataURL('image/jpeg', 0.85),
        'JPEG', 0, 0, pdfW, pdfW * ratio,
      )

      // d) Borde de página en teal #156082 (encima del contenido para que sea visible)
      pdf.setDrawColor(0x15, 0x60, 0x82)
      pdf.setLineWidth(0.35)
      pdf.rect(bM, bM, pdfW - bM * 2, pdfH - bM * 2)

      // e) Logo del header (esquina superior izquierda, sobre el borde)
      //    Imagen 500×500 px (1:1). El DOCX la muestra a ~60mm de alto → usar 60mm.
      if (logoDataUrl) {
        await colocarLogo(pdf, logoDataUrl, 10, 0, 60)
      }

      // f) Footer en tres columnas, bold, color #156082
      const footerY = pdfH - 9
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(0x15, 0x60, 0x82)
      pdf.text(footerSegs.left   || brand.website.toUpperCase(), bM + 2,        footerY)
      pdf.text(footerSegs.center || brand.email.toUpperCase(),   pdfW / 2,      footerY, { align: 'center' })
      pdf.text(footerSegs.right  || brand.phone,                 pdfW - bM - 2, footerY, { align: 'right' })
    }

    return pdf.output('arraybuffer')
  } finally {
    document.body.removeChild(host)
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Extrae del ZIP del DOCX: watermark (image1.jpeg / rId1), logo (image2.png / rId2)
// y los segmentos del footer (izquierda, centro, derecha).
async function extraerAsetsDocx(docxBlob) {
  try {
    const { default: PizZip } = await import('pizzip')
    const buffer = await docxBlob.arrayBuffer()
    const zip    = new PizZip(buffer.slice(0))

    // Parsear rels: usa zip.file() (método) en lugar de zip.files[] (objeto plano)
    const parseRels = (xmlStr) => {
      const map = {}
      const re  = /Id="([^"]+)"[^>]*?Target="([^"]+)"/g
      let m
      while ((m = re.exec(xmlStr)) !== null) {
        map[m[1]] = m[2].replace(/^.*\//, '')  // solo nombre del archivo
      }
      return map
    }

    const h2Rels = parseRels(zip.file('word/_rels/header2.xml.rels')?.asText() || '')
    const h2Xml  = zip.file('word/header2.xml')?.asText() || ''

    // Watermark VML: el atributo gain= identifica la imagen de fondo
    const wmRId = h2Xml.match(/r:id="([^"]+)"[^>]*gain=/)?.[1] ?? 'rId1'
    // Logo DrawingML: r:embed=
    const loRId = h2Xml.match(/r:embed="([^"]+)"/)?.[1] ?? 'rId2'

    // FileReader es el método más fiable para convertir binario → data URL en el browser
    const toDataUrl = (rId, fallback) => new Promise((resolve) => {
      try {
        const filename = h2Rels[rId] || fallback
        if (!filename) return resolve(null)
        const entry = zip.file(`word/media/${filename}`)
        if (!entry) return resolve(null)
        const ext    = filename.split('.').pop().toLowerCase()
        const mime   = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`
        const blob   = new Blob([entry.asArrayBuffer()], { type: mime })
        const reader = new FileReader()
        reader.onload  = (e) => resolve(e.target.result)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      } catch (e) {
        console.warn('[extraerAsetsDocx]', e)
        resolve(null)
      }
    })

    const footerXml = zip.file('word/footer1.xml')?.asText() || ''

    return {
      watermarkDataUrl: await toDataUrl(wmRId, 'image1.jpeg'),
      logoDataUrl:      await toDataUrl(loRId, 'image2.png'),
      footerSegs:       parsearFooterXml(footerXml),
    }
  } catch (e) {
    console.error('[extraerAsetsDocx] fallo:', e)
    return { watermarkDataUrl: null, logoDataUrl: null, footerSegs: { left: '', center: '', right: '' } }
  }
}

// Divide el footer XML en tres segmentos (izquierda, centro, derecha) por <w:ptab>.
function parsearFooterXml(xml) {
  if (!xml) return { left: '', center: '', right: '' }
  const segs = ['']
  const re   = /<w:t(?:[^>]*)>([^<]*)<\/w:t>|<w:ptab[^/]*\/>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    if (m[0].startsWith('<w:ptab')) {
      segs.push('')
    } else {
      segs[segs.length - 1] += m[1]
    }
  }
  return {
    left:   segs[0]?.trim() || '',
    center: segs[1]?.trim() || '',
    right:  segs[2]?.trim() || '',
  }
}

// Aplica opacidad a una imagen mediante un canvas y devuelve PNG data URL.
function aplicarOpacidad(dataUrl, opacity) {
  return new Promise((resolve) => {
    const img   = new Image()
    img.onload  = () => {
      const c   = document.createElement('canvas')
      c.width   = img.naturalWidth  || 400
      c.height  = img.naturalHeight || 400
      const ctx = c.getContext('2d')
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.globalAlpha = opacity
      ctx.drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src     = dataUrl
  })
}

// Aplana una imagen (PNG con canal alfa) sobre fondo blanco a la opacidad dada
// y devuelve un JPEG. jsPDF reincrusta imágenes con transparencia casi sin
// comprimir (cerca del bitmap crudo); al aplanarlas sobre blanco y guardarlas
// como JPEG, el resultado visual es idéntico (el certificado ya es fondo
// blanco) pero el PDF final pesa una fracción de lo que pesaría con PNG+alfa.
function flattenSobreBlanco(dataUrl, opacity = 1) {
  return new Promise((resolve) => {
    const img  = new Image()
    img.onload = () => {
      const c   = document.createElement('canvas')
      c.width   = img.naturalWidth  || 1
      c.height  = img.naturalHeight || 1
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.globalAlpha = opacity
      ctx.drawImage(img, 0, 0)
      resolve(c.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => resolve(null)
    img.src     = dataUrl
  })
}

// Agrega el logo al PDF con altura fija, ancho calculado por aspect ratio real.
function colocarLogo(pdf, dataUrl, x, y, h) {
  return new Promise((resolve) => {
    const img  = new Image()
    img.onload = () => {
      const iw  = img.naturalWidth  || 1
      const ih  = img.naturalHeight || 1
      const w   = h * (iw / ih)        // mantiene aspect ratio del archivo real
      const fmt = dataUrl.includes('jpeg') || dataUrl.includes('jpg') ? 'JPEG' : 'PNG'
      pdf.addImage(dataUrl, fmt, x, y, w, h)
      resolve()
    }
    img.onerror = () => resolve()
    img.src     = dataUrl
  })
}

// Ruta WYSIWYG: renderiza el HTML de la plantilla en un div oculto,
// lo captura con html2canvas y lo convierte a PDF multipágina.
async function generarPDFDesdeHtml(participante, datos, codigoCertificado, plantillaHtml) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']
  let fechaLarga = datos.fechaEmision || ''
  if (datos.fechaEmision) {
    let d, m, a
    if (datos.fechaEmision.includes('-')) [a, m, d] = datos.fechaEmision.split('-')
    else [d, m, a] = datos.fechaEmision.split('/')
    fechaLarga = `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${a}`
  }
  const vigenciaAnios = datos.vigenciaMeses > 0
    ? Math.max(1, Math.round(datos.vigenciaMeses / 12))
    : 0

  const htmlConDatos = reemplazarVariables(plantillaHtml, {
    NOMBRE_PARTICIPANTE:   participante.nombre.toUpperCase(),
    RUT_PARTICIPANTE:      participante.rut,
    NOMBRE_EMPRESA:        datos.empresaNombre,
    FECHA_REALIZACION:     fechaLarga,
    NOMBRE_CURSO:          datos.cursoNombre,
    HORAS_CURSO:           `${datos.horas} horas`,
    MODALIDAD_CURSO:       datos.modalidad || 'teórico-práctico',
    CONDICION_CURSO:       (datos.condicion || '').toLowerCase(),
    ASISTENCIA:            `${participante.asistencia}%`,
    EVALUACION:            `${participante.evaluacion}%`,
    ESTADO_TEXTO:          participante.estado || 'Aprobado',
    VIGENCIA_AÑOS:         vigenciaAnios > 0
      ? `${vigenciaAnios} ${vigenciaAnios === 1 ? 'año' : 'años'}`
      : 'Sin vencimiento',
    CODIGO_SENCE:          datos.codigoSence || 'NO-APLICA',
    LUGAR_EJECUCION:       datos.lugarEjecucion || brand.city,
    FECHA_EMISION:         datos.fechaEmision || '',
    FECHA_VENCIMIENTO:     datos.fechaFinValidez || '',
    CODIGO_CERTIFICADO:    codigoCertificado,
    CONTENIDOS_CURSO:      generarHtmlContenidos(datos.contenidos),
    TEXTO_VALIDEZ_EMPRESA: `El presente certificado es válido solo para uso de ${datos.empresaNombre}; queda inválido para ser usado por otra empresa.`,
    QR_VERIFICACION:       `<p style="font-size:8pt;color:#555;margin-top:10px;">Código de verificación: <strong>${codigoCertificado}</strong></p>`,
  })

  /* ── 1. CSS en <head> — crítico para que html2canvas compute
          getComputedStyle() y posiciones absolutas correctamente ── */
  const STYLE_ID = '__otec_demo_cert_export__'
  const styleEl  = document.createElement('style')
  styleEl.id     = STYLE_ID
  styleEl.textContent = `
    .__certA4__ {
      width:794px; min-height:1123px; background:#fff;
      padding:60px 72px; box-sizing:border-box;
      font-family:Arial,sans-serif; font-size:11pt;
      color:#000; line-height:1.5;
    }
    .__certA4__ p  { margin:0 0 8px; }
    .__certA4__ h1 { font-size:16pt;font-weight:900;margin:0 0 8px;line-height:1.15; }
    .__certA4__ h2 { font-size:14pt;font-weight:700;margin:0 0 10px; }
    .__certA4__ h3 { font-size:12pt;font-weight:700;margin:0 0 8px; }
    .__certA4__ ul, .__certA4__ ol { padding-left:20px; margin:0 0 8px; }
    .__certA4__ li  { margin-bottom:2px; }
    .__certA4__ hr  { border:none; border-top:1.5px solid #0070C0; margin:24px 0 8px; }
    .__certA4__ table { border-collapse:collapse; width:100%; }
    .__certA4__ td, .__certA4__ th { border:none; padding:0; vertical-align:top; }
    .__certA4__ img { display:inline-block; vertical-align:middle; max-width:100%; height:auto; }
    .__certA4__ img[data-mode="free"]        { display:block; position:absolute; max-width:none; }
    .__certA4__ img[data-mode="float-left"]  { display:block; float:left;  margin:0 16px 8px 0; max-width:none; }
    .__certA4__ img[data-mode="float-right"] { display:block; float:right; margin:0 0 8px 16px; max-width:none; }
    .__certA4__ .variable-tag { font-weight:normal; }
    .__certA4__ [data-indent="1"]  { margin-left: 40px }
    .__certA4__ [data-indent="2"]  { margin-left: 80px }
    .__certA4__ [data-indent="3"]  { margin-left:120px }
    .__certA4__ [data-indent="4"]  { margin-left:160px }
    .__certA4__ [data-indent="5"]  { margin-left:200px }
    .__certA4__ [data-indent="6"]  { margin-left:240px }
    .__certA4__ [data-indent="7"]  { margin-left:280px }
    .__certA4__ [data-indent="8"]  { margin-left:320px }
    .__certA4__ [data-indent="9"]  { margin-left:360px }
    .__certA4__ [data-indent="10"] { margin-left:400px }
  `
  document.head.appendChild(styleEl)

  /* ── 2. Contenedor visible-para-layout (opacity:0) en posición (0,0)
          NO usar visibility:hidden ni off-screen — rompen los absolutepositions en html2canvas ── */
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:absolute;top:0;left:0;width:794px;opacity:0;pointer-events:none;z-index:-999;'

  const a4 = document.createElement('div')
  a4.className = '__certA4__'

  const inner = document.createElement('div')
  inner.style.cssText = 'position:relative; min-height:1003px;'
  inner.innerHTML = htmlConDatos

  a4.appendChild(inner)
  wrap.appendChild(a4)
  document.body.appendChild(wrap)

  /* ── 3. Pre-cargar imágenes como base64 ── */
  const imgEls = [...a4.querySelectorAll('img')]
  await Promise.all(imgEls.map(async (img) => {
    const url = img.getAttribute('src') || ''
    if (!url || url.startsWith('data:')) return
    try {
      const res  = await fetch(url, { mode: 'cors' })
      const blob = await res.blob()
      const b64  = await new Promise((ok) => {
        const r = new FileReader()
        r.onloadend = () => ok(r.result)
        r.readAsDataURL(blob)
      })
      await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = b64 })
    } catch { /* continuar con URL original */ }
  }))

  /* ── 4. Captura pixel-perfect ── */
  const canvas = await html2canvas(a4, {
    scale:           2,
    useCORS:         true,
    allowTaint:      false,
    backgroundColor: '#ffffff',
    width:           794,
    height:          a4.scrollHeight,
    windowWidth:     794,
    windowHeight:    a4.scrollHeight,
    scrollX:         0,
    scrollY:         0,
    logging:         false,
  })

  /* ── 5. Limpieza ── */
  document.body.removeChild(wrap)
  document.head.removeChild(styleEl)

  /* ── 6. Convertir canvas a PDF multipágina ── */
  const pdf        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pdfW       = 210
  const pdfH       = 297
  const pageHpx    = 1123 * 2
  const totalPages = Math.ceil(canvas.height / pageHpx)

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage()
    const srcY    = i * pageHpx
    const srcH    = Math.min(pageHpx, canvas.height - srcY)
    const pCanvas = document.createElement('canvas')
    pCanvas.width  = canvas.width
    pCanvas.height = srcH
    const ctx = pCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, srcH)
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
    const imgData = pCanvas.toDataURL('image/jpeg', 0.85)
    const imgH    = Math.min((srcH / canvas.width) * pdfW, pdfH)
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, imgH)
  }

  return pdf.output('arraybuffer')
}

function generarHtmlContenidos(contenidos) {
  if (!contenidos) return ''
  const modulos = parsearContenidos(contenidos)
  // font-size:11pt explícito en cada elemento para evitar que herede
  // el tamaño de un posible ancestro h1/h2 en el template del usuario.
  return modulos.map(m => `
    <p style="font-size:11pt;font-weight:bold;margin:12px 0 4px;">${m.titulo}</p>
    <ul style="font-size:11pt;margin:0 0 8px;padding-left:20px;">
      ${m.items.map(item => `<li style="margin-bottom:2px;">${item}</li>`).join('')}
    </ul>
  `).join('')
}

// Ruta de respaldo: dibuja el certificado con jsPDF puro.
// Se usa cuando no hay plantilla HTML asignada al curso.
async function generarPDFJsPDF(participante, datos, codigoCertificado) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Page 1: lateral strip + logo ─────────────────────────────
  drawLateral(doc)
  drawLogo(doc)

  // Title
  let y = MT + 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  doc.setTextColor(...NEGRO)
  doc.text('CERTIFICADO', ML, y)
  y += 20

  // Intro paragraph with inline bold
  y = drawIntro(doc, participante, datos, y)
  y += 4

  // Module content — may add continuation pages
  y = drawModulos(doc, datos.contenidos, y)

  // ── Pie de contenidos: separador + condiciones + aviso ────────────────────
  if (y + 8 > PIE_LIMIT) { addContinuationPage(doc); y = MT + 18 }
  y += 4

  // Línea separadora corta
  doc.setDrawColor(...NEGRO)
  doc.setLineWidth(0.2)
  doc.line(ML, y, ML + 60, y)
  y += 4

  // Condiciones de aprobacion: template fijo con % editables desde Paso 1
  const pAsist = datos.porcentajeAsistencia ?? 75
  const pAprob = datos.porcentajeAprobacion ?? 60
  const condText = `La Calificacion va de 1,0 a 7,0; siendo el ${pAprob}% la nota minima de Aprobacion y un ${pAsist}% de Asistencia.`

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...NEGRO)
  const condLines = doc.splitTextToSize(condText, CW - 4)
  condLines.forEach((line, li) => {
    if (y + 5 > PIE_LIMIT) { addContinuationPage(doc); y = MT + 18 }
    if (li === 0) {
      doc.setFontSize(5.5)
      doc.text('1', ML, y - 1.5)
      doc.setFontSize(7)
      doc.text(line, ML + 3, y)
    } else {
      doc.text(line, ML + 3, y)
    }
    y += 4.5
  })

  // Aviso de uso exclusivo
  const aviso = `El presente certificado es valido solo para uso de ${datos.empresaNombre || 'la empresa'}; queda invalido para ser usado por otra empresa`
  if (y + 5 > PIE_LIMIT) { addContinuationPage(doc); y = MT + 18 }
  y += 2
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(...NEGRO)
  doc.splitTextToSize(aviso, CW).forEach(line => {
    if (y + 5 > PIE_LIMIT) { addContinuationPage(doc); y = MT + 18 }
    doc.text(line, ML, y)
    y += 4.5
  })

  // Add footer to every page (simple on intermediate, full on last)
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    if (p < total) {
      drawFooterSimple(doc)
    } else {
      drawFooter(doc, datos.empresaNombre, codigoCertificado)
    }
  }

  return doc.output('arraybuffer')
}

// ── Lateral rotated text ──────────────────────────────────────────

function drawLateral(doc) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(...LATERAL_C)
  doc.text(
    'Documentos con Validez Legal Ley N° 19.799. Certificado por E-Sign S.A.',
    7, PH - 18,
    { angle: 90, align: 'right' }
  )
  // Small green block as leaf-icon placeholder
  doc.setFillColor(34, 139, 34)
  doc.roundedRect(4, PH - 60, 6, 9, 1, 1, 'F')
}

// ── Logo (top-right corner) ─────────────────────────────────

function drawLogo(doc) {
  const lx = PW - MR - 38
  const ly = MT
  const lw = 36
  const lh = 16

  // Black rounded box
  doc.setFillColor(20, 20, 20)
  doc.roundedRect(lx, ly, lw, lh, 3, 3, 'F')

  // Left green dot
  doc.setFillColor(80, 180, 80)
  doc.circle(lx + 4.5, ly + 6.5, 1.8, 'F')

  // brand name in white
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(brand.name.toLowerCase(), lx + 8, ly + 8)

  // Right green dot
  doc.setFillColor(80, 180, 80)
  doc.circle(lx + lw - 4.5, ly + 6.5, 1.8, 'F')

  // Internal divider
  doc.setDrawColor(60, 60, 60)
  doc.setLineWidth(0.2)
  doc.line(lx + 2, ly + 9.5, lx + lw - 2, ly + 9.5)

  // "capacitación" in light grey
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(180, 180, 180)
  doc.text('capacitación', lx + lw / 2, ly + 13.5, { align: 'center' })
}

// ── Intro paragraph ───────────────────────────────────────────────

function drawIntro(doc, participante, datos, yStart) {
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']
  const ciudad = datos.lugarEjecucion || brand.city

  let mesTexto = 'la fecha indicada'
  let anio = ''
  let fechaLarga = ''

  if (datos.fechaEmision) {
    let d, m, a
    if (datos.fechaEmision.includes('-')) [a, m, d] = datos.fechaEmision.split('-')
    else [d, m, a] = datos.fechaEmision.split('/')
    mesTexto = meses[parseInt(m) - 1] || 'la fecha indicada'
    anio = a
    fechaLarga = `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${a}`
  }

  // Compute vigencia label
  let vigenciaLabel = 'Sin vencimiento'
  if (datos.vigenciaMeses > 0) {
    const v = Math.max(1, Math.round(datos.vigenciaMeses / 12))
    vigenciaLabel = `${v} ${v === 1 ? 'año' : 'años'}`
  } else if (datos.vigenciaMeses !== 0 && datos.fechaFinValidez && datos.fechaEmision) {
    const toYM = (f) => {
      let y, mo
      if (f.includes('-')) [y, mo] = f.split('-')
      else { const p = f.split('/'); [y, mo] = [p[2], p[1]] }
      return parseInt(y) * 12 + parseInt(mo)
    }
    const diff = toYM(datos.fechaFinValidez) - toYM(datos.fechaEmision)
    const v = Math.max(1, Math.round(diff / 12))
    vigenciaLabel = `${v} ${v === 1 ? 'año' : 'años'}`
  }

  // Respeta el estado guardado en BD; solo calcula si no viene explícito
  const estadoFinal = participante.estado || calcularEstado(participante.asistencia, participante.evaluacion)
  const estadoTexto = `${participante.evaluacion}% ${estadoFinal}`

  // Segmented text: [text, isBold]
  const segs = [
    [`En ${ciudad}, ${mesTexto} de ${anio}, se extiende el presente Certificado a don (ña) `, false],
    [participante.nombre, true],
    [', Cédula de Identidad Nacional N° ', false],
    [participante.rut, true],
    [', perteneciente a la empresa ', false],
    [datos.empresaNombre, true],
    [`, quien el `, false],
    [fechaLarga, true],
    [' ha realizado el curso ', false],
    [datos.cursoNombre, true],
    [', con una duración de ', false],
    [`${datos.horas}`, true],
    [' horas cronológicas (', false],
    [(datos.condicion || '').toLowerCase(), true],
    ['), asistiendo el ', false],
    [`${participante.asistencia}%`, true],
    [', y como Situación Final: ', false],
    [estadoTexto, true],
    [`, y cuyos temas tratados son los siguientes (Vigencia: ${vigenciaLabel} desde la aprobación):`, false],
  ]

  return drawSegmentedParagraph(doc, segs, ML, yStart, CW, 10, 5.2)
}

// ── Segmented paragraph renderer (inline bold) ────────────────────
// segs: Array of [text, isBold]

function drawSegmentedParagraph(doc, segs, x, y, maxWidth, fontSize, lineH) {
  doc.setFontSize(fontSize)

  // Flatten to words with bold flags
  const words = []
  segs.forEach(([text, bold]) => {
    text.split(/(\s+)/).forEach(part => { if (part) words.push({ t: part, bold }) })
  })

  const getW = (t, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(fontSize)
    return doc.getTextWidth(t)
  }

  // Word-wrap
  const lines = []
  let cur = []
  let curW = 0
  words.forEach(w => {
    const ww = getW(w.t, w.bold)
    if (curW + ww > maxWidth && cur.length > 0) {
      lines.push([...cur])
      cur = [{ ...w, ww }]
      curW = ww
    } else {
      cur.push({ ...w, ww })
      curW += ww
    }
  })
  if (cur.length > 0) lines.push(cur)

  // Render each line
  doc.setTextColor(...NEGRO)
  lines.forEach(line => {
    let xc = x
    line.forEach(({ t, bold, ww }) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(fontSize)
      doc.text(t, xc, y)
      xc += ww ?? getW(t, bold)
    })
    y += lineH
  })

  return y
}

// ── Module / content renderer ─────────────────────────────────────

function drawModulos(doc, contenidos, yStart) {
  if (!contenidos) return yStart
  let y = yStart
  const modulos = parsearContenidos(contenidos)

  modulos.forEach(modulo => {
    // Medir título y todos los ítems ANTES de dibujar nada, para no partir el
    // módulo entre páginas. Si el módulo completo entra en una página, exigir
    // que entre entero; si es más largo que una página completa, exigir al
    // menos título + primer ítem (para no forzar saltos de página excesivos).
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const titleLines = doc.splitTextToSize(modulo.titulo, CW)
    const titleHeight = titleLines.length * 5 + 1

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const itemHeights = modulo.items.map(item => doc.splitTextToSize(item, CW - 8).length * 4.8 + 0.5)
    const moduloHeight = titleHeight + itemHeights.reduce((s, h) => s + h, 0)
    const alturaPagina = PIE_LIMIT - (MT + 18)
    const alturaMinima = moduloHeight <= alturaPagina ? moduloHeight : titleHeight + (itemHeights[0] || 0)

    if (y + alturaMinima > PIE_LIMIT) {
      addContinuationPage(doc)
      y = MT + 18
    }

    // Module title — bold
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...NEGRO)
    titleLines.forEach(line => {
      doc.text(line, ML, y)
      y += 5
    })
    y += 1

    // Bullet items
    modulo.items.forEach(item => {
      if (y + 6 > PIE_LIMIT) {
        addContinuationPage(doc)
        y = MT + 18
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(...NEGRO)
      doc.text('•', ML + 2, y)
      const itemLines = doc.splitTextToSize(item, CW - 8)
      itemLines.forEach((line, i) => {
        doc.text(line, ML + 7, y + i * 4.8)
      })
      y += itemLines.length * 4.8 + 0.5
    })

    y += 3
  })

  return y
}

function addContinuationPage(doc) {
  doc.addPage()
  drawLateral(doc)
  drawLogo(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...NEGRO)
  doc.text('CERTIFICADO', ML, MT + 10)
}

// Convierte el texto de contenidos (guardado como texto plano con saltos de línea)
// a un array estructurado [{titulo, items}] para renderizarlo con bullets.
// Convierte el texto de contenidos a un array [{titulo, items}] para PDF.
function parsearContenidos(contenidos) {
  if (!contenidos) return []
  if (Array.isArray(contenidos)) return contenidos

  // 1. Convertir <br> a saltos de linea y eliminar HTML/entidades
  let texto = contenidos
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')

  // 2. Eliminar TODOS los caracteres que no sean ASCII imprimible o Latin-1
  //    Esto limpia BOM, zero-width spaces, artefactos Word/PDF, etc.
  if (texto.normalize) texto = texto.normalize('NFC')
  texto = texto.replace(/[^\n\x20-\x7E\xC0-\xFF]/g, '')

  // 3. Colapsar espacios y lineas vacias extra
  texto = texto.replace(/[ \t]{2,}/g, ' ')
  texto = texto.replace(/\n{3,}/g, '\n\n')

    const BULLET = /^[\s\-*\xD0\xD8\xF0\xF8\xBA\xAA]+/

  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const modulos = []
  let actual = null

  lineas.forEach(linea => {
    const esTitulo = /^M[\xD3O]DULO\s*\d+:/i.test(linea) ||
                     /^\d+\s*:/.test(linea) ||
                     (linea === linea.toUpperCase() && linea.endsWith(':') && linea.length > 5)
    const esItem   = BULLET.test(linea)

    if (esTitulo) {
      actual = { titulo: linea, items: [] }
      modulos.push(actual)
    } else if (esItem) {
      if (!actual) { actual = { titulo: '', items: [] }; modulos.push(actual) }
      actual.items.push(linea.replace(BULLET, '').trim())
    } else {
      if (!actual) { actual = { titulo: linea, items: [] }; modulos.push(actual) }
      else actual.items.push(linea)
    }
  })

  return modulos
}
// ── Footer — full (last page) ─────────────────────────────────────

function drawFooter(doc, empresaNombre, codigo) {
  const yL = PH - 24

  // Blue separator line
  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.6)
  doc.line(ML, yL, PW - MR, yL)

  // Invalidity text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRIS)
  const txt = `El presente certificado es válido solo para uso de ${empresaNombre}; queda inválido para ser usado por otra empresa.`
  const txtLines = doc.splitTextToSize(txt, CW)
  txtLines.forEach((l, i) => doc.text(l, ML, yL + 5 + i * 4))

  // Contact
  doc.text(brand.contactLine, ML, yL + 5 + txtLines.length * 4 + 2)

  // Verification code
  doc.setFontSize(7)
  doc.setTextColor(...GRIS)
  doc.text(`Código de verificación: ${codigo}`, PW - MR, yL + 5 + txtLines.length * 4 + 6, { align: 'right' })
}

// ── Footer — simple (intermediate pages) ─────────────────────────

function drawFooterSimple(doc) {
  const yL = PH - 18
  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.4)
  doc.line(ML, yL, PW - MR, yL)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRIS)
  doc.text(brand.contactLine, ML, yL + 5)
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANTILLA PROPIA — certificado estilo "Certificado Alumno" (ver más abajo).
// ══════════════════════════════════════════════════════════════════════════════

export async function generarPDFPropio(participante, datos, codigoCertificado) {
  return generarPDFCertificado(participante, datos, codigoCertificado)
}

// ══════════════════════════════════════════════════════════════════════════════
// Certificado estilo "Certificado Alumno" (Letter, párrafo+módulos+QR).
// Dibuja el certificado con texto vectorial real de jsPDF (sin rasterizar HTML
// con html2canvas): mismo diseño, pero el archivo pesa decenas de KB en vez de
// megabytes, porque el texto queda como texto de PDF y no como una imagen JPEG.
// ══════════════════════════════════════════════════════════════════════════════

// Devuelve las dimensiones naturales de una imagen (para calcular su aspect ratio).
function getImageSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
    img.onerror = () => resolve({ w: 1, h: 1 })
    img.src     = dataUrl
  })
}

async function generarPDFCertificado(participante, datos, codigoCertificado) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  const PW = 215.9, PH = 279.4
  const ML = 25, MR = 25, MT = 25
  const CW = PW - ML - MR
  const PIE_LIMIT = PH - 32

  const NEGRO = [0, 0, 0]

  // Logo (imagen ya pequeña — no infla el archivo como pasaba con la página entera)
  let logoData = null
  if (brand.logoFile) {
    try {
      const res  = await fetch(brand.logoFile)
      const blob = await res.blob()
      logoData = await new Promise((ok) => {
        const r = new FileReader()
        r.onloadend = () => ok(r.result)
        r.readAsDataURL(blob)
      })
    } catch { /* sin logo si falla la carga */ }
  }
  const logoDims = logoData ? await getImageSize(logoData) : null

  function dibujarEncabezado() {
    let y = MT
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(30)
    doc.setTextColor(...NEGRO)
    doc.text('CERTIFICADO', ML, y + 8)

    if (logoData && logoDims) {
      const lh  = 13
      const lw  = lh * (logoDims.w / logoDims.h)
      const fmt = /^data:image\/png/.test(logoData) ? 'PNG' : 'JPEG'
      doc.addImage(logoData, fmt, PW - MR - lw, y - 4, lw, lh)
    }

    y += 12
    doc.setDrawColor(34, 34, 34)
    doc.setLineWidth(0.5)
    doc.line(ML, y, PW - MR, y)
    return y + 8
  }

  function nuevaPagina() {
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...NEGRO)
    doc.text('CERTIFICADO (continuación)', ML, MT + 6)
    doc.setDrawColor(34, 34, 34)
    doc.setLineWidth(0.3)
    doc.line(ML, MT + 9, PW - MR, MT + 9)
    return MT + 16
  }

  let y = dibujarEncabezado()

  // ── Párrafo introductorio ────────────────────────────────────────────────
  const meses = ['enero','febrero','marzo','abril','mayo','junio',
                 'julio','agosto','septiembre','octubre','noviembre','diciembre']

  const fmtFechaLarga = f => {
    if (!f) return ''
    try {
      let d, m, a
      if (String(f).includes('-')) [a, m, d] = String(f).split('-')
      else [d, m, a] = String(f).split('/')
      return `${parseInt(d)} de ${meses[parseInt(m) - 1] || ''} de ${a}`
    } catch { return String(f) }
  }

  const fmtVig = v => {
    const m = parseInt(v) || 0
    if (!m) return 'Sin vencimiento'
    if (m >= 12 && m % 12 === 0) { const a = m / 12; return `${a} ${a === 1 ? 'año' : 'años'}` }
    return `${m} ${m === 1 ? 'mes' : 'meses'}`
  }

  // Respeta el estado guardado en BD; solo calcula si no viene explícito
  const estado = participante.estado || calcularEstado(participante.asistencia, participante.evaluacion)
  const nota   = participante.evaluacion != null ? `${participante.evaluacion}% ` : ''
  const vig    = fmtVig(datos.vigenciaMeses)

  const fi = datos.fechaInicio || datos.fechaInicioCurso || ''
  const ft = datos.fechaTermino || datos.fechaTerminoCurso || ''
  let fechaCurso = ''
  if (fi && ft && fi !== ft) fechaCurso = `${fmtFechaLarga(fi)} al ${fmtFechaLarga(ft)}`
  else if (fi) fechaCurso = fmtFechaLarga(fi)
  else fechaCurso = fmtFechaLarga(datos.fechaEmision)

  const lugar = datos.lugarEjecucion || brand.city
  const segs = [
    [`En ${lugar}, `, false],
    [fmtFechaLarga(datos.fechaEmision), true],
    [', se extiende el presente Certificado a don (ña) ', false],
    [participante.nombre, true],
    [', Cédula de Identidad Nacional N° ', false],
    [participante.rut, true],
    [', perteneciente a la empresa ', false],
    [datos.empresaNombre, true],
    [', quien el ', false],
    [fechaCurso, true],
    [' ha realizado el curso ', false],
    [datos.cursoNombre, true],
    [', con una duración de ', false],
    [`${datos.horas}`, true],
    [` horas cronológicas (${datos.modalidad || 'teórico-práctico'}), asistiendo el `, false],
    [`${participante.asistencia}%`, true],
    [', y como Situación Final: ', false],
    [`${nota}${estado}`, true],
    [`, y cuyos temas tratados son los siguientes${vig ? ` (duración: ${vig})` : ''}:`, false],
  ]

  y = drawSegmentedParagraph(doc, segs, ML, y, CW, 11, 5.3)
  y += 4

  // ── Contenidos del curso (módulos + ítems) ───────────────────────────────
  const modulos = parsearContenidos(datos.contenidos)
  modulos.forEach(modulo => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const tituloTexto = modulo.titulo.toUpperCase()
    const titleLines  = doc.splitTextToSize(tituloTexto, CW)
    const titleHeight = titleLines.length * 5 + 1

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const itemHeights  = modulo.items.map(item => doc.splitTextToSize(item, CW - 8).length * 5 + 0.5)
    const moduloHeight = titleHeight + itemHeights.reduce((s, h) => s + h, 0)
    const alturaPagina = PIE_LIMIT - (MT + 16)
    const alturaMinima = moduloHeight <= alturaPagina ? moduloHeight : titleHeight + (itemHeights[0] || 0)

    if (y + alturaMinima > PIE_LIMIT) y = nuevaPagina()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...NEGRO)
    titleLines.forEach(line => {
      doc.text(line, ML, y)
      doc.setLineWidth(0.3)
      doc.line(ML, y + 0.8, ML + doc.getTextWidth(line), y + 0.8)
      y += 5
    })
    y += 1

    modulo.items.forEach(item => {
      if (y + 6 > PIE_LIMIT) y = nuevaPagina()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...NEGRO)
      doc.text('•', ML + 2, y)
      const itemLines = doc.splitTextToSize(item, CW - 8)
      itemLines.forEach((line, i) => doc.text(line, ML + 7, y + i * 5))
      y += itemLines.length * 5 + 0.5
    })

    y += 3
  })

  // ── Código de verificación ────────────────────────────────────────────────
  if (y + 8 > PIE_LIMIT) y = nuevaPagina()
  y += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(68, 68, 68)
  doc.text('Código de verificación: ', ML, y)
  const cvW = doc.getTextWidth('Código de verificación: ')
  doc.setFont('helvetica', 'bold')
  doc.text(codigoCertificado || '', ML + cvW, y)
  y += 8

  // ── Pie: aviso de uso exclusivo + contacto ────────────────────────────────
  if (y + 20 > PIE_LIMIT) y = nuevaPagina()
  doc.setDrawColor(...NEGRO)
  doc.setLineWidth(0.35)
  doc.line(ML, y, PW - MR, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...NEGRO)
  const aviso = `El presente certificado es válido solo para uso de ${datos.empresaNombre}; queda inválido para ser usado por otra empresa.`
  doc.splitTextToSize(aviso, CW).forEach(line => { doc.text(line, ML, y); y += 4.2 })

  y += 1
  doc.text(brand.contactLine, ML, y)

  return doc.output('arraybuffer')
}
