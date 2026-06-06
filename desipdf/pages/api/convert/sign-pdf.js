import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const config = { api: { bodyParser: false }, maxDuration: 60 }

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER })
    const [fields, files] = await form.parse(req)
    const filesToClean = []
    const file = files.file?.[0]
    if (file) filesToClean.push(file.filepath)
    if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium

    const sigBase64 = fields.signature?.[0]
    const pageNum   = parseInt(fields.page?.[0]  || '1') - 1
    const x         = parseFloat(fields.x?.[0]   || '50')
    const y         = parseFloat(fields.y?.[0]   || '100')
    const width     = parseFloat(fields.width?.[0]|| '200')

    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc   = await PDFDocument.load(srcBytes)
    const pages    = pdfDoc.getPages()
    const page     = pages[Math.min(pageNum, pages.length - 1)]

    // Embed signature image
    const sigBuffer = Buffer.from(sigBase64, 'base64')
    const sigImage  = await pdfDoc.embedPng(sigBuffer)
    const { width: iW, height: iH } = sigImage
    const height = (iH / iW) * width

    page.drawImage(sigImage, { x, y, width, height })

    const outBytes = await pdfDoc.save()
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="signed.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
  }
})