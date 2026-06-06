import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  A3: [841.89, 1190.55],
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER, multiples: true, keepExtensions: true })
  const [fields, files] = await form.parse(req)
  const fileList = Object.values(files).flat().filter(Boolean)
  const filesToClean = fileList.map((f) => f.filepath)

  if (fileList.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const pageSize = fields.pageSize?.[0] || 'A4'
  const [pgW, pgH] = PAGE_SIZES[pageSize] || PAGE_SIZES.A4

  try {
    const pdfDoc = await PDFDocument.create()

    for (const file of fileList) {
      const imgBytes = fs.readFileSync(file.filepath)
      // Detect PNG by magic bytes (89 50 4E 47)
      const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50

      let img
      try {
        img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
      } catch {
        try { img = await pdfDoc.embedPng(imgBytes) } catch { img = await pdfDoc.embedJpg(imgBytes) }
      }

      const page = pdfDoc.addPage([pgW, pgH])
      const dims = img.size()
      const scale = Math.min(pgW / dims.width, pgH / dims.height)
      page.drawImage(img, {
        x: (pgW - dims.width * scale) / 2,
        y: (pgH - dims.height * scale) / 2,
        width: dims.width * scale,
        height: dims.height * scale,
      })
    }

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"')
    res.send(Buffer.from(pdfBytes))
  } catch (err) {
    console.error('jpg-to-pdf error:', err)
    res.status(500).json({ error: err.message || 'Conversion failed' })
  } finally {
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
  }
})
