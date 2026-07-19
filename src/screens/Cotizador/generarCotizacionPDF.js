import jsPDF from 'jspdf'
import { brand } from '../../config/brand'

function fmtFechaCorta(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}-${m}-${y}`
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ── HTML template → html2canvas → jsPDF ──────────────────────────────────────

function fmtCLP(n) {
  return Math.round(n).toLocaleString('es-CL') + '.'
}

function buildCotizacionHTML({ empresa, items, numero, fecha, notas, logoSrc }) {
  const subtotal = items.reduce((s, i) => s + (Number(i.precio) || 0) * (i.cantidad || 1), 0)

  const itemsHtml = items.map(item => {
    const sub          = (Number(item.precio) || 0) * (item.cantidad || 1)
    const participantes = Array.isArray(item.participantes)
      ? item.participantes.filter(p => p.nombre?.trim())
      : []

    const partRows = participantes.map(p =>
      `<tr><td class="part-nombre">${escHtml(p.nombre)}</td><td class="part-rut">${escHtml(p.rut ?? '')}</td></tr>`
    ).join('')

    const partTable = participantes.length > 0
      ? `<table class="part-table"><tbody>${partRows}</tbody></table>`
      : ''

    return `<tr>
      <td class="col-cant">1</td>
      <td class="col-unid">${item.cantidad || 1}</td>
      <td>
        <div class="course-name">${escHtml(item.nombre)}</div>
        ${item.precio ? `<div class="val-persona">Valor por persona: $${fmtCLP(Number(item.precio))}</div>` : ''}
        ${partTable}
      </td>
      <td class="col-sub">${fmtCLP(sub)}</td>
    </tr>`
  }).join('\n')

  const urgenciaRow = `<div class="urgencia-row">
    Carácter de la solicitud: &nbsp;
    <span>Urgente &nbsp;<span class="chk"></span></span>
    &nbsp;&nbsp;&nbsp;
    <span>Normal &nbsp;<span class="chk"></span></span>
  </div>`

  const obsInner = notas?.trim()
    ? `<div style="padding:2mm 2mm 4mm;font-size:9pt;line-height:1.6;">${escHtml(notas.trim()).replace(/\n/g, '<br>')}</div>${urgenciaRow}`
    : `${urgenciaRow}
      <div class="obs-lines">
        <div class="obs-line"></div><div class="obs-line"></div>
        <div class="obs-line"></div><div class="obs-line"></div>
      </div>`

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; background: #fff; color: #111; }
  .page { width: 794px; min-height: 1123px; background: #fff; padding: 53px 53px 90px 53px; position: relative; }
  .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 2px solid #1a2e78; }
  .header-table td { border: 2px solid #1a2e78; vertical-align: middle; }
  .td-logo { width: 159px; padding: 11px 15px; text-align: center; vertical-align: middle; }
  .td-logo img { width: 144px; height: auto; display: block; margin: 0 auto; }
  .td-center-top { padding: 9px 15px; text-align: center; border-bottom: 2px solid #1a2e78; }
  .td-center-top .sys-title { font-size: 8pt; font-weight: bold; color: #1a2e78; text-transform: uppercase; letter-spacing: 0.3pt; line-height: 1.4; }
  .td-center-bottom { padding: 9px 15px; text-align: center; }
  .td-center-bottom .form-title { font-size: 12pt; font-weight: bold; color: #1a2e78; letter-spacing: 1pt; }
  .td-code { width: 144px; padding: 9px 15px; text-align: left; vertical-align: top; font-size: 8pt; line-height: 1.9; color: #1a2e78; }
  .td-code strong { font-size: 8.5pt; display: block; }
  .company-info { margin-bottom: 16px; line-height: 1.55; padding: 4px 0; }
  .company-info .co-name { font-weight: bold; font-size: 10pt; color: #1a2e78; text-transform: uppercase; }
  .company-info p { font-size: 9pt; color: #222; }
  .cot-title { text-align: center; font-size: 13pt; font-weight: bold; color: #1a2e78; letter-spacing: 1.5pt; text-transform: uppercase; margin: 12px 0 16px 0; }
  .client-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .client-table td { border: 1.5px solid #1a2e78; padding: 7px 11px; font-size: 9pt; vertical-align: middle; }
  .client-table .field-label { font-weight: bold; color: #1a2e78; }
  .intro-text { font-size: 9.5pt; margin-bottom: 10px; font-style: italic; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .items-table th { background-color: #1a2e78; color: #fff; text-align: center; padding: 8px 11px; font-size: 9.5pt; border: 1.5px solid #1a2e78; letter-spacing: 0.5pt; }
  .items-table td { border: 1.5px solid #1a2e78; padding: 8px 11px; vertical-align: top; font-size: 9pt; }
  .col-cant, .col-unid { text-align: center; width: 53px; vertical-align: middle; }
  .col-sub { text-align: right; width: 106px; white-space: nowrap; vertical-align: middle; font-size: 9pt; }
  .course-name { font-weight: bold; font-size: 9.5pt; text-decoration: underline; margin-bottom: 3px; }
  .val-persona { font-size: 9pt; margin-bottom: 4px; }
  .part-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
  .part-table td { padding: 1px 4px; border: none; font-size: 8.5pt; }
  .part-nombre { font-style: italic; }
  .part-rut { text-align: right; color: #444; width: 110px; }
  .total-row td { border: 1.5px solid #1a2e78; background-color: #eef0f8; }
  .total-label { text-align: right; font-weight: bold; font-size: 10.5pt; color: #1a2e78; letter-spacing: 1pt; padding: 9px 11px; }
  .total-value { text-align: right; font-weight: bold; font-size: 10.5pt; color: #1a2e78; white-space: nowrap; padding: 9px 11px; width: 106px; }
  .observations { margin-top: 16px; margin-bottom: 14px; }
  .observations .obs-label { font-weight: bold; font-size: 9.5pt; color: #111; margin-bottom: 6px; }
  .urgencia-row { font-size: 9pt; margin: 7px 0 4px 0; display: flex; align-items: center; }
  .chk { display: inline-block; width: 10px; height: 10px; border: 1px solid #333; vertical-align: middle; margin-left: 2px; }
  .obs-lines { width: 100%; height: 72px; display: flex; flex-direction: column; justify-content: space-evenly; padding: 0 4px; }
  .obs-line { border-bottom: 0.75px solid #aaa; height: 1px; }
  .exencion { margin-bottom: 24px; }
  .exencion div { font-size: 11pt; font-weight: bold; color: #111; line-height: 1.7; text-transform: uppercase; }
  .doc-footer { position: absolute; bottom: 34px; left: 53px; right: 53px; }
  .footer-top-line { border-top: 2px solid #1a2e78; margin-bottom: 7px; }
  .footer-row { display: flex; justify-content: space-between; align-items: center; }
  .footer-text { font-size: 7pt; font-weight: bold; color: #1a2e78; text-transform: uppercase; letter-spacing: 0.6pt; }
  .footer-firma { font-size: 9pt; font-weight: bold; color: #1a2e78; }
</style>
</head>
<body>
<div class="page">

  <table class="header-table">
    <tbody>
      <tr>
        <td class="td-logo" rowspan="2">
          <img src="${logoSrc}" alt="${escHtml(brand.fullName)}">
        </td>
        <td class="td-center-top">
          <div class="sys-title">${escHtml(brand.fullName.toUpperCase())} &ndash; SISTEMA DE GESTIÓN DE LA CALIDAD</div>
        </td>
        <td class="td-code" rowspan="2">
          <strong>COT &ndash; 01</strong>
          Revisión &nbsp;&nbsp;&nbsp; 1<br>
          Documento de ejemplo
        </td>
      </tr>
      <tr>
        <td class="td-center-bottom">
          <div class="form-title">SOLICITUD DE COTIZACIÓN</div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="company-info">
    <p class="co-name">${escHtml(brand.legalName)}</p>
    <p>RUT ${escHtml(brand.rut)}</p>
    <p>${escHtml(brand.city)}, Chile</p>
    <p>${escHtml(brand.contactLine)}</p>
    <p>Giro: Capacitación y formación profesional.</p>
  </div>

  <div class="cot-title">COTIZACIÓN N&deg; ${escHtml(numero)}</div>

  <table class="client-table">
    <tbody>
      <tr>
        <td><span class="field-label">Empresa</span> &nbsp;:&nbsp; ${escHtml(empresa.nombre ?? '')}</td>
        <td><span class="field-label">Persona Contacto</span> &nbsp;:&nbsp; ${escHtml(empresa.contacto ?? empresa.email ?? '')}</td>
        <td style="white-space:nowrap;"><span class="field-label">Fecha</span> &nbsp;:&nbsp; ${escHtml(fmtFechaCorta(fecha))}</td>
      </tr>
    </tbody>
  </table>

  <p class="intro-text">Sirvan recibir por nuestra cuenta lo siguiente:</p>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-cant">Cantidad</th>
        <th class="col-unid">Unidad</th>
        <th>Descripción</th>
        <th class="col-sub">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
      <tr class="total-row">
        <td class="col-cant">&nbsp;</td>
        <td class="col-unid">&nbsp;</td>
        <td class="total-label">TOTAL</td>
        <td class="total-value">${fmtCLP(subtotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="observations">
    <div class="obs-label">Observaciones</div>
    ${obsInner}
  </div>

  <div class="exencion">
    <div>VALORES EXENTOS DE IVA</div>
    <div>VIGENCIA DE 10 DÍAS</div>
  </div>

  <div class="doc-footer">
    <div class="footer-top-line"></div>
    <div class="footer-row">
      <div class="footer-text">${escHtml(brand.fullName.toUpperCase())} &ndash; SISTEMA DE GESTIÓN DE LA CALIDAD</div>
      <div class="footer-firma">Representante ${escHtml(brand.name)}</div>
    </div>
  </div>

</div>
</body>
</html>`
}

