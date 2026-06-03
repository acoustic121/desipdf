import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

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


    const top    = parseFloat(fields.top?.[0]    || '0')
    const right  = parseFloat(fields.right?.[0]  || '0')
    const bottom = parseFloat(fields.bottom?.[0] || '0')
    const left   = parseFloat(fields.left?.[0]   || '0')

    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(srcBytes)

    pdfDoc.getPages().forEach((page) => {
      const { x, y, width, height } = page.getCropBox()
      page.setCropBox(
        x + left,
        y + bottom,
        Math.max(width  - left - right,  10),
        Math.max(height - top  - bottom, 10),
      )
    })

    const outBytes = await pdfDoc.save()
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="cropped.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})