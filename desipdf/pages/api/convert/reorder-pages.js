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

  const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER })
  const [fields, files] = await form.parse(req)
    const filesToClean = []
  const file = files.file?.[0]
  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium

  const orderStr = fields.order?.[0] || ''
  const newOrder = orderStr.split(',').map((s) => parseInt(s.trim())).filter((n) => !isNaN(n))
  if (newOrder.length === 0) return res.status(400).json({ error: 'Invalid page order' })

  try {
    const srcBytes = fs.readFileSync(file.filepath)
    const srcDoc = await PDFDocument.load(srcBytes)
    const totalPages = srcDoc.getPageCount()

    const indices = newOrder.filter((n) => n >= 1 && n <= totalPages).map((n) => n - 1)
    const newDoc = await PDFDocument.create()
    const copied = await newDoc.copyPages(srcDoc, indices)
    copied.forEach((p) => newDoc.addPage(p))

    const outBytes = await newDoc.save()
    

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="reordered.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})