export async function generarCotizacionPDF({ empresa, items, numero, fecha, notas = '' }) {
  const { default: html2canvas } = await import('html2canvas')

  // Pre-cargar logo como data URL para evitar problemas CORS en html2canvas
  let logoSrc = window.location.origin + brand.logoFile
  try {
    const resp = await fetch(logoSrc)
    const blob = await resp.blob()
    logoSrc = await new Promise(res => {
      const r = new FileReader()
      r.onloadend = () => res(r.result)
      r.readAsDataURL(blob)
    })
  } catch { /* usa URL absoluta como fallback */ }

  const html = buildCotizacionHTML({ empresa, items, numero, fecha, notas, logoSrc })

  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;z-index:-1;pointer-events:none;'
  wrapper.innerHTML = html
  document.body.appendChild(wrapper)

  await document.fonts.ready
  await new Promise(r => setTimeout(r, 250))

  const pageEl = wrapper.querySelector('.page')
  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: pageEl.scrollWidth,
    height: pageEl.scrollHeight,
  })

  document.body.removeChild(wrapper)

  const A4_W = 210
  const imgH = (canvas.height / canvas.width) * A4_W
  const pdf  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W, imgH)
  const nombreEmp = empresa.nombre.replace(/[\\/:*?"<>|]/g, '').trim()
  pdf.save(`COT-N° ${numero.replace('COT-', '')}-${nombreEmp}.pdf`)
}
