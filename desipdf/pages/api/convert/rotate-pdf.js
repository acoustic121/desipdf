import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument, degrees } from 'pdf-lib'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER })
  const [fields, files] = await form.parse(req)
    const filesToClean = []
  const file = files.file?.[0]
  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium

  const angle = parseInt(fields.angle?.[0] || '90')
  const pageFilter = fields.pages?.[0] || 'all'

  try {
    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(srcBytes)
    const pages = pdfDoc.getPages()

    pages.forEach((page, i) => {
      const pageNum = i + 1
      const shouldRotate =
        pageFilter === 'all' ||
        (pageFilter === 'odd' && pageNum % 2 !== 0) ||
        (pageFilter === 'even' && pageNum % 2 === 0)
      if (shouldRotate) {
        const current = page.getRotation().angle
        page.setRotation(degrees((current + angle) % 360))
      }
    })

    const outBytes = await pdfDoc.save()
    

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="rotated.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})