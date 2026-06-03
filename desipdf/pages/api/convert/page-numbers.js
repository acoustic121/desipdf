import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export const config = { api: { bodyParser: false }, maxDuration: 60 }

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const form = formidable({ maxFileSize: 4 * 1024 * 1024 * 1024 })
    const [fields, files] = await form.parse(req)
    const filesToClean = []
    const file = files.file?.[0]
    if (file) filesToClean.push(file.filepath)
    if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium
  const FREE_LIMIT = 50 * 1024 * 1024
  if (file && file.size > FREE_LIMIT && req.headers['x-premium'] !== 'true') {
    filesToClean?.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
    return res.status(413).json({ error: 'File exceeds 50 MB. Upgrade to Premium for files up to 4 GB.', upgradeUrl: '/pricing' })
  }


    const position = fields.position?.[0] || 'bottom-center'
    const startFrom = parseInt(fields.startFrom?.[0] || '1')
    const fontSize = parseInt(fields.fontSize?.[0] || '12')

    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(srcBytes)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const pages = pdfDoc.getPages()

    pages.forEach((page, i) => {
      const { width, height } = page.getSize()
      const label = String(startFrom + i)
      const textWidth = font.widthOfTextAtSize(label, fontSize)
      const margin = 20

      let x = width / 2 - textWidth / 2 // center default
      let y = margin // bottom default

      if (position.includes('left')) x = margin
      if (position.includes('right')) x = width - textWidth - margin
      if (position.includes('top')) y = height - margin - fontSize

      page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) })
    })

    const outBytes = await pdfDoc.save()
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="numbered.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})