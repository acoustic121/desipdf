import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 4 * 1024 * 1024 * 1024 })
  const [, files] = await form.parse(req)
  const file = files.file?.[0]
  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium
  const FREE_LIMIT = 50 * 1024 * 1024
  if (file && file.size > FREE_LIMIT && req.headers['x-premium'] !== 'true') {
    filesToClean?.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
    return res.status(413).json({ error: 'File exceeds 50 MB. Upgrade to Premium for files up to 4 GB.', upgradeUrl: '/pricing' })
  }


  try {
    const XLSX = await import('xlsx')

    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(srcBytes)
    const pageCount = pdfDoc.getPageCount()

    // Create workbook with metadata (full table extraction requires OCR/parsing library)
    const wb = XLSX.utils.book_new()
    const wsData = [
      ['DesiPDF - PDF to Excel Conversion'],
      [''],
      ['File', file.originalFilename || 'document.pdf'],
      ['Pages', pageCount],
      ['Status', 'Text-based table extraction requires an OCR library for production use.'],
      [''],
      ['For full table extraction:', ''],
      ['1. Integrate Tabula-py or Camelot (Python)', ''],
      ['2. Use Adobe PDF Services API', ''],
      ['3. Use CloudConvert API', ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 40 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws, 'PDF Data')

    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="converted.xlsx"')
    res.send(xlsxBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})