import { withRateLimit } from '../../../utils/apiMiddleware'
import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import os from 'os'
import archiver from 'archiver'
import { PDFDocument } from 'pdf-lib'
import { parsePageRange } from '../../../utils/helpers'

export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
}

export default withRateLimit(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = formidable({ maxFileSize: 4 * 1024 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)
  const file = files.file?.[0]

  if (!file) return res.status(400).json({ error: 'No file uploaded' })
  // File size limit: 50MB free, 500MB premium
  const FREE_LIMIT = 50 * 1024 * 1024
  if (file && file.size > FREE_LIMIT && req.headers['x-premium'] !== 'true') {
    filesToClean?.forEach((p) => { try { require('fs').unlinkSync(p) } catch {} })
    return res.status(413).json({ error: 'File exceeds 50 MB. Upgrade to Premium for files up to 4 GB.', upgradeUrl: '/pricing' })
  }


  const filesToClean = [file.filepath]
  let tmpDir = null

  const mode = fields.mode?.[0] || 'all'
  const rangeStr = fields.range?.[0] || ''

  try {
    const srcBytes = fs.readFileSync(file.filepath)
    const srcDoc = await PDFDocument.load(srcBytes)
    const totalPages = srcDoc.getPageCount()

    let pagesToExtract = []
    if (mode === 'all') {
      pagesToExtract = Array.from({ length: totalPages }, (_, i) => [i])
    } else {
      const indices = parsePageRange(rangeStr, totalPages).map((p) => p - 1)
      pagesToExtract = indices.map((i) => [i])
    }

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfchampion-split-'))
    const zipPath = path.join(tmpDir, 'split.zip')
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    await new Promise(async (resolve, reject) => {
      archive.on('error', reject)
      output.on('close', resolve)
      archive.pipe(output)

      for (let idx = 0; idx < pagesToExtract.length; idx++) {
        const pageIndices = pagesToExtract[idx]
        const newDoc = await PDFDocument.create()
        const copied = await newDoc.copyPages(srcDoc, pageIndices)
        copied.forEach((p) => newDoc.addPage(p))
        const bytes = await newDoc.save()
        const name = `page-${String(pageIndices[0] + 1).padStart(3, '0')}.pdf`
        archive.append(Buffer.from(bytes), { name })
      }

      archive.finalize()
    })

    const zipBuffer = fs.readFileSync(zipPath)
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="split-pages.zip"')
    res.send(zipBuffer)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  } finally {
    // Always clean up uploaded file and temp dir
    filesToClean.forEach((p) => { try { fs.unlinkSync(p) } catch {} })
    if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {} }
  }
})