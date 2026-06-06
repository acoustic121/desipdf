import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

export const config = {
  api: { bodyParser: false, responseLimit: false },
  maxDuration: 300,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: Number.MAX_SAFE_INTEGER, multiples: true, keepExtensions: true })
  const [, files] = await form.parse(req)
  const fileList = Object.values(files).flat().filter(Boolean)
  const filesToClean = fileList.map((f) => f.filepath)

  if (fileList.length < 2) {
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
    return res.status(400).json({ error: 'Please upload at least 2 PDF files' })
  }
  try {
    const merged = await PDFDocument.create()
    for (const file of fileList) {
      const bytes = fs.readFileSync(file.filepath)
      const doc = await PDFDocument.load(bytes)
      const pages = await merged.copyPages(doc, doc.getPageIndices())
      pages.forEach((p) => merged.addPage(p))
    }
    const mergedBytes = await merged.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"')
    res.send(Buffer.from(mergedBytes))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
  }
})
