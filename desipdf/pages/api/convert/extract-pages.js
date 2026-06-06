import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import { parsePageRange } from '../../../utils/helpers'

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

  const rangeStr = fields.range?.[0] || ''
  if (!rangeStr.trim()) return res.status(400).json({ error: 'No page range specified' })

  try {
    const srcBytes = fs.readFileSync(file.filepath)
    const srcDoc = await PDFDocument.load(srcBytes)
    const totalPages = srcDoc.getPageCount()

    const pageNums = parsePageRange(rangeStr, totalPages)
    if (pageNums.length === 0) return res.status(400).json({ error: 'No valid pages in range' })

    const newDoc = await PDFDocument.create()
    const indices = pageNums.map((n) => n - 1)
    const copied = await newDoc.copyPages(srcDoc, indices)
    copied.forEach((p) => newDoc.addPage(p))

    const outBytes = await newDoc.save()
    

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="extracted-pages.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})