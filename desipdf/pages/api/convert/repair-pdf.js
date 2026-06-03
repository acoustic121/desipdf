import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const config = { api: { bodyParser: false }, maxDuration: 60 }

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 4 * 1024 * 1024 * 1024 })
  const [, files] = await form.parse(req)
  const file = files.file?.[0]
  const filesToClean = file ? [file.filepath] : []

  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium
  const FREE_LIMIT = 50 * 1024 * 1024
  if (file && file.size > FREE_LIMIT && req.headers['x-premium'] !== 'true') {
    filesToClean?.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
    return res.status(413).json({ error: 'File exceeds 50 MB. Upgrade to Premium for files up to 4 GB.', upgradeUrl: '/pricing' })
  }


  try {
    const srcBytes = fs.readFileSync(file.filepath)
    const pdfDoc = await PDFDocument.load(srcBytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    })
    const outBytes = await pdfDoc.save({ useObjectStreams: false })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="repaired.pdf"')
    res.send(Buffer.from(outBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not repair this PDF. The file may be too damaged.' })
  } finally {
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
  }
})