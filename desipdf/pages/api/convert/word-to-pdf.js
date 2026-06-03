import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

// NOTE: Full fidelity Word→PDF conversion requires LibreOffice or MS Office.
// This route extracts text from docx using the 'mammoth' package and renders
// it as a text PDF. For pixel-perfect output, integrate a cloud conversion API.

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
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: file.filepath })
    const text = result.value || '(No text content found)'

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontSize = 12
    const margin = 50
    const pageWidth = 595.28
    const pageHeight = 841.89
    const lineHeight = fontSize * 1.5
    const maxWidth = pageWidth - margin * 2
    const lines = []

    for (const paragraph of text.split('\n')) {
      const words = paragraph.split(' ')
      let line = ''
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word
        const testWidth = font.widthOfTextAtSize(testLine, fontSize)
        if (testWidth > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = testLine
        }
      }
      if (line) lines.push(line)
      lines.push('')
    }

    let page = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      if (line) {
        page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) })
      }
      y -= lineHeight
    }

    const pdfBytes = await pdfDoc.save()
    

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"')
    res.send(Buffer.from(pdfBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})