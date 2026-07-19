// Tres funciones para manejar ZIPs de certificados:
// crearZipBlob — crea el ZIP en memoria sin descargarlo (para subir snapshot al servidor)
// generarYDescargarZip — crea y descarga en un paso
// fusionarZips — combina varios ZIPs en uno solo para descarga masiva de múltiples lotes
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

/**
 * Construye un ZIP en memoria y lo devuelve como Blob, sin descargarlo.
 * Útil para subir snapshots al servidor antes de ofrecer la descarga combinada.
 *
 * @param {Array<{ nombre: string, buffer?: ArrayBuffer, blob?: Blob, carpeta?: string }>} archivos
 * @returns {Promise<Blob>}
 */
export async function crearZipBlob(archivos) {
  const zip = new JSZip()
  for (const { nombre, buffer, blob, carpeta } of archivos) {
    const destino = carpeta ? zip.folder(carpeta) : zip.folder('certificados')
    destino.file(nombre, buffer ?? blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

/**
 * Empaca archivos en un ZIP, lo descarga automáticamente y devuelve el Blob.
 * Cada archivo puede incluir una propiedad `carpeta` para organizarlos en subcarpetas.
 *
 * @param {Array<{ nombre: string, buffer?: ArrayBuffer, blob?: Blob, carpeta?: string }>} archivos
 * @param {string} nombreZip  - nombre base sin extensión
 * @returns {Promise<Blob>}
 */
export async function generarYDescargarZip(archivos, nombreZip) {
  const zipBlob = await crearZipBlob(archivos)
  saveAs(zipBlob, `${nombreZip}.zip`)
  return zipBlob
}

/**
 * Fusiona varios mini-ZIPs (ya con subcarpetas internas) en un único ZIP combinado
 * y lo descarga. Procesa los blobs uno a uno para minimizar el uso de RAM:
 * en lugar de mantener todos los .docx descomprimidos en memoria, trabaja con los
 * ZIPs ya comprimidos (mucho más livianos).
 *
 * @param {Blob[]}  blobs     - array de blobs ZIP, uno por lote
 * @param {string}  nombreZip - nombre base sin extensión
 * @returns {Promise<Blob>}
 */
export async function fusionarZips(blobs, nombreZip) {
  const zipFinal = new JSZip()

  for (const blob of blobs) {
    const zip = await JSZip.loadAsync(blob)
    for (const [path, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        // Mantiene la ruta completa: "Lote-01-NombreCurso/rut-nombre.docx"
        const content = await file.async('blob')
        zipFinal.file(path, content)
      }
    }
  }

  const finalBlob = await zipFinal.generateAsync({ type: 'blob' })
  saveAs(finalBlob, `${nombreZip}.zip`)
  return finalBlob
}
