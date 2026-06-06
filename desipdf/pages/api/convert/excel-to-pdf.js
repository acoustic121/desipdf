import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER })
  const [, files] = await form.parse(req)
  const file = files.file?.[0]

  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium

  const filesToClean = [file.filepath]

  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.readFile(file.filepath)
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Courier)
    const boldFont = await pdfDoc.embedFont(StandardFonts.CourierBold)
    const fontSize = 9
    const margin = 40

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      if (data.length === 0) continue

      const pageWidth = 841.89
      const pageHeight = 595.28
      let page = pdfDoc.addPage([pageWidth, pageHeight])
      let y = pageHeight - margin

      page.drawText(`Sheet: ${sheetName}`, {
        x: margin, y, size: 12, font: boldFont, color: rgb(0.1, 0.3, 0.7),
      })
      y -= 20

      for (const row of data) {
        if (y < margin) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        const rowText = row.map((cell) => String(cell).slice(0, 20).padEnd(20)).join(' | ')
        page.drawText(rowText.slice(0, 100), {
          x: margin, y, size: fontSize, font, color: rgb(0.1, 0.1, 0.1),
        })
        y -= fontSize * 1.5
      }
    }

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"')
    res.send(Buffer.from(pdfBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
  }
